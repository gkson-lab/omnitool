// Opens every tool in the web edition and clicks every visible, enabled button on its page, one at a time.
// After each click it presses Escape (closing any dialog or menu) and goes back to the tool if the click navigated.
// Then gives every file input a real PNG. Reports page errors, console errors and buttons that could not be clicked.
// Web edition only: on desktop the same buttons open native file dialogs, end processes or rename files.
//   node tests/click-all.js
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { Cdp } = require('./cdp');

const root = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_PER_TOOL = 150;

async function main() {
	const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((c) => fs.existsSync(c));
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-click-'));
	const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-click-dl-'));
	const child = spawn(exe, ['--headless=new', '--remote-debugging-port=9340', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
	const cdp = await Cdp.connect(9340);
	const errors = [];
	let current = '(boot)';
	try {
		await cdp.send('Page.enable');
		await cdp.send('Runtime.enable');
		cdp.on('Runtime.exceptionThrown', (p) => errors.push(`${current}: ${p.exceptionDetails.exception ? p.exceptionDetails.exception.description.split('\n')[0] : p.exceptionDetails.text}`));
		cdp.on('Runtime.consoleAPICalled', (p) => p.type === 'error' && errors.push(`${current}: console.error ${p.args.map((a) => a.value || a.description).join(' ').slice(0, 160)}`));
		await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }).catch(() => {});
		await cdp.send('Page.navigate', { url: 'file:///' + path.join(root, 'web', 'index.html').replace(/\\/g, '/') });
		for (let i = 0; i < 100 && !(await cdp.eval('!!(window.Omni && document.querySelector(".app"))').catch(() => false)); i++) await sleep(200);
		// Text-to-speech and alarms have nothing to play to in a headless browser.
		await cdp.eval(`window.speechSynthesis && (speechSynthesis.speak = () => {}); true`);
		const ids = await cdp.eval('Omni.sortedTools().map((t) => t.id)');
		const report = [];
		let total = 0;
		for (const id of ids) {
			current = id;
			const before = errors.length;
			const r = await cdp.eval(`(async () => {
				const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
				const home = '#/tool/${id}';
				location.hash = home;
				await sleep(450);
				const visible = () => [...document.querySelectorAll('#main button')].filter((b) => !b.disabled && b.offsetParent !== null && !b.closest('.approval'));
				const labels = [];
				const failed = [];
				let count = visible().length;
				for (let i = 0; i < Math.min(count, ${MAX_PER_TOOL}); i++) {
					const list = visible();
					const b = list[i];
					if (!b) break;
					const label = (b.getAttribute('aria-label') || b.textContent || '?').trim().slice(0, 30);
					try {
						b.click();
					} catch (e) {
						failed.push(label + ': ' + e.message);
					}
					await sleep(160);
					document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
					document.querySelectorAll('dialog[open]').forEach((d) => d.close());
					await sleep(40);
					labels.push(label);
					if (location.hash !== home) {
						location.hash = home;
						await sleep(450);
					}
				}
				return { clicked: labels.length, offered: count, labels: labels.join(' | '), failed };
			})()`, 120000).catch((e) => ({ clicked: 0, offered: 0, labels: '', failed: ['harness: ' + e.message] }));
			total += r.clicked;
			report.push({ id, ...r, errors: errors.slice(before) });
		}
		const bad = report.filter((r) => r.errors.length || r.failed.length);
		const capped = report.filter((r) => r.offered > MAX_PER_TOOL);
		console.log(`Clicked ${total} buttons across ${report.length} tools; ${bad.length} tools with errors.`);
		if (capped.length) console.log(`Tools with more than ${MAX_PER_TOOL} buttons (first ${MAX_PER_TOOL} clicked): ${capped.map((r) => `${r.id} (${r.offered})`).join(', ')}`);
		const none = report.filter((r) => !r.offered).map((r) => r.id);
		console.log(`Tools with no buttons beyond the form (live tools): ${none.length ? none.join(', ') : 'none'}`);
		for (const r of bad) console.log(`  ${r.id}: ${[...r.failed, ...r.errors].join(' || ').slice(0, 400)}`);

		// Second pass: give every file input a real PNG (a crop of this page) and check the tool shows a result.
		const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 96, height: 64, scale: 1 } });
		const sample = path.join(downloads, 'sample.png');
		fs.writeFileSync(sample, Buffer.from(shot.data, 'base64'));
		await cdp.send('DOM.enable');
		const fileResults = [];
		for (const id of ids) {
			current = id;
			// Start from the defaults: the button pass may have switched a mode that the tool remembers.
			const inputs = await cdp.eval(`(async () => { Omni.store.remove('inputs.${id}'); location.hash = '#/'; await new Promise((r) => setTimeout(r, 150)); location.hash = '#/tool/${id}'; await new Promise((r) => setTimeout(r, 450)); return document.querySelectorAll('#main input[type=file]').length; })()`);
			if (!inputs) continue;
			const before = errors.length;
			const startText = await cdp.eval(`document.querySelector('#main').innerText.length`);
			const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 });
			const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: doc.nodeId, selector: '#main input[type=file]' });
			for (const nodeId of nodeIds) await cdp.send('DOM.setFileInputFiles', { files: [sample], nodeId });
			await sleep(400);
			// Most file tools wait for their main button; live ones have already updated.
			await cdp.eval(`(() => { const b = document.querySelector('#main form button[type=submit]'); if (b) b.click(); return !!b; })()`);
			await sleep(1500);
			const after = await cdp.eval(`(() => {
				const main = document.querySelector('#main');
				const failed = [...main.querySelectorAll('.state-error')].map((e) => e.textContent.trim()).join(' | ');
				const refused = [...document.querySelectorAll('.toast.error')].map((t) => t.textContent.trim()).join(' | ');
				return { grew: main.innerText.length, failed, refused, sample: main.innerText.replace(/\\s+/g, ' ').slice(-140) };
			})()`);
			// A tool may refuse a file it cannot handle with an error toast; that is a handled outcome, reported below.
			fileResults.push({ id, inputs, changed: after.grew !== startText, refused: after.refused, failed: after.failed, errors: errors.slice(before), sample: after.sample });
		}
		const badFiles = fileResults.filter((r) => (!r.changed && !r.refused) || r.failed || r.errors.length);
		console.log(`File inputs: gave ${sample.split(/[\\/]/).pop()} to ${fileResults.length} tools (${fileResults.map((r) => r.id).join(', ')}); ${badFiles.length} without a result or with errors.`);
		for (const r of fileResults.filter((x) => x.refused)) console.log(`  ${r.id} refused the PNG: ${r.refused}`);
		for (const r of badFiles) console.log(`  ${r.id}: changed ${r.changed}; ${r.failed} ${r.errors.join(' || ')}`.slice(0, 400));
		fs.writeFileSync(path.join(__dirname, 'report-clicks.json'), JSON.stringify({ buttons: report, files: fileResults }, null, 2));
		process.exitCode = bad.length || badFiles.length ? 1 : 0;
	} finally {
		await cdp.eval('window.close(); true', 3000).catch(() => {});
		cdp.close();
		for (let i = 0; i < 20 && child.exitCode === null; i++) await sleep(250);
		if (child.exitCode === null) child.kill();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
