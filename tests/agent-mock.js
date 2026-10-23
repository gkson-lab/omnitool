// Runs Omni Agent and an AI tool in Claude mode against a local stand-in for the Messages API, so the Claude code path
// is tested without an API key or network: streamed text and tool calls, tool results sent back, the approval card
// before a file is saved (approved once, rejected once), and the request parameters. Nothing is written to settings:
// the page is given a fake key in memory only.
//   node tests/agent-mock.js web|desktop
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { Cdp } = require('./cdp');
const { closeDesktopWindow } = require('./close-window');

const edition = process.argv[2] === 'desktop' ? 'desktop' : 'web';
const root = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const requests = [];
const stamp = Date.now();
const fileName = `mock-uuids-${stamp}.txt`;
const rejectedName = `mock-rejected-${stamp}.txt`;

/** Server-sent events for one assistant message made of text and tool_use blocks. */
function sse(blocks, stopReason) {
	const out = [];
	const ev = (type, data) => out.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
	ev('message_start', { message: { id: `msg_${requests.length}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
	blocks.forEach((b, index) => {
		if (b.type === 'text') {
			ev('content_block_start', { index, content_block: { type: 'text', text: '' } });
			// Two deltas, so the page has to put streamed pieces together.
			const half = Math.ceil(b.text.length / 2);
			ev('content_block_delta', { index, delta: { type: 'text_delta', text: b.text.slice(0, half) } });
			ev('content_block_delta', { index, delta: { type: 'text_delta', text: b.text.slice(half) } });
		} else {
			ev('content_block_start', { index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
			const json = JSON.stringify(b.input);
			const cut = Math.floor(json.length / 3);
			ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: json.slice(0, cut) } });
			ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: json.slice(cut) } });
		}
		ev('content_block_stop', { index });
	});
	ev('message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 30 } });
	ev('message_stop', {});
	return out.join('');
}

const saveTool = edition === 'desktop' ? 'write_file' : 'save_download';
const saveInput = (name, content) => (edition === 'desktop' ? { path: name, content } : { filename: name, content });

/** The scripted conversation: run the ID generator, save its output, then report. A second request saves and expects a rejection. */
function reply(body) {
	if (!body.tools) return sse([{ type: 'text', text: 'MOCK-EXPLAIN: debounce waits until calls stop for ms milliseconds, then runs fn once.' }], 'end_turn');
	const lastUser = body.messages[body.messages.length - 1];
	const results = Array.isArray(lastUser.content) ? lastUser.content.filter((b) => b.type === 'tool_result') : [];
	const rounds = body.messages.filter((m) => m.role === 'assistant').length;
	const isRejectRun = JSON.stringify(body.messages).includes('reject test');
	if (isRejectRun) {
		const sinceAsk = body.messages.slice(body.messages.map((m) => JSON.stringify(m)).findLastIndex((s) => s.includes('reject test')));
		if (sinceAsk.length === 1) return sse([{ type: 'tool_use', id: 'toolu_rej', name: saveTool, input: saveInput(rejectedName, 'should not be saved') }], 'tool_use');
		return sse([{ type: 'text', text: `MOCK-REJECTED: understood, nothing saved. Tool said: ${results.map((r) => r.content).join(' ')}` }], 'end_turn');
	}
	if (rounds === 0) {
		return sse([{ type: 'text', text: 'Generating the IDs first.' }, { type: 'tool_use', id: 'toolu_gen', name: 'run_tool', input: { tool_id: 'id-generator', args: { kind: 'uuid4', count: 10 } } }], 'tool_use');
	}
	if (rounds === 1) {
		const ids = (JSON.stringify(results).match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g) || []);
		return sse([{ type: 'tool_use', id: 'toolu_save', name: saveTool, input: saveInput(fileName, ids.join('\n') + '\n') }], 'tool_use');
	}
	return sse([{ type: 'text', text: `MOCK-FINAL: saved 10 UUIDs to ${fileName}.` }], 'end_turn');
}

function startServer() {
	const server = http.createServer((req, res) => {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
		if (req.method === 'OPTIONS') return res.writeHead(204).end();
		let raw = '';
		req.on('data', (d) => (raw += d));
		req.on('end', () => {
			const body = JSON.parse(raw || '{}');
			requests.push({ url: req.url, headers: req.headers, body });
			res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
			res.end(reply(body));
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function launch() {
	if (edition === 'desktop') {
		const exe = path.join(root, 'desktop', 'app', 'node_modules', 'electron', 'dist', 'electron.exe');
		return { exe, child: spawn(exe, [path.join(root, 'desktop', 'app'), '--remote-debugging-port=9338'], { stdio: 'ignore' }), port: 9338 };
	}
	const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((c) => fs.existsSync(c));
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-mock-'));
	const child = spawn(exe, ['--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' });
	return { exe, child, port: 9335 };
}

async function main() {
	const server = await startServer();
	const base = `http://127.0.0.1:${server.address().port}`;
	const { exe, child, port } = launch();
	const checks = [];
	const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
	let cdp;
	const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-mock-dl-'));
	try {
		cdp = await Cdp.connect(port, edition === 'desktop' ? (t) => /index\.html/.test(t.url) : null);
		await cdp.send('Page.enable');
		await cdp.send('Runtime.enable');
		const pageErrors = [];
		cdp.on('Runtime.exceptionThrown', (p) => pageErrors.push(p.exceptionDetails.exception ? p.exceptionDetails.exception.description : p.exceptionDetails.text));
		cdp.on('Runtime.consoleAPICalled', (p) => p.type === 'error' && pageErrors.push(p.args.map((a) => a.value || a.description).join(' ')));
		if (edition === 'web') {
			await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }).catch(() => {});
			await cdp.send('Page.navigate', { url: 'file:///' + path.join(root, 'web', 'index.html').replace(/\\/g, '/') });
		}
		for (let i = 0; i < 100 && !(await cdp.eval('!!(window.Omni && Omni.agent && document.querySelector(".app"))').catch(() => false)); i++) await sleep(200);

		const mode = await cdp.eval(`(async () => {
			await Omni.vendor('anthropic-sdk.min.js');
			const Real = window.Anthropic;
			window.Anthropic = class extends Real { constructor(o) { super({ ...o, baseURL: ${JSON.stringify(base)}, maxRetries: 0 }); } };
			const get = Omni.secrets.get.bind(Omni.secrets);
			Omni.secrets.get = async (n) => (n === 'anthropic' ? 'sk-ant-mock-not-a-real-key' : get(n));
			return Omni.ai.mode();
		})()`);
		check('page switched to Claude mode with an in-memory key', mode === 'claude', mode);

		// 1. The spec's example task, approving the save.
		await cdp.eval(`Omni.agent.ask('generate 10 UUIDs and save them to a file'); true`);
		const approval = await cdp.eval(`(async () => {
			for (let i = 0; i < 100; i++) {
				const card = [...document.querySelectorAll('.approval')].find((c) => !c.querySelector('button').disabled);
				if (card) { const title = card.querySelector('h3').textContent; card.querySelector('.btn-primary').click(); return title; }
				await new Promise((r) => setTimeout(r, 100));
			}
			return null;
		})()`, 30000);
		check('agent stopped for approval before saving', !!approval, approval);
		const final = await cdp.eval(`(async () => {
			for (let i = 0; i < 100; i++) { if (document.body.textContent.includes('MOCK-FINAL')) return true; await new Promise((r) => setTimeout(r, 100)); }
			return false;
		})()`, 30000);
		check('final answer streamed into the panel', final);
		const steps = await cdp.eval(`[...document.querySelectorAll('.approval')].length + ' approval card(s); steps shown: ' + [...document.querySelectorAll('li.done, li.failed')].map((li) => li.textContent.split(' done')[0].slice(0, 40)).join(' | ')`);
		check('each tool call shown as a step', /run_tool|ID generator|id-generator/i.test(steps), steps);

		const agentCalls = requests.filter((r) => r.body.tools);
		check('three rounds sent to the API', agentCalls.length === 3, agentCalls.length + ' requests');
		const first = agentCalls[0];
		if (first) {
			check('model and effort from settings', first.body.model === 'claude-opus-5-5' && first.body.output_config && first.body.output_config.effort === 'medium', `${first.body.model}, effort ${first.body.output_config && first.body.output_config.effort}`);
			check('refusal fallback requested (default setting)', first.body.fallbacks === 'default' && /server-side-fallback-2026-07-01/.test(first.headers['anthropic-beta'] || ''), `fallbacks=${first.body.fallbacks}, anthropic-beta=${first.headers['anthropic-beta']}`);
			check('tools stream their input', first.body.tools.every((t) => t.eager_input_streaming === true), first.body.tools.map((t) => t.name).join(', '));
			check('browser-access header sent', first.headers['anthropic-dangerous-direct-browser-access'] === 'true', first.headers['anthropic-dangerous-direct-browser-access']);
		}
		const second = agentCalls[1];
		if (second) {
			const assistant = second.body.messages[1];
			check('assistant turn kept whole in the history', assistant && assistant.role === 'assistant' && assistant.content.length === 2 && assistant.content[1].type === 'tool_use' && assistant.content[1].input.args.count === 10, JSON.stringify(assistant && assistant.content.map((b) => b.type)));
			const result = second.body.messages[2].content[0];
			const ids = (result.content.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g) || []).length;
			check('tool result sent back with 10 UUIDs', result.type === 'tool_result' && result.tool_use_id === 'toolu_gen' && ids === 10, `${ids} UUIDs in the result`);
		}
		const third = agentCalls[2];
		if (third) check('save result reported to Claude', /saved|bytes|wrote/i.test(JSON.stringify(third.body.messages[4])), JSON.stringify(third.body.messages[4].content[0].content).slice(0, 160));

		let saved = '';
		if (edition === 'desktop') {
			const agentRoot = await cdp.eval('omniNative.agentFs.root()');
			const file = path.join(agentRoot, fileName);
			saved = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
			if (saved) fs.unlinkSync(file);
		} else {
			for (let i = 0; i < 50 && !fs.existsSync(path.join(downloads, fileName)); i++) await sleep(100);
			saved = fs.existsSync(path.join(downloads, fileName)) ? fs.readFileSync(path.join(downloads, fileName), 'utf8') : '';
		}
		check('approved file saved with the 10 UUIDs', saved.trim().split('\n').length === 10, `${saved.trim().split('\n').filter(Boolean).length} lines`);

		// 2. A save the user rejects.
		await cdp.eval(`Omni.agent.ask('reject test: save a file'); true`);
		const rejected = await cdp.eval(`(async () => {
			for (let i = 0; i < 100; i++) {
				const card = [...document.querySelectorAll('.approval')].find((c) => !c.querySelector('button').disabled);
				if (card) { [...card.querySelectorAll('button')].find((b) => b.textContent === 'Reject').click(); return true; }
				await new Promise((r) => setTimeout(r, 100));
			}
			return false;
		})()`, 30000);
		const after = await cdp.eval(`(async () => {
			for (let i = 0; i < 100; i++) { if (document.body.textContent.includes('MOCK-REJECTED')) return true; await new Promise((r) => setTimeout(r, 100)); }
			return false;
		})()`, 30000);
		const rejectReport = requests.filter((r) => r.body.tools).pop();
		const toolSaid = rejectReport ? JSON.stringify(rejectReport.body.messages[rejectReport.body.messages.length - 1].content) : '';
		let leaked = false;
		if (edition === 'desktop') leaked = fs.existsSync(path.join(await cdp.eval('omniNative.agentFs.root()'), rejectedName));
		else leaked = fs.existsSync(path.join(downloads, rejectedName));
		check('rejected save not written, and Claude told so', rejected && after && !leaked && /reject/i.test(toolSaid), toolSaid.slice(0, 160));

		// 3. An AI tool streams its answer from Claude.
		const explained = await cdp.eval(`(async () => {
			location.hash = '#/tool/code-explainer';
			await new Promise((r) => setTimeout(r, 800));
			document.querySelector('#main form .btn-primary').click();
			for (let i = 0; i < 100; i++) {
				const t = document.querySelector('#main').innerText;
				if (t.includes('MOCK-EXPLAIN')) return t.includes('Claude') ? 'answer shown, labelled Claude' : 'answer shown';
				await new Promise((r) => setTimeout(r, 100));
			}
			return 'no answer';
		})()`, 30000);
		check('AI tool (138 code explainer) shows the streamed answer', /answer shown/.test(explained), explained);

		check('no page errors or console errors', !pageErrors.length, pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'none');
	} finally {
		if (cdp) {
			if (edition === 'desktop') closeDesktopWindow(exe);
			else await cdp.eval('window.close(); true', 5000).catch(() => {});
			cdp.close();
		}
		for (let i = 0; i < 40 && child.exitCode === null; i++) await sleep(250);
		if (child.exitCode === null) child.kill();
		server.close();
	}
	for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail !== undefined ? `: ${c.detail}` : ''}`);
	const failed = checks.filter((c) => !c.ok).length;
	console.log(`${edition}: ${checks.length - failed} of ${checks.length} checks passed`);
	process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
