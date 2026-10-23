// System tools: machine info, processes, drives, environment and folder sizes.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function info() {
	const cpus = os.cpus();
	const ifaces = os.networkInterfaces();
	return {
		// Windows 11 still reports version 10.0; build 22000 and later is Windows 11.
		os: { name: process.platform === 'win32' ? (Number(os.release().split('.')[2]) >= 22000 ? 'Windows 11' : 'Windows 10') : os.type(), release: os.release(), arch: os.arch() },
		hostname: os.hostname(),
		user: os.userInfo().username,
		cpu: { model: cpus[0] ? cpus[0].model.trim() : 'unknown', cores: cpus.length },
		load: os.loadavg(),
		memory: { total: os.totalmem(), free: os.freemem() },
		uptime: os.uptime(),
		versions: { electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome },
		interfaces: Object.entries(ifaces).flatMap(([name, list]) => list.map((i) => ({ name, address: i.address, cidr: i.cidr, family: i.family, mac: i.mac, internal: i.internal }))),
	};
}

function parseCsvLine(line) {
	const out = [];
	let cur = '';
	let q = false;
	for (const c of line) {
		if (c === '"') q = !q;
		else if (c === ',' && !q) {
			out.push(cur);
			cur = '';
		} else cur += c;
	}
	out.push(cur);
	return out;
}

function processes() {
	return new Promise((resolve, reject) => {
		if (process.platform !== 'win32') {
			execFile('ps', ['-eo', 'comm=,pid=,rss='], { maxBuffer: 16 * 1024 * 1024 }, (err, out) => {
				if (err) return reject(err);
				resolve(out.trim().split('\n').map((l) => l.trim().split(/\s+/)).map((p) => ({ name: p.slice(0, -2).join(' '), pid: Number(p[p.length - 2]), mem: Number(p[p.length - 1]) * 1024 })));
			});
			return;
		}
		execFile('tasklist', ['/fo', 'csv', '/nh'], { maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, out) => {
			if (err) return reject(new Error(`tasklist failed: ${err.message}`));
			const list = out.split(/\r?\n/).filter(Boolean).map(parseCsvLine).map((c) => ({ name: c[0], pid: Number(c[1]), mem: Number((c[4] || '0').replace(/[^\d]/g, '')) * 1024 }));
			resolve(list.filter((p) => p.pid > 0));
		});
	});
}

function kill(pid) {
	const n = Number(pid);
	if (!Number.isInteger(n) || n <= 4) throw new Error('That process cannot be ended.');
	if (n === process.pid) throw new Error('That is OmniTool itself.');
	try {
		process.kill(n);
	} catch (err) {
		throw new Error(err.code === 'EPERM' ? 'Windows refused: the process belongs to another user or runs as administrator.' : err.message);
	}
	return true;
}

function disks() {
	const out = [];
	const letters = process.platform === 'win32' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\`) : ['/'];
	for (const mount of letters) {
		try {
			const s = fs.statfsSync(mount);
			if (!s.blocks) continue;
			out.push({ mount, total: s.blocks * s.bsize, free: s.bavail * s.bsize });
		} catch {
			// Drive letter not in use.
		}
	}
	return out;
}

function env() {
	const vars = { ...process.env };
	const pathKey = Object.keys(vars).find((k) => k.toLowerCase() === 'path') || 'PATH';
	const dirs = (vars[pathKey] || '').split(path.delimiter).filter(Boolean);
	return { vars, path: dirs.map((d) => ({ dir: d, exists: fs.existsSync(d) })) };
}

let scanToken = 0;
/** Sizes of each child of a folder plus the 25 largest files; walks without following links. */
async function folderSize(root) {
	const token = ++scanToken;
	const base = path.resolve(root);
	const result = { total: 0, files: 0, dirs: 0, skipped: 0, children: [], largest: [], cancelled: false };
	const keepLargest = (p, size) => {
		if (result.largest.length < 25 || size > result.largest[result.largest.length - 1].size) {
			result.largest.push({ path: p, size });
			result.largest.sort((a, b) => b.size - a.size);
			if (result.largest.length > 25) result.largest.pop();
		}
	};
	async function walk(dir) {
		let size = 0;
		let entries;
		try {
			entries = await fs.promises.readdir(dir, { withFileTypes: true });
		} catch {
			result.skipped++;
			return 0;
		}
		for (const e of entries) {
			if (token !== scanToken) {
				result.cancelled = true;
				return size;
			}
			const full = path.join(dir, e.name);
			if (e.isSymbolicLink()) continue;
			if (e.isDirectory()) {
				result.dirs++;
				size += await walk(full);
			} else if (e.isFile()) {
				try {
					const st = await fs.promises.stat(full);
					size += st.size;
					result.files++;
					keepLargest(full, st.size);
				} catch {
					result.skipped++;
				}
			}
		}
		return size;
	}
	const top = await fs.promises.readdir(base, { withFileTypes: true });
	for (const e of top) {
		if (token !== scanToken) {
			result.cancelled = true;
			break;
		}
		if (e.isSymbolicLink()) continue;
		const full = path.join(base, e.name);
		let size = 0;
		if (e.isDirectory()) {
			result.dirs++;
			size = await walk(full);
		} else if (e.isFile()) {
			try {
				size = (await fs.promises.stat(full)).size;
				result.files++;
				keepLargest(full, size);
			} catch {
				result.skipped++;
			}
		}
		result.total += size;
		result.children.push({ name: e.name, dir: e.isDirectory(), size });
	}
	result.children.sort((a, b) => b.size - a.size);
	return result;
}

function cancelFolderSize() {
	scanToken++;
}

module.exports = { info, processes, kill, disks, env, folderSize, cancelFolderSize };
