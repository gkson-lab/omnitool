// Developer backends: read-only git, the script runner, the static file server and the clipboard watcher.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFile } = require('child_process');
const { clipboard } = require('electron');
const { readJson, writeJson } = require('./config');

/* ---------- Git (read-only) ---------- */

function git(folder, args) {
	return new Promise((resolve, reject) => {
		execFile('git', ['-C', folder, ...args], { maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
			if (err && err.code === 'ENOENT') return reject(new Error('Git is not installed or not on PATH. Get it from git-scm.com.'));
			if (err) return reject(new Error((stderr || err.message).trim()));
			resolve(stdout);
		});
	});
}

async function inspect(folder) {
	const dir = path.resolve(folder);
	if ((await git(dir, ['rev-parse', '--is-inside-work-tree']).catch(() => '')).trim() !== 'true') throw new Error(`${dir} is not inside a Git repository.`);
	const [status, log, branches, diffstat] = await Promise.all([
		git(dir, ['status', '--porcelain=v1', '-b']),
		git(dir, ['log', '-n', '30', '--pretty=format:%h%x09%ar%x09%an%x09%s']).catch(() => ''),
		git(dir, ['for-each-ref', '--sort=-committerdate', '--format=%(HEAD)%09%(refname:short)%09%(committerdate:relative)', 'refs/heads']),
		git(dir, ['diff', '--stat']).catch(() => ''),
	]);
	const lines = status.split('\n').filter(Boolean);
	const head = lines.shift() || '';
	const m = head.match(/^## (?:No commits yet on )?([^.\s]+)(?:\.\.\.(\S+))?(?: \[(?:ahead (\d+))?(?:, )?(?:behind (\d+))?\])?/);
	const codes = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied', U: 'conflict', '?': 'untracked', '!': 'ignored' };
	return {
		branch: m ? m[1] : head.replace(/^## /, ''),
		upstream: m && m[2] ? m[2] : null,
		ahead: m && m[3] ? Number(m[3]) : 0,
		behind: m && m[4] ? Number(m[4]) : 0,
		status: lines.map((l) => {
			const x = l[0];
			const y = l[1];
			const state = [x !== ' ' && x !== '?' ? `staged ${codes[x] || x}` : '', y !== ' ' ? codes[y] || y : ''].filter(Boolean).join(', ');
			return { state, path: l.slice(3) };
		}),
		log: log.split('\n').filter(Boolean).map((l) => {
			const [hash, when, author, subject] = l.split('\t');
			return { hash, when, author, subject };
		}),
		branches: branches.split('\n').filter(Boolean).map((l) => {
			const [cur, name, when] = l.split('\t');
			return { current: cur === '*', name, when };
		}),
		diffstat: diffstat.trim(),
	};
}

async function diff(folder) {
	const dir = path.resolve(folder);
	const staged = await git(dir, ['diff', '--cached']);
	if (staged.trim()) return { staged: true, diff: staged };
	return { staged: false, diff: await git(dir, ['diff']) };
}

/* ---------- Script runner ---------- */

let running = null;

function runtimeFor(lang, file) {
	if (lang === 'node') return { cmd: process.execPath, args: [file], env: { ELECTRON_RUN_AS_NODE: '1' }, label: `Node ${process.versions.node} (built into OmniTool)` };
	if (lang === 'powershell') return { cmd: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], env: {}, label: 'Windows PowerShell' };
	return { cmd: process.platform === 'win32' ? 'py' : 'python3', args: process.platform === 'win32' ? ['-3', file] : [file], fallback: { cmd: 'python', args: [file] }, env: { PYTHONIOENCODING: 'utf-8' }, label: 'Python' };
}

function runScript({ lang, code, stdin, timeoutMs }) {
	if (!['python', 'node', 'powershell'].includes(lang)) throw new Error('Unknown language.');
	if (running) throw new Error('A script is already running. Stop it first.');
	const dir = path.join(os.tmpdir(), 'omnitool-scripts');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `script-${Date.now()}.${{ python: 'py', node: 'js', powershell: 'ps1' }[lang]}`);
	fs.writeFileSync(file, lang === 'powershell' ? '﻿' + code : code, 'utf8');
	const rt = runtimeFor(lang, file);
	const limit = Math.max(1000, Math.min(600000, Number(timeoutMs) || 30000));
	const attempt = (cmd, args) => new Promise((resolve, reject) => {
		const t0 = Date.now();
		const env = { ...process.env, ...rt.env };
		if (lang !== 'node') delete env.ELECTRON_RUN_AS_NODE;
		const child = spawn(cmd, args, { cwd: dir, env, windowsHide: true });
		running = child;
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		const cap = (s, d) => (s.length > 2 * 1024 * 1024 ? s : s + d.toString('utf8'));
		child.stdout.on('data', (d) => (stdout = cap(stdout, d)));
		child.stderr.on('data', (d) => (stderr = cap(stderr, d)));
		const timer = setTimeout(() => {
			timedOut = true;
			killTree(child.pid);
		}, limit);
		child.on('error', (err) => {
			clearTimeout(timer);
			running = null;
			reject(err);
		});
		child.on('close', (code, signal) => {
			clearTimeout(timer);
			running = null;
			fs.rm(file, { force: true }, () => {});
			resolve({ stdout, stderr, exitCode: code, killed: !!signal && !timedOut, timedOut, ms: Date.now() - t0, runtime: rt.label });
		});
		if (stdin) child.stdin.write(stdin);
		child.stdin.end();
	});
	return attempt(rt.cmd, rt.args).catch((err) => {
		if (err.code === 'ENOENT' && rt.fallback) return attempt(rt.fallback.cmd, rt.fallback.args);
		throw err;
	}).catch((err) => {
		if (err.code === 'ENOENT') throw new Error(lang === 'python' ? 'Python was not found. Install Python 3 from python.org (tick "Add to PATH"), then try again.' : `${rt.cmd} was not found.`);
		throw err;
	});
}

