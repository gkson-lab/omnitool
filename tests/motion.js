// Checks OmniTool's motion in a real browser: every effect fires where DESIGN.md says, finishes, leaves nothing looping
// on an idle screen, and turns off completely under reduced motion. Web edition, headless Chrome.
//   node tests/motion.js
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { Cdp } = require('./cdp');

const root = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'file:///' + path.join(root, 'web', 'index.html').replace(/\\/g, '/');

// Page-side helpers, installed once per load.
const HELPERS = `(() => {
	window.__vt = 0;
	if (document.startViewTransition) {
		const real = document.startViewTransition.bind(document);
		document.startViewTransition = (cb) => { window.__vt++; return real(cb); };
	}
	window.__loops = () => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => (a.effect.target && (a.effect.target.className || a.effect.target.tagName)) + ' ' + (a.animationName || 'script'));
	window.__aligned = (a, b) => { if (!a || !b) return false; const x = a.getBoundingClientRect(); const y = b.getBoundingClientRect(); return Math.abs(x.top - y.top) < 2 && Math.abs(x.left - y.left) < 2 && Math.abs(x.width - y.width) < 2; };
	return true;
})()`;

const CHECKS = {
	idle_catalog: `async () => {
		location.hash = '#/';
		await new Promise((r) => setTimeout(r, 1500));
		const loops = __loops();
		if (loops.length) throw new Error('looping at rest: ' + loops.join(', '));
		return 'no endless animation on the idle catalog';
	}`,
	route_morph: `async () => {
		const before = __vt;
		const row = document.querySelector('.catalog a[data-key="base-converter"]');
		row.scrollIntoView({ block: 'center' });
		row.click();
		await new Promise((r) => setTimeout(r, 120));
		const entering = document.querySelectorAll('.enter-item').length;
		await new Promise((r) => setTimeout(r, 900));
		const named = [...document.querySelectorAll('*')].filter((el) => el.style.viewTransitionName).length;
		const left = document.querySelectorAll('.enter-item').length;
		if (__vt <= before) throw new Error('no view transition ran');
		if (named) throw new Error(named + ' elements kept a view-transition-name');
		if (!entering || left) throw new Error('entrance: ' + entering + ' parts entering, ' + left + ' still marked after');
		return 'view transition ran; ' + entering + ' page parts entered in order and finished; no names left behind';
	}`,
	nav_marker: `async () => {
		await new Promise((r) => setTimeout(r, 400));
		const marker = document.querySelector('.nav-marker');
		const current = document.querySelector('.nav-item[aria-current="page"]');
		if (!__aligned(marker, current)) throw new Error('marker not on ' + (current && current.textContent));
		return 'sidebar marker sits on "' + current.textContent.replace(/\\d+$/, '') + '"';
	}`,
	value_roll: `async () => {
		const input = document.querySelector('#main textarea, #main input[type=text]');
		input.value = '255';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await new Promise((r) => setTimeout(r, 450));
		input.value = '4095';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		let rolled = 0;
		for (let i = 0; i < 20 && !rolled; i++) {
			await new Promise((r) => setTimeout(r, 25));
			rolled = document.querySelectorAll('#main .roll-out').length;
		}
		await new Promise((r) => setTimeout(r, 400));
		if (!rolled) throw new Error('no value rolled');
		if (document.querySelectorAll('#main .roll-out').length) throw new Error('roll ghosts left behind');
		return rolled + ' changed readings rolled, and the old values were cleaned up';
	}`,
	copy_check: `async () => {
		const btn = document.querySelector('#main .copy');
		btn.click();
		await new Promise((r) => setTimeout(r, 200));
		const during = btn.textContent;
		await new Promise((r) => setTimeout(r, 1500));
		if (during !== 'Copied' || btn.textContent !== 'Copy') throw new Error('copy button read "' + during + '" then "' + btn.textContent + '"');
		return 'copy button showed "Copied" with a check, then went back to "Copy"';
	}`,
	tool_bar: `async () => {
		location.hash = '#/tool/calendar';
		await new Promise((r) => setTimeout(r, 900));
		const view = document.querySelector('#main');
		view.scrollTop = view.scrollHeight;
		await new Promise((r) => setTimeout(r, 400));
		const shown = document.querySelector('.tool-bar.shown');
		view.scrollTop = 0;
		await new Promise((r) => setTimeout(r, 400));
		const hidden = !document.querySelector('.tool-bar.shown');
		if (!shown || !hidden) throw new Error('tool bar shown: ' + !!shown + ', hidden again at top: ' + hidden);
		return 'the slim tool bar pinned when scrolled down and left again at the top';
	}`,
	chance: `async () => {
		location.hash = '#/tool/coin';
		await new Promise((r) => setTimeout(r, 900));
		const form = document.querySelector('#main form');
		const count = form.querySelector('input[type=number]');
		if (count) { count.value = '1'; count.dispatchEvent(new Event('input', { bubbles: true })); }
		const results = [];
		for (let k = 0; k < 2; k++) {
			form.requestSubmit();
			let scrambling = false;
			for (let i = 0; i < 10 && !scrambling; i++) {
				await new Promise((r) => setTimeout(r, 30));
				scrambling = !!document.querySelector('#main .scrambling');
			}
			await new Promise((r) => setTimeout(r, 700));
			const big = document.querySelector('#main .readout.big');
			results.push((scrambling ? 'scrambled, ' : 'no scramble, ') + (big && big.textContent));
		}
		if (!results.every((r) => /^scrambled, (Heads|Tails)$/.test(r))) throw new Error(results.join(' | '));
		return 'two flips: ' + results.join(' | ');
	}`,
	game_2048: `async () => {
		location.hash = '#/tool/game-2048';
		await new Promise((r) => setTimeout(r, 900));
		const board = document.querySelector('.game-board');
		const sum = () => [...board.children].reduce((n, t) => n + (Number(t.textContent) || 0), 0);
		let moved = false;
		for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
			const before = sum();
			board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
			await new Promise((r) => setTimeout(r, 30));
			const anims = [...board.querySelectorAll('.tile')].flatMap((t) => t.getAnimations()).length;
			const after = sum();
			if (after !== before && anims) {
				moved = 'tiles animated (' + anims + ' animations); board total ' + before + ' -> ' + after + ' (one new tile)';
				break;
			}
			await new Promise((r) => setTimeout(r, 300));
		}
		if (!moved) throw new Error('no animated move');
		return moved;
	}`,
	minesweeper: `async () => {
		location.hash = '#/tool/minesweeper';
		await new Promise((r) => setTimeout(r, 900));
		const cells = document.querySelectorAll('.mines button');
		cells[Math.floor(cells.length / 2)].click();
		await new Promise((r) => setTimeout(r, 30));
		const opened = [...document.querySelectorAll('.mines button.revealed')];
		const delays = new Set(opened.map((b) => b.style.getPropertyValue('--d')));
		if (opened.length < 2 || delays.size < 2) throw new Error(opened.length + ' cells revealed with ' + delays.size + ' distinct delays');
		return opened.length + ' cells opened outward in ' + delays.size + ' rings';
	}`,
	seg_thumb: `async () => {
		const dark = [...document.querySelectorAll('.sidebar .seg button')].find((b) => b.textContent === 'Dark');
		dark.click();
		await new Promise((r) => setTimeout(r, 700));
		const thumb = dark.parentNode.querySelector('.seg-thumb');
		const ok = __aligned(thumb, dark) && document.documentElement.getAttribute('data-theme') === 'dark';
		const sys = [...document.querySelectorAll('.sidebar .seg button')].find((b) => b.textContent === 'System');
		sys.click();
		await new Promise((r) => setTimeout(r, 700));
		if (!ok || !__aligned(thumb, sys)) throw new Error('thumb did not follow the theme switch');
		return 'theme switch thumb slid to Dark and back to System; theme changed with it';
	}`,
	toast_life: `async () => {
		Omni.ui.toast('Motion test toast');
		const t = [...document.querySelectorAll('.toast')].pop();
		const life = t.style.getPropertyValue('--toast-life');
		const line = getComputedStyle(t, '::after').animationName;
		await new Promise((r) => setTimeout(r, 4500));
		if (t.isConnected) throw new Error('toast still there after 4.5 s');
		return 'toast had a ' + life + ' countdown line (' + line + ') and left on time';
	}`,
	dialog_exit: `async () => {
		Omni.openPalette();
		await new Promise((r) => setTimeout(r, 300));
		const dlg = document.querySelector('dialog.palette');
		const input = dlg.querySelector('input');
		input.value = 'json';
		input.dispatchEvent(new Event('input'));
		await new Promise((r) => setTimeout(r, 300));
		const marker = dlg.querySelector('.palette-marker');
		const first = __aligned(marker, dlg.querySelector('li[aria-selected="true"]'));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await new Promise((r) => setTimeout(r, 350));
		const second = __aligned(marker, dlg.querySelector('li[aria-selected="true"]'));
		dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
		await new Promise((r) => setTimeout(r, 40));
		const closing = dlg.classList.contains('closing');
		await new Promise((r) => setTimeout(r, 400));
		if (!first || !second || !closing || dlg.isConnected) throw new Error('marker ' + first + '/' + second + ', closing ' + closing + ', removed ' + !dlg.isConnected);
		return 'palette selection marker followed Down; Escape played the exit and removed the dialog';
	}`,
	idle_tool: `async () => {
		location.hash = '#/tool/json-formatter';
		await new Promise((r) => setTimeout(r, 1500));
		const loops = __loops();
		if (loops.length) throw new Error('looping at rest: ' + loops.join(', '));
		return 'no endless animation on an idle tool page';
	}`,
};

