// Network tools for the desktop edition: ping and traceroute (streamed), DNS, TCP port checks and HTTP without CORS.
'use strict';
const net = require('net');
const dns = require('dns').promises;
const { spawn } = require('child_process');

const jobs = new Map();
let nextJob = 1;

/** Runs a command and streams its lines through send(line); returns { id, done }. */
function stream(cmd, args, send) {
	const id = nextJob++;
	const child = spawn(cmd, args, { windowsHide: true });
	jobs.set(id, child);
	let buf = '';
	const flush = (chunk) => {
		buf += chunk.toString('utf8');
		const lines = buf.split(/\r?\n/);
		buf = lines.pop();
		lines.forEach((l) => send(l));
	};
	child.stdout.on('data', flush);
	child.stderr.on('data', flush);
	const done = new Promise((resolve, reject) => {
		child.on('error', (err) => reject(new Error(`${cmd} could not start: ${err.message}`)));
		child.on('close', (code) => {
			if (buf) send(buf);
			jobs.delete(id);
			resolve({ code });
		});
	});
	return { id, done };
}

function stop(id) {
	const child = jobs.get(id);
	if (child) child.kill();
}

const validHost = (h) => /^[a-z0-9.:-]{1,253}$/i.test(h) && !h.startsWith('-');

function ping(host, count, send) {
	if (!validHost(host)) throw new Error('Not a valid host name.');
	const n = String(Math.max(1, Math.min(100, Number(count) || 4)));
	return process.platform === 'win32' ? stream('ping', ['-n', n, host], send) : stream('ping', ['-c', n, host], send);
}

function traceroute(host, hops, send) {
	if (!validHost(host)) throw new Error('Not a valid host name.');
	const h = String(Math.max(1, Math.min(64, Number(hops) || 20)));
	return process.platform === 'win32' ? stream('tracert', ['-d', '-h', h, host], send) : stream('traceroute', ['-n', '-m', h, host], send);
}

async function lookup(name, type) {
	try {
		switch (type) {
			case 'A':
				return await dns.resolve4(name);
			case 'AAAA':
				return await dns.resolve6(name);
			case 'MX':
				return (await dns.resolveMx(name)).sort((a, b) => a.priority - b.priority).map((r) => `${r.priority} ${r.exchange}`);
			case 'TXT':
				return (await dns.resolveTxt(name)).map((r) => r.join(''));
			case 'NS':
				return await dns.resolveNs(name);
			case 'CNAME':
				return await dns.resolveCname(name);
			case 'SOA': {
				const s = await dns.resolveSoa(name);
				return [`${s.nsname} ${s.hostmaster} serial ${s.serial} refresh ${s.refresh} retry ${s.retry} expire ${s.expire} minimum ${s.minttl}`];
			}
			case 'CAA':
				return (await dns.resolveCaa(name)).map((r) => `${r.critical} ${Object.keys(r).find((k) => k !== 'critical')} "${r.issue || r.issuewild || r.iodef || r.contactemail || ''}"`);
			default:
				throw new Error(`Record type ${type} is not supported.`);
		}
	} catch (err) {
		if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') return err.code === 'ENOTFOUND' ? ['Domain not found (NXDOMAIN)'] : [];
		throw new Error(`DNS lookup failed: ${err.code || err.message}`);
	}
}

function checkPort(host, port, timeout) {
	return new Promise((resolve) => {
		const t0 = Date.now();
		const sock = net.connect({ host, port, timeout });
		const finish = (open, error) => {
			sock.destroy();
			resolve({ port, open, error, ms: Date.now() - t0 });
		};
		sock.once('connect', () => finish(true, null));
		sock.once('timeout', () => finish(false, 'no answer (filtered?)'));
		sock.once('error', (e) => finish(false, e.code === 'ECONNREFUSED' ? 'closed' : e.code || e.message));
	});
}

async function ports(host, list, timeout) {
	if (!validHost(host)) throw new Error('Not a valid host name.');
	const out = [];
	const queue = list.slice(0, 64);
	const workers = Array.from({ length: 16 }, async () => {
		while (queue.length) out.push(await checkPort(host, queue.shift(), Math.max(100, Math.min(10000, timeout))));
	});
	await Promise.all(workers);
	return out.sort((a, b) => a.port - b.port);
}

async function http({ method, url, headers, body }) {
	const u = new URL(url);
	if (!/^https?:$/.test(u.protocol)) throw new Error('Only http and https URLs can be requested.');
	const t0 = Date.now();
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 30000);
	let res;
	try {
		res = await fetch(u, { method, headers, body: body === undefined || ['GET', 'HEAD'].includes(method) ? undefined : body, redirect: 'follow', signal: ctrl.signal });
	} catch (err) {
		throw new Error(err.name === 'AbortError' ? 'No answer within 30 seconds.' : `Request failed: ${err.cause ? err.cause.code || err.cause.message : err.message}`);
	} finally {
		clearTimeout(timer);
	}
	const buf = Buffer.from(await res.arrayBuffer());
	return { status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], body: buf.subarray(0, 5 * 1024 * 1024).toString('utf8'), ms: Date.now() - t0, url: res.url };
}

module.exports = { ping, traceroute, stop, lookup, ports, http };
