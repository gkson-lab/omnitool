// OmniTool self-test: opens an edition in a real Chromium (Chrome for the web edition, OmniTool's own Electron
// for desktop), visits every tool at desktop and phone widths in light and dark, runs each tool headless with its
// default inputs, clicks through the main flows, and writes tests/report-<edition>.json plus screenshots.
//
//   node tests/selftest.js web
//   node tests/selftest.js desktop
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { Cdp } = require('./cdp');
const { closeDesktopWindow } = require('./close-window');

const edition = process.argv[2] || 'web';
const root = path.resolve(__dirname, '..');
const shots = path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch() {
	if (edition === 'desktop') {
		const exe = path.join(root, 'desktop', 'app', 'node_modules', 'electron', 'dist', 'electron.exe');
		const child = spawn(exe, [path.join(root, 'desktop', 'app'), '--remote-debugging-port=9334'], { stdio: 'ignore' });
		return { child, exe, port: 9334, url: null };
	}
	const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
	const exe = candidates.find((c) => fs.existsSync(c));
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-test-'));
	const child = spawn(exe, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' });
	return { child, port: 9333, url: 'file:///' + path.join(root, 'web', 'index.html').replace(/\\/g, '/') };
}

const ERROR_HOOK = `
	window.__errs = [];
	window.addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || (e.target && e.target.src) || 'resource failed')), true);
	window.addEventListener('unhandledrejection', (e) => window.__errs.push('unhandled rejection: ' + (e.reason && e.reason.message || e.reason)));
`;

/** Runs in the page: visits one tool, runs it headless with defaults, and reports what went wrong. */
const TEST_TOOL = `async (id, runIt) => {
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const t = Omni.byId[id];
	const before = window.__errs.length;
	location.hash = '#/tool/' + id;
	await sleep(t.vendor || t.layout === 'flush' ? 1200 : 450);
	const main = document.getElementById('main');
	const out = { id, no: t.no };
	out.rendered = !!main.querySelector('h1') || t.layout === 'flush';
	const err = main.querySelector('.state-error');
	out.uiError = err ? err.textContent.trim().slice(0, 300) : null;
	out.overflow = Math.max(document.documentElement.scrollWidth, main.scrollWidth) > window.innerWidth + 1;
	if (out.overflow) {
		const wide = [...main.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.table-wrap, .readout, pre, .editor-shell, .mines, [style*="overflow"]')).slice(0, 3);
		out.overflowAt = wide.map((el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
		if (!out.overflowAt.length) out.overflow = false;
	}
	if (runIt && t.run && t.ai !== false && !t.inputs.some((i) => i.type === 'file')) {
		try {
			const r = await Promise.race([Omni.runTool(id, {}), sleep(15000).then(() => ({ error: 'timed out after 15 s' }))]);
			const s = Omni.forms.summarize(r);
			const e = s.find((b) => b.error);
			out.run = e ? 'error: ' + e.error : 'ok';
			out.sample = JSON.stringify(s).slice(0, 160);
		} catch (x) {
			out.run = 'threw: ' + x.message;
		}
	}
	out.errors = window.__errs.slice(before);
	return out;
}`;

/** Scripted click-through flows; each returns a short string describing what happened, or throws. */
const FLOWS = {
	palette: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/';
		await sleep(200);
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
		await sleep(250);
		const dlg = document.querySelector('dialog.palette[open]');
		if (!dlg) throw new Error('Ctrl+K did not open the palette');
		const input = dlg.querySelector('input');
		input.value = '044';
		input.dispatchEvent(new Event('input'));
		await sleep(100);
		const first = dlg.querySelector('li[aria-selected="true"]').textContent;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await sleep(300);
		if (location.hash !== '#/tool/base-converter') throw new Error('Enter went to ' + location.hash);
		return 'Ctrl+K opened the palette, "044" ranked "' + first.trim().slice(0, 40) + '" first, Enter opened ' + location.hash;
	}`,
	home_search: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/';
		await sleep(250);
		const input = document.querySelector('.home-search input');
		input.value = 'uuid';
		input.dispatchEvent(new Event('input'));
		await sleep(100);
		// The full catalog stays in the page, hidden, while results show; count only what is visible.
		const shown = [...document.querySelectorAll('#main .catalog a')].filter((a) => a.offsetParent !== null);
		const hits = shown.length;
		const top = shown.slice(0, 3).map((a) => a.querySelector('.name').textContent).join(', ');
		if (!/^ID generator/.test(top)) throw new Error('uuid did not put the ID generator first: ' + top);
		input.value = 'zzzzqqq';
		input.dispatchEvent(new Event('input'));
		await sleep(100);
		const empty = document.querySelector('#main .state');
		if (!empty) throw new Error('No empty state for a search with no matches');
		return 'search "uuid" listed ' + hits + ' tools, first ' + top + '; a nonsense search showed: ' + empty.textContent.trim().slice(0, 60);
	}`,
	pin_recent: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/hash';
		await sleep(400);
		const pin = [...document.querySelectorAll('#main button')].find((b) => /^Pin/.test(b.textContent));
		pin.click();
		await sleep(100);
		location.hash = '#/pinned';
		await sleep(250);
		const pinned = [...document.querySelectorAll('#main .catalog .name')].map((n) => n.textContent);
		if (!pinned.includes('Hash generator')) throw new Error('Pinned view lacks the tool');
		location.hash = '#/tool/hash';
		await sleep(300);
		[...document.querySelectorAll('#main button')].find((b) => /^Pinned/.test(b.textContent)).click();
		location.hash = '#/recent';
		await sleep(250);
		const recent = document.querySelectorAll('#main .catalog a').length;
		return 'pinned and unpinned Hash generator; Recent lists ' + recent + ' tools';
	}`,
	theme: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		const seg = document.querySelector('.sidebar-foot .seg');
		const btn = (label) => [...seg.querySelectorAll('button')].find((b) => b.textContent === label);
		btn('Dark').click();
		await sleep(100);
		const darkBg = getComputedStyle(document.body).backgroundColor;
		btn('Light').click();
		await sleep(100);
		const lightBg = getComputedStyle(document.body).backgroundColor;
		btn('System').click();
		if (darkBg === lightBg) throw new Error('Theme switch did not change the background');
		return 'Dark body ' + darkBg + ', Light body ' + lightBg + ', back to System';
	}`,
	agent_offline: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		await Omni.secrets.clear('anthropic');
		Omni.toggleAgent(true);
		await sleep(200);
		const log = document.querySelector('.agent-log');
		const before = log.querySelectorAll('.msg').length;
		Omni.agent.ask('generate 10 uuids and save them to a file called test-ids.txt');
		let card = null;
		for (let i = 0; i < 40 && !card; i++) {
			await sleep(150);
			card = log.querySelector('.approval');
		}
		if (!card) throw new Error('No approval card appeared: ' + log.textContent.slice(-300));
		const steps = [...log.querySelectorAll('.steps li')].map((li) => li.querySelector('.step-name').textContent);
		const title = card.querySelector('h3').textContent;
		card.querySelector('.btn-primary').click();
		await sleep(800);
		const status = card.querySelector('.muted').textContent;
		const after = log.querySelectorAll('.msg').length;
		Omni.toggleAgent(false);
		return 'offline agent ran steps [' + steps.join(', ') + ']; approval "' + title + '" -> ' + status + '; messages ' + before + ' -> ' + after;
	}`,
	agent_unknown: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		Omni.toggleAgent(true);
		Omni.agent.ask('what is the meaning of life');
		await sleep(600);
		const last = [...document.querySelectorAll('.agent-log .msg')].pop().textContent;
		Omni.toggleAgent(false);
		if (!/offline mode could not/i.test(last)) throw new Error('Unexpected reply: ' + last.slice(0, 200));
		return 'unknown command answered honestly: ' + last.replace(/\\s+/g, ' ').slice(14, 120);
	}`,
	agent_convert: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		Omni.toggleAgent(true);
		Omni.agent.ask('convert 72 F to C');
		await sleep(900);
		const last = [...document.querySelectorAll('.agent-log .msg')].pop().textContent;
		Omni.toggleAgent(false);
		if (!/22\\.2/.test(last)) throw new Error('Expected 22.2 C, got: ' + last.slice(0, 200));
		return 'offline "convert 72 F to C" answered ' + (last.match(/72[^\\n]*Celsius/) || [''])[0];
	}`,
	todo: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/todo';
		await sleep(400);
		const input = document.getElementById('todo-text');
		input.value = 'Selftest task';
		input.closest('form').requestSubmit();
		await sleep(150);
		const row = [...document.querySelectorAll('#main .list li')].find((li) => li.textContent.includes('Selftest task'));
		if (!row) throw new Error('Task did not appear');
		row.querySelector('input[type=checkbox]').click();
		await sleep(150);
		const counts = document.querySelector('#main p[role=status]').textContent;
		const done = [...document.querySelectorAll('#main .seg button')].find((b) => b.textContent === 'Done');
		done.click();
		await sleep(100);
		const shown = [...document.querySelectorAll('#main .list li')].some((li) => li.textContent.includes('Selftest task'));
		[...document.querySelectorAll('#main .list li')].filter((li) => li.textContent.includes('Selftest task')).forEach((li) => [...li.querySelectorAll('button')].pop().click());
		return 'added, completed (' + counts + '), visible under Done: ' + shown + ', deleted';
	}`,
	notes: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/notes';
		await sleep(700);
		[...document.querySelectorAll('#main button')].find((b) => /New note/.test(b.textContent)).click();
		await sleep(150);
		const title = document.getElementById('note-title');
		title.value = 'Selftest note';
		title.dispatchEvent(new Event('input'));
		const body = document.getElementById('note-body');
		body.value = '# Heading\\n\\n**bold** text';
		body.dispatchEvent(new Event('input'));
		await sleep(400);
		[...document.querySelectorAll('#main button')].find((b) => b.textContent === 'Preview').click();
		await sleep(150);
		const html = document.querySelector('#main .msg-body.panel').innerHTML;
		if (!/<h1|<strong/.test(html)) throw new Error('Preview did not render Markdown');
		const listed = document.querySelector('#main .list').textContent.includes('Selftest note');
		return 'created a note, preview rendered ' + (html.match(/<(h1|strong)/g) || []).join(' ') + ', listed: ' + listed;
	}`,
	kanban: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/kanban';
		await sleep(400);
		const first = document.querySelector('#main section');
		const input = first.querySelector('form input');
		input.value = 'Selftest card';
		first.querySelector('form').requestSubmit();
		await sleep(150);
		const card = [...document.querySelectorAll('#main [data-card]')].find((li) => li.textContent.includes('Selftest card'));
		card.querySelector('[data-act="right"]').click();
		await sleep(150);
		const second = document.querySelectorAll('#main section')[1];
		const moved = second.textContent.includes('Selftest card');
		const again = [...document.querySelectorAll('#main [data-card]')].find((li) => li.textContent.includes('Selftest card'));
		[...again.querySelectorAll('button')].pop().click();
		return 'added a card to "' + first.querySelector('h2').firstChild.textContent + '", moved right: ' + moved + ', deleted';
	}`,
	calendar: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/calendar';
		await sleep(400);
		const t = document.getElementById('ev-title');
		t.value = 'Selftest event';
		t.closest('form').requestSubmit();
		await sleep(150);
		const listed = document.querySelector('#main .list') && document.querySelector('#main .list').textContent.includes('Selftest event');
		const cells = document.querySelectorAll('#main [role=gridcell]').length;
		[...document.querySelectorAll('#main .list li')].filter((li) => li.textContent.includes('Selftest event')).forEach((li) => li.querySelector('button').click());
		return cells + ' day cells, event added and listed: ' + listed + ', deleted';
	}`,
	timers: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/stopwatch';
		await sleep(300);
		const btn = (t) => [...document.querySelectorAll('#main button')].find((b) => b.textContent === t);
		btn('Start').click();
		await sleep(400);
		btn('Lap').click();
		await sleep(200);
		btn('Stop').click();
		const shown = document.querySelector('#main [role=timer]').textContent;
		const laps = document.querySelectorAll('#main tbody tr').length;
		btn('Reset').click();
		location.hash = '#/tool/pomodoro';
		await sleep(300);
		btn('Start').click();
		await sleep(1200);
		const pomo = document.querySelector('#main [role=timer]').textContent;
		btn('Pause').click();
		btn('Reset').click();
		return 'stopwatch showed ' + shown + ' with ' + laps + ' lap; pomodoro counted down to ' + pomo + ' then reset';
	}`,
	games: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/game-2048';
		await sleep(300);
		const board = document.querySelector('#main .game-board');
		const before = board.textContent;
		for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) board.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
		await sleep(100);
		const moved = board.textContent !== before;
		location.hash = '#/tool/minesweeper';
		await sleep(300);
		document.querySelector('#main .mines button').click();
		await sleep(100);
		const opened = document.querySelectorAll('#main .mines button.open').length;
		location.hash = '#/tool/snake';
		await sleep(300);
		[...document.querySelectorAll('#main button')].find((b) => b.textContent === 'Start').click();
		await sleep(500);
		const status = document.querySelector('#main [role=status]').textContent;
		location.hash = '#/';
		return '2048 tiles moved: ' + moved + '; minesweeper first click opened ' + opened + ' cells; snake: ' + status;
	}`,
	settings_key: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/settings';
		await sleep(500);
		const key = document.getElementById('ai-key');
		key.value = 'sk-ant-selftest-not-a-real-key';
		[...document.querySelectorAll('#main button')].find((b) => b.textContent === 'Save key').click();
		await sleep(400);
		const status = document.querySelector('#main section p[role=status]').textContent;
		const mode = await Omni.ai.mode();
		[...document.querySelectorAll('#main button')].find((b) => b.textContent === 'Test the connection').click();
		let test = '';
		for (let i = 0; i < 60 && !/failed|Connected/.test(test); i++) {
			await sleep(250);
			test = (document.querySelector('#main [aria-live=polite] .state') || {}).textContent || '';
		}
		[...document.querySelectorAll('#main button')].find((b) => b.textContent === 'Remove key').click();
		await sleep(200);
		document.querySelector('dialog[open] .btn-primary').click();
		await sleep(300);
		return 'saved key -> mode ' + mode + ' (' + status.slice(0, 50) + '); test with a fake key: ' + test.replace(/\\s+/g, ' ').slice(0, 140) + '; removed -> ' + (await Omni.ai.mode());
	}`,
	codepad: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/codepad';
		await sleep(1200);
		Omni.codepad.write('console.log("from selftest")', 'selftest.js');
		await sleep(300);
		const tabs = [...document.querySelectorAll('#main .editor-tab')].map((t) => t.textContent);
		const cm = document.querySelector('#main .CodeMirror');
		const text = cm ? cm.CodeMirror.getValue() : null;
		const state = Omni.codepad.state();
		return 'CodeMirror loaded: ' + !!cm + '; tabs ' + tabs.length + '; active "' + state.active.name + '" shows ' + JSON.stringify(text);
	}`,
	mobile_menu: `async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		location.hash = '#/tool/hash';
		await sleep(300);
		const btn = document.getElementById('menu-button');
		if (!btn.offsetParent) return 'menu button hidden at this width (desktop layout)';
		btn.click();
		await sleep(300);
		const open = document.querySelector('.app').classList.contains('menu-open');
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await sleep(300);
		const closed = !document.querySelector('.app').classList.contains('menu-open');
		return 'Tools menu opened: ' + open + ', Escape closed it: ' + closed;
	}`,
};

async function main() {
	const { child, exe, port, url } = launch();
	const report = { edition, started: new Date().toISOString(), passes: {}, flows: {}, console: [] };
	let cdp;
	try {
		cdp = await Cdp.connect(port, edition === 'desktop' ? (t) => /index\.html/.test(t.url) : null);
		await cdp.send('Page.enable');
		await cdp.send('Runtime.enable');
		cdp.on('Runtime.consoleAPICalled', (p) => {
			if (p.type === 'error' || p.type === 'warning') report.console.push(`${p.type}: ${p.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300)}`);
		});
		cdp.on('Runtime.exceptionThrown', (p) => report.console.push(`exception: ${p.exceptionDetails.exception ? p.exceptionDetails.exception.description.slice(0, 300) : p.exceptionDetails.text}`));
		await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: ERROR_HOOK });
		if (url) {
			const downloads = path.join(__dirname, 'downloads');
			fs.mkdirSync(downloads, { recursive: true });
			await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }).catch(() => {});
			await cdp.send('Page.navigate', { url });
		} else await cdp.send('Page.reload');
		for (let i = 0; i < 100; i++) {
			await sleep(200);
			if (await cdp.eval('!!(window.Omni && document.querySelector(".app"))').catch(() => false)) break;
		}
		report.tools = await cdp.eval('Omni.tools.length');
		report.bootErrors = await cdp.eval('window.__errs');
		const ids = await cdp.eval('Omni.sortedTools().map((t) => t.id)');

		const passes = [
			{ name: 'desktop-light', width: 1280, height: 860, mobile: false, theme: 'light', run: true },
			{ name: 'desktop-dark', width: 1280, height: 860, mobile: false, theme: 'dark', run: false },
			{ name: 'phone-light', width: 375, height: 812, mobile: true, theme: 'light', run: false },
			{ name: 'tablet-dark', width: 820, height: 1100, mobile: false, theme: 'dark', run: false },
		];
		for (const pass of passes) {
			await cdp.send('Emulation.setDeviceMetricsOverride', { width: pass.width, height: pass.height, deviceScaleFactor: 1, mobile: pass.mobile });
			await cdp.eval(`Omni.store.set('theme', '${pass.theme}'); document.documentElement.setAttribute('data-theme', '${pass.theme}'); Omni.emit('theme', '${pass.theme}'); true`);
			const results = [];
			for (const id of ids) {
				if (id === 'labscode' && pass.name !== 'desktop-light') continue;
				const r = await cdp.eval(`(${TEST_TOOL})(${JSON.stringify(id)}, ${pass.run})`, 90000).catch((err) => ({ id, harnessError: err.message }));
				results.push(r);
			}
			report.passes[pass.name] = results;
			for (const page of ['#/', '#/tool/regex-tester', '#/tool/password', '#/tool/graphing', '#/settings']) {
				await cdp.eval(`location.hash = '${page}'; new Promise((r) => setTimeout(r, 900))`);
				const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
				fs.writeFileSync(path.join(shots, `${edition}-${pass.name}-${page.replace(/[#/]+/g, '_') || 'home'}.png`), Buffer.from(shot.data, 'base64'));
			}
		}
		await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
		await cdp.eval(`Omni.store.set('theme', 'system'); document.documentElement.removeAttribute('data-theme'); true`);
		for (const [name, fn] of Object.entries(FLOWS)) {
			report.flows[name] = await cdp.eval(`(${fn})()`, 60000).then((v) => ({ ok: true, detail: v }), (err) => ({ ok: false, detail: err.message }));
		}
		await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
		report.flows.mobile_menu_phone = await cdp.eval(`(${FLOWS.mobile_menu})()`).then((v) => ({ ok: true, detail: v }), (err) => ({ ok: false, detail: err.message }));
	} finally {
		if (cdp) {
			if (edition === 'desktop') closeDesktopWindow(exe);
			else await cdp.eval('window.close(); true', 5000).catch(() => {});
			cdp.close();
		}
		for (let i = 0; i < 40 && child.exitCode === null; i++) await sleep(250);
		if (child.exitCode === null) child.kill();
	}

	fs.writeFileSync(path.join(__dirname, `report-${edition}.json`), JSON.stringify(report, null, 2));
	const problems = [];
	for (const [name, results] of Object.entries(report.passes)) {
		for (const r of results) {
			const bad = [r.harnessError && `harness: ${r.harnessError}`, r.rendered === false && 'did not render', r.uiError && `ui error: ${r.uiError}`, r.overflow && `horizontal overflow at ${(r.overflowAt || []).join(', ')}`, r.run && r.run !== 'ok' && `run ${r.run}`, r.errors && r.errors.length && `errors: ${r.errors.join(' | ')}`].filter(Boolean);
			if (bad.length) problems.push(`${name} ${String(r.no).padStart(3, '0')} ${r.id}: ${bad.join('; ')}`);
		}
	}
	console.log(`${edition}: ${report.tools} tools registered; boot errors: ${report.bootErrors.length}`);
	console.log(`Tool checks: ${Object.values(report.passes).reduce((n, r) => n + r.length, 0)} page visits, ${problems.length} with problems`);
	problems.forEach((p) => console.log('  ' + p));
	console.log('Flows:');
	Object.entries(report.flows).forEach(([n, f]) => console.log(`  ${f.ok ? 'PASS' : 'FAIL'} ${n}: ${f.detail}`));
	const consoleIssues = [...new Set(report.console)];
	console.log(`Console errors and warnings: ${consoleIssues.length}`);
	consoleIssues.slice(0, 40).forEach((c) => console.log('  ' + c));
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