const REDUCED = `async () => {
	const before = __vt;
	location.hash = '#/tool/base-converter';
	await new Promise((r) => setTimeout(r, 60));
	const running = document.getAnimations().filter((a) => a.playState === 'running').length;
	const entering = document.querySelectorAll('.enter-item').length;
	location.hash = '#/';
	await new Promise((r) => setTimeout(r, 60));
	if (__vt !== before || running || entering) throw new Error('view transitions ' + (__vt - before) + ', running animations ' + running + ', entering parts ' + entering);
	return 'no view transition, no running animation and no staged entrance';
}`;

async function load(cdp) {
	await cdp.send('Page.navigate', { url: URL });
	for (let i = 0; i < 100 && !(await cdp.eval('!!(window.Omni && Omni.motion && document.querySelector(".app"))').catch(() => false)); i++) await sleep(200);
	await cdp.eval(HELPERS);
}

async function main() {
	const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((c) => fs.existsSync(c));
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-motion-'));
	const child = spawn(exe, ['--headless=new', '--remote-debugging-port=9344', `--user-data-dir=${profile}`, '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' });
	const cdp = await Cdp.connect(9344);
	const errors = [];
	const results = [];
	try {
		await cdp.send('Page.enable');
		await cdp.send('Runtime.enable');
		cdp.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails.exception ? p.exceptionDetails.exception.description.split('\n')[0] : p.exceptionDetails.text));
		cdp.on('Runtime.consoleAPICalled', (p) => ['error', 'warning'].includes(p.type) && errors.push(p.type + ': ' + p.args.map((a) => a.value || a.description).join(' ')));
		await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
		await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
		await load(cdp);
		for (const [name, fn] of Object.entries(CHECKS)) {
			// The pinned tool bar only matters on a page that scrolls, so that check runs in a short window.
			if (name === 'tool_bar') await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 480, deviceScaleFactor: 1, mobile: false });
			const r = await cdp.eval(`(${fn})()`, 30000).then((v) => ({ ok: true, v }), (e) => ({ ok: false, v: e.message }));
			if (name === 'tool_bar') await cdp.send('Emulation.clearDeviceMetricsOverride');
			results.push(`${r.ok ? 'PASS' : 'FAIL'} ${name}: ${r.v}`);
		}
		await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
		await load(cdp);
		await sleep(500);
		const r = await cdp.eval(`(${REDUCED})()`, 30000).then((v) => ({ ok: true, v }), (e) => ({ ok: false, v: e.message }));
		results.push(`${r.ok ? 'PASS' : 'FAIL'} reduced_motion: ${r.v}`);
	} finally {
		await cdp.eval('window.close(); true', 3000).catch(() => {});
		cdp.close();
		for (let i = 0; i < 20 && child.exitCode === null; i++) await sleep(250);
		if (child.exitCode === null) child.kill();
	}
	results.forEach((l) => console.log(l));
	console.log(`Page errors and warnings: ${errors.length}`);
	errors.slice(0, 10).forEach((e) => console.log('  ' + e));
	const failed = results.filter((l) => l.startsWith('FAIL')).length;
	console.log(`${results.length - failed} of ${results.length} motion checks passed`);
	process.exitCode = failed || errors.length ? 1 : 0;
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
