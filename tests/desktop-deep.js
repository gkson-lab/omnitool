// Exercises the desktop edition's native backends for real (processes, network, git, scripts, files, clipboard,
// capture, server, LabsCode bridge) through the same window.omniNative API the tools use.
//   node tests/desktop-deep.js [scratch folder]
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { Cdp } = require('./cdp');
const { closeDesktopWindow } = require('./close-window');

const root = path.resolve(__dirname, '..');
const scratch = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-deep-')));
fs.mkdirSync(scratch, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHECKS = {
	system: `async () => {
		const i = await omniNative.sys.info();
		const p = await omniNative.sys.processes();
		const d = await omniNative.sys.disks();
		const e = await omniNative.sys.env();
		return i.os.name + ' ' + i.os.release + ', ' + i.cpu.cores + ' cores; ' + p.length + ' processes; drives ' + d.map((x) => x.mount).join(' ') + '; PATH entries ' + e.path.length;
	}`,
	kill_guard: `async () => {
		try { await omniNative.sys.kill(4); return 'FAILED: PID 4 was accepted'; } catch (e) { return 'refused PID 4: ' + e.message; }
	}`,
	dns_ports: `async () => {
		const a = await omniNative.net.dns('example.com', 'A');
		const mx = await omniNative.net.dns('gmail.com', 'MX');
		const ports = await omniNative.net.ports('127.0.0.1', [1, 9], 400);
		return 'example.com A ' + a.join(', ') + '; gmail MX ' + mx.length + '; 127.0.0.1 ports ' + ports.map((p) => p.port + '=' + (p.open ? 'open' : p.error)).join(' ');
	}`,
	ping_trace: `async () => {
		const lines = [];
		const job = omniNative.net.ping('127.0.0.1', 2, (l) => lines.push(l));
		await job.done;
		const hops = [];
		const t = omniNative.net.traceroute('127.0.0.1', 2, (l) => hops.push(l));
		await t.done;
		let rejected = '';
		try { omniNative.net.ping('-n 5 x', 1, () => {}); } catch (e) { rejected = e.message; }
		return 'ping lines with a reply: ' + lines.filter((l) => /TTL=/i.test(l)).length + '; tracert lines: ' + hops.filter(Boolean).length + '; injected host: ' + (rejected || 'not rejected synchronously');
	}`,
	ping_injection: `async () => {
		const job = omniNative.net.ping('-n 5 x', 1, () => {});
		try { await job.done; return 'FAILED: accepted'; } catch (e) { return 'rejected: ' + e.message; }
	}`,
	git: `async () => {
		const r = await omniNative.git.inspect(${JSON.stringify(path.resolve(root, '..'))});
		const d = await omniNative.git.diff(${JSON.stringify(path.resolve(root, '..'))});
		return 'branch ' + r.branch + ', ' + r.log.length + ' commits listed, ' + r.status.length + ' changed paths; diff loaded (' + (d.staged ? 'staged' : 'unstaged') + ', ' + d.diff.length + ' chars)';
	}`,
	scripts: `async () => {
		const py = await omniNative.script.run({ lang: 'python', code: 'print(6*7)', timeoutMs: 20000 });
		const node = await omniNative.script.run({ lang: 'node', code: 'console.log(process.versions.node)', timeoutMs: 20000 });
		const ps = await omniNative.script.run({ lang: 'powershell', code: 'Write-Output (2+3)', timeoutMs: 30000 });
		const slow = await omniNative.script.run({ lang: 'node', code: 'while(true){}', timeoutMs: 1500 });
		return 'python -> ' + py.stdout.trim() + ' (' + py.runtime + '); node -> ' + node.stdout.trim() + '; powershell -> ' + ps.stdout.trim() + '; endless loop timed out: ' + slow.timedOut;
	}`,
	agent_fs: `async () => {
		const root = omniNative.agentFs.root();
		const w = await omniNative.agentFs.write('deep-test/hello.txt', 'hello from the deep test');
		const r = await omniNative.agentFs.read('deep-test/hello.txt');
		const escape = await omniNative.agentFs.resolve('../../Windows/win.ini');
		let blocked = '';
		try { await omniNative.agentFs.read('C:/Windows/win.ini'); } catch (e) { blocked = e.message.slice(0, 60); }
		const del = await omniNative.agentFs.remove('deep-test/hello.txt');
		return 'root ' + root + '; wrote ' + w.bytes + ' bytes, read back ' + JSON.stringify(r.text) + '; ../.. escape allowed: ' + escape.allowed + '; C:/Windows read: ' + blocked + '; delete: ' + del.note;
	}`,
	files_guard: `async () => {
		try { await omniNative.fs.writeText('C:/Users/Public/omnitool-should-not-exist.txt', 'x'); return 'FAILED: wrote without a dialog'; } catch (e) { return 'write without a dialog refused: ' + e.message; }
	}`,
	server: `async () => {
		await omniNative.server.start(${JSON.stringify(path.join(root, 'web'))}, 8765);
		const s = await omniNative.server.status();
		const res = await omniNative.net.http({ method: 'GET', url: 'http://127.0.0.1:8765/index.html', headers: {} });
		const trav = await omniNative.net.http({ method: 'GET', url: 'http://127.0.0.1:8765/..%2f..%2fdesktop%2fstart.bat', headers: {} });
		await omniNative.server.stop();
		return 'served ' + s.url + ': index.html ' + res.status + ' (' + res.body.length + ' bytes); traversal attempt ' + trav.status + '; stopped';
	}`,
	http: `async () => {
		const r = await omniNative.net.http({ method: 'GET', url: 'https://httpbin.org/headers', headers: { 'X-Omni': 'deep' } });
		return 'httpbin ' + r.status + ' in ' + r.ms + ' ms, echoed header: ' + /X-Omni/.test(r.body);
	}`,
	rename_scaffold: `async () => {
		const base = ${JSON.stringify(scratch)};
		const dir = await omniNative.scaffold.create(base, 'proj-' + Date.now(), { 'a.txt': '1', 'b.txt': '2', 'sub/c.md': '3' });
		const before = await omniNative.rename.list(dir);
		const r = await omniNative.rename.apply(dir, [{ from: 'a.txt', to: 'b.txt' }, { from: 'b.txt', to: 'a.txt' }]);
		const after = await omniNative.rename.list(dir);
		let dup = '';
		try { await omniNative.scaffold.create(base, dir.split(/[\\\\/]/).pop(), { 'x.txt': '' }); } catch (e) { dup = e.message.slice(-40); }
		return 'scaffolded ' + before.join(',') + '; swapped a<->b: renamed ' + r.renamed + ', now ' + after.join(',') + '; same name again: ' + dup;
	}`,
	clipboard: `async () => {
		await omniNative.clipboard.setRecording(true);
		await new Promise((r) => setTimeout(r, 1500));
		const marker = 'omnitool-clip-' + Date.now();
		await omniNative.clipboard.write(marker);
		await new Promise((r) => setTimeout(r, 2500));
		const h = await omniNative.clipboard.history();
		const hit = h.find((x) => x.text === marker);
		if (hit) await omniNative.clipboard.remove(hit.id);
		return 'history has the copied marker: ' + !!hit + ' (' + h.length + ' entries, text type ' + typeof (h[0] && h[0].text) + ')';
	}`,
	capture: `async () => {
		const s = await omniNative.capture.sources();
		const screen = s.find((x) => x.id.startsWith('screen'));
		const png = await omniNative.capture.grab(screen.id);
		return s.length + ' sources; grabbed ' + screen.name + ' as ' + Math.round(png.length / 1024) + ' KB of PNG data';
	}`,
	folder_size: `async () => {
		const r = await omniNative.sys.folderSize(${JSON.stringify(path.join(root, 'shared'))});
		return r.files + ' files in ' + r.dirs + ' folders, ' + Math.round(r.total / 1024) + ' KB; largest ' + r.largest[0].path.split(/[\\\\/]/).pop() + ' (' + Math.round(r.largest[0].size / 1024) + ' KB); cancelled ' + r.cancelled;
	}`,
	labscode: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/labscode';
		let st = await omniNative.labscode.status();
		for (let i = 0; i < 120 && !(st.running && st.bridge); i++) { await sleep(500); st = await omniNative.labscode.status(); }
		if (!st.running) return 'FAILED: LabsCode did not start: ' + JSON.stringify(st);
		await omniNative.labscode.bridge('POST', '/open', { path: ${JSON.stringify(path.join(scratch, 'bridge-test.js'))}, line: 1 });
		await sleep(1500);
		const s1 = await omniNative.labscode.bridge('GET', '/state');
		const res = await omniNative.labscode.bridge('POST', '/replace', { uri: s1.file.uri, text: s1.file.text + '\\n// edited through the OmniTool bridge\\n', version: s1.file.version });
		const s2 = await omniNative.labscode.bridge('GET', '/state');
		let stale = '';
		try { await omniNative.labscode.bridge('POST', '/replace', { uri: s1.file.uri, text: 'x', version: s1.file.version }); } catch (e) { stale = e.message.slice(0, 60); }
		return 'mode ' + st.mode + ', bridge up; active file ' + s1.file.name + ' (' + s1.file.languageId + '); replace applied: ' + res.applied + ', now dirty: ' + s2.file.isDirty + '; stale version refused: ' + stale;
	}`,
};

async function main() {
	fs.writeFileSync(path.join(scratch, 'bridge-test.js'), 'const answer = 42;\nconsole.log(answer);\n');
	const exe = path.join(root, 'desktop', 'app', 'node_modules', 'electron', 'dist', 'electron.exe');
	const child = spawn(exe, [path.join(root, 'desktop', 'app'), '--remote-debugging-port=9336'], { stdio: 'ignore' });
	const cdp = await Cdp.connect(9336, (t) => /index\.html/.test(t.url));
	await cdp.send('Runtime.enable');
	for (let i = 0; i < 100 && !(await cdp.eval('!!(window.Omni && document.querySelector(".app"))').catch(() => false)); i++) await sleep(200);
	const only = process.argv[3] ? process.argv[3].split(',') : null;
	for (const [name, fn] of Object.entries(CHECKS)) {
		if (only && !only.includes(name)) continue;
		const r = await cdp.eval(`(${fn})()`, 180000).then((v) => ({ ok: !/FAILED/.test(v), v }), (e) => ({ ok: false, v: e.message }));
		console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name}: ${r.v}`);
	}
	if (process.env.KEEP_OPEN) return;
	closeDesktopWindow(exe);
	cdp.close();
	for (let i = 0; i < 40 && child.exitCode === null; i++) await sleep(250);
	if (child.exitCode === null) child.kill();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