function killTree(pid) {
	if (!pid) return;
	if (process.platform === 'win32') execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
	else {
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			// Already gone.
		}
	}
}

function killScript() {
	if (running) killTree(running.pid);
}

/* ---------- Static file server ---------- */

const MIME = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.xml': 'application/xml' };
let server = null;
const serverState = { folder: null, port: null, requests: 0, log: [] };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function startServer(folder, port) {
	if (server) throw new Error('The server is already running.');
	const root = path.resolve(folder);
	const p = Math.max(1024, Math.min(65535, Number(port) || 8080));
	return new Promise((resolve, reject) => {
		const srv = http.createServer((req, res) => {
			serverState.requests++;
			let rel;
			try {
				rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
			} catch {
				res.writeHead(400).end('Bad request');
				return;
			}
			const target = path.resolve(root, '.' + rel);
			const check = path.relative(root, target);
			const log = (status) => {
				serverState.log.unshift(`${new Date().toLocaleTimeString()} ${status} ${req.method} ${rel}`);
				serverState.log.length = Math.min(serverState.log.length, 100);
			};
			if (check.startsWith('..') || path.isAbsolute(check)) {
				log(403);
				res.writeHead(403).end('Forbidden');
				return;
			}
			fs.stat(target, (err, st) => {
				if (err) {
					log(404);
					res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
					return;
				}
				if (st.isDirectory()) {
					const index = path.join(target, 'index.html');
					if (fs.existsSync(index)) {
						log(200);
						res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
						fs.createReadStream(index).pipe(res);
						return;
					}
					const items = fs.readdirSync(target, { withFileTypes: true });
					const base = rel.endsWith('/') ? rel : rel + '/';
					log(200);
					res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(`<!doctype html><meta charset="utf-8"><title>${esc(rel)}</title><h1>${esc(rel)}</h1><ul>${items.map((i) => `<li><a href="${esc(base + encodeURIComponent(i.name))}${i.isDirectory() ? '/' : ''}">${esc(i.name)}${i.isDirectory() ? '/' : ''}</a></li>`).join('')}</ul>`);
					return;
				}
				log(200);
				res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
				fs.createReadStream(target).pipe(res);
			});
		});
		srv.once('error', (err) => reject(new Error(err.code === 'EADDRINUSE' ? `Port ${p} is already in use. Pick another.` : err.message)));
		srv.listen(p, '127.0.0.1', () => {
			server = srv;
			Object.assign(serverState, { folder: root, port: p, requests: 0, log: [] });
			resolve(true);
		});
	});
}

