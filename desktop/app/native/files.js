// File access for the renderer: dialog-approved paths, the agent's confined folders, bulk rename and scaffolding.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { shell } = require('electron');

const MAX_READ = 1024 * 1024;

/** Paths the user picked in an open or save dialog this session; plain fs writes are limited to these. */
const approved = new Set();
const approve = (p) => approved.add(path.resolve(p).toLowerCase());
const isApproved = (p) => approved.has(path.resolve(p).toLowerCase());

async function readText(p) {
	const full = path.resolve(p);
	if (!isApproved(full)) throw new Error('Open the file with the Open file button first.');
	const st = await fs.promises.stat(full);
	if (st.size > 20 * MAX_READ) throw new Error('Files over 20 MB are too large for Code Pad.');
	return { path: full, text: await fs.promises.readFile(full, 'utf8') };
}

async function writeText(p, text) {
	const full = path.resolve(p);
	if (!isApproved(full)) throw new Error('Choose where to save with the Save as button first.');
	await fs.promises.writeFile(full, String(text), 'utf8');
	return { path: full };
}

async function writeBase64(p, b64) {
	const full = path.resolve(p);
	if (!isApproved(full)) throw new Error('Choose where to save first.');
	await fs.promises.writeFile(full, Buffer.from(String(b64), 'base64'));
	return { path: full };
}

/* ---------- Agent folders ---------- */

class AgentFs {
	/** opts: { config, extraRoots: async () => string[] } */
	constructor(opts) {
		this.opts = opts;
	}
	root() {
		const r = this.opts.config.get('agent.root', null) || path.join(os.homedir(), 'Documents', 'OmniTool Agent');
		fs.mkdirSync(r, { recursive: true });
		return r;
	}
	setRoot(p) {
		const full = path.resolve(p);
		if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) throw new Error('That folder does not exist.');
		this.opts.config.set('agent.root', full);
		return full;
	}
	async roots() {
		let extra = [];
		try {
			extra = await this.opts.extraRoots();
		} catch {
			// LabsCode not running; only the agent folder applies.
		}
		return [this.root(), ...extra.filter(Boolean)];
	}
	/** Resolves a path against the agent folder and checks it stays inside an allowed root, symlinks included. */
	async resolve(p) {
		const roots = await this.roots();
		const input = String(p || '.');
		const full = path.resolve(path.isAbsolute(input) ? input : path.join(roots[0], input));
		// Compare real paths so a symlink inside a root cannot point outside it.
		let real = full;
		try {
			real = fs.realpathSync.native(full);
		} catch {
			try {
				real = path.join(fs.realpathSync.native(path.dirname(full)), path.basename(full));
			} catch {
				real = full;
			}
		}
		const inside = (r) => {
			let rr = r;
			try {
				rr = fs.realpathSync.native(r);
			} catch {
				// Root missing; compare lexically.
			}
			const rel = path.relative(rr.toLowerCase(), real.toLowerCase());
			return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
		};
		let exists = false;
		let size = 0;
		try {
			const st = fs.statSync(full);
			exists = st.isFile();
			size = st.size;
		} catch {
			exists = false;
		}
		return { path: full, allowed: roots.some(inside), exists, size, roots };
	}
	async list(p) {
		const r = await this.resolve(p);
		if (!r.allowed) throw new Error(`${r.path} is outside the agent folders (${r.roots.join(', ')}).`);
		const entries = await fs.promises.readdir(r.path, { withFileTypes: true });
		return { folder: r.path, entries: entries.slice(0, 500).map((e) => ({ name: e.name, type: e.isDirectory() ? 'folder' : 'file' })), truncated: entries.length > 500 };
	}
	async read(p) {
		const r = await this.resolve(p);
		if (!r.allowed) throw new Error(`${r.path} is outside the agent folders (${r.roots.join(', ')}).`);
		if (!r.exists) throw new Error(`${r.path} is not a file.`);
		if (r.size > MAX_READ) throw new Error(`${r.path} is ${Math.round(r.size / 1024)} KB; the agent reads files up to 1 MB.`);
		const buf = await fs.promises.readFile(r.path);
		if (buf.includes(0)) throw new Error(`${r.path} looks like a binary file.`);
		return { path: r.path, text: buf.toString('utf8') };
	}
	async write(p, content) {
		const r = await this.resolve(p);
		if (!r.allowed) throw new Error(`${r.path} is outside the agent folders.`);
		await fs.promises.mkdir(path.dirname(r.path), { recursive: true });
		await fs.promises.writeFile(r.path, String(content), 'utf8');
		return { written: true, path: r.path, bytes: Buffer.byteLength(String(content)) };
	}
	async remove(p) {
		const r = await this.resolve(p);
		if (!r.allowed) throw new Error(`${r.path} is outside the agent folders.`);
		if (!r.exists) throw new Error(`${r.path} does not exist.`);
		await shell.trashItem(r.path);
		return { deleted: true, path: r.path, note: 'Moved to the Recycle Bin.' };
	}
}

/* ---------- Bulk rename ---------- */

async function renameList(folder) {
	const entries = await fs.promises.readdir(path.resolve(folder), { withFileTypes: true });
	return entries.filter((e) => e.isFile()).map((e) => e.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Renames in two passes through temporary names, so swaps (a->b, b->a) work, and writes an undo list first. */
async function renameApply(folder, pairs) {
	const dir = path.resolve(folder);
	const clean = pairs.filter((p) => p && p.from && p.to && p.from !== p.to);
	for (const p of clean) {
		if (/[\\/:*?"<>|]/.test(p.to) || /[\\/]/.test(p.from)) throw new Error(`"${p.to}" is not a valid file name.`);
	}
	const targets = new Set(clean.map((p) => p.to.toLowerCase()));
	if (targets.size !== clean.length) throw new Error('Two files would get the same name.');
	const sources = new Set(clean.map((p) => p.from.toLowerCase()));
	for (const p of clean) {
		if (fs.existsSync(path.join(dir, p.to)) && !sources.has(p.to.toLowerCase())) throw new Error(`${p.to} already exists.`);
	}
	await fs.promises.writeFile(path.join(dir, 'omnitool-rename-undo.json'), JSON.stringify({ at: new Date().toISOString(), renamed: clean }, null, 2));
	const tag = `.omnitool-${process.pid}-${Date.now()}`;
	for (const p of clean) await fs.promises.rename(path.join(dir, p.from), path.join(dir, p.from + tag));
	for (const p of clean) await fs.promises.rename(path.join(dir, p.from + tag), path.join(dir, p.to));
	return { renamed: clean.length };
}

/* ---------- Scaffolding ---------- */

async function scaffold(parent, name, files) {
	if (!/^[\w][\w .-]*$/.test(name)) throw new Error('That project name is not allowed.');
	const dir = path.join(path.resolve(parent), name);
	if (fs.existsSync(dir)) throw new Error(`${dir} already exists; nothing was created.`);
	for (const rel of Object.keys(files)) {
		const target = path.resolve(dir, rel);
		const relCheck = path.relative(dir, target);
		if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) throw new Error(`Refusing to write outside the project: ${rel}`);
	}
	for (const [rel, content] of Object.entries(files)) {
		const target = path.resolve(dir, rel);
		await fs.promises.mkdir(path.dirname(target), { recursive: true });
		await fs.promises.writeFile(target, String(content), { flag: 'wx' });
	}
	return dir;
}

module.exports = { approve, isApproved, readText, writeText, writeBase64, AgentFs, renameList, renameApply, scaffold };