function stopServer() {
	if (server) server.close();
	server = null;
	return true;
}

function serverStatus() {
	return { running: !!server, folder: serverState.folder, url: server ? `http://127.0.0.1:${serverState.port}/` : null, requests: serverState.requests, log: serverState.log };
}

/* ---------- Clipboard history ---------- */

// Electron 44's clipboard is asynchronous (W3C style); raw Windows formats are checked through has().
const OS_FORMAT = (name) => `electron application/osclipboard;format="${name}"`;

class ClipboardWatcher {
	constructor(dataDir, config, notify) {
		this.file = path.join(dataDir, 'clipboard.json');
		this.config = config;
		this.notify = notify;
		this.items = readJson(this.file, []).filter((x) => x && typeof x.text === 'string');
		this.last = null;
		this.busy = false;
		this.timer = null;
		if (this.isRecording()) this.start();
	}
	isRecording() {
		return this.config.get('clipboard.recording', true);
	}
	setRecording(on) {
		this.config.set('clipboard.recording', !!on);
		if (on) this.start();
		else this.stop();
	}
	start() {
		if (this.timer) return;
		// What is on the clipboard when recording starts is not new, so it is not recorded.
		this.last = null;
		clipboard.readText().then((t) => (this.last = t), () => {});
		this.timer = setInterval(() => this.poll(), 1000);
	}
	stop() {
		clearInterval(this.timer);
		this.timer = null;
	}
	/** Password managers set these Windows formats to ask clipboard tools not to record a copy. */
	async private() {
		try {
			if (await clipboard.has(OS_FORMAT('ExcludeClipboardContentFromMonitorProcessing'))) return true;
			if (!(await clipboard.has(OS_FORMAT('CanIncludeInClipboardHistory')))) return false;
			const [item] = await clipboard.read();
			const blob = await item.getType(OS_FORMAT('CanIncludeInClipboardHistory'));
			return Buffer.from(await blob.arrayBuffer()).readUInt32LE(0) === 0;
		} catch {
			return false;
		}
	}
	async poll() {
		if (this.busy || this.last === null) return;
		this.busy = true;
		try {
			const text = await clipboard.readText();
			if (typeof text !== 'string' || !text || text === this.last) return;
			this.last = text;
			if ((await this.private()) || text.length > 100000) return;
			this.record(text);
		} catch {
			// Clipboard locked by another program for a moment; try again next tick.
		} finally {
			this.busy = false;
		}
	}
	record(text) {
		this.items = [{ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, at: Date.now(), pinned: false }, ...this.items.filter((x) => x.text !== text)];
		const pinned = this.items.filter((x) => x.pinned);
		this.items = [...pinned, ...this.items.filter((x) => !x.pinned).slice(0, 200)].sort((a, b) => b.at - a.at);
		this.save();
	}
	save() {
		writeJson(this.file, this.items);
		this.notify();
	}
	history() {
		return this.items;
	}
	pin(id, on) {
		const it = this.items.find((x) => x.id === id);
		if (it) it.pinned = !!on;
		this.save();
	}
	remove(id) {
		this.items = this.items.filter((x) => x.id !== id);
		this.save();
	}
	clear() {
		this.items = this.items.filter((x) => x.pinned);
		this.save();
	}
}

module.exports = { inspect, diff, runScript, killScript, startServer, stopServer, serverStatus, ClipboardWatcher };
