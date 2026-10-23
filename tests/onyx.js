// Tests Onyx, Omni Agent's local engine, in the web edition (headless Chrome):
// intent accuracy on phrasings it was not built with, a scripted conversation, the agent panel, and zero network use.
//   node tests/onyx.js
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { Cdp } = require('./cdp');

const root = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Phrasings that are not in onyx-data.js, with the intent each should land on.
const HELD_OUT = [
	['hey hey', 'greet'], ['hi friend', 'greet'], ['good morning to you', 'greet'], ['hullo', 'greet'],
	['how are things going with you', 'how_are_you'], ['how ya doing', 'how_are_you'], ['how are u', 'how_are_you'],
	['what you up to', 'whats_up'], ['sup dude', 'whats_up'],
	['what do i call you', 'identity'], ['whats ur name', 'identity'], ['tell me who you are', 'identity'],
	['r u a robot', 'is_ai'], ['are you a real person', 'is_ai'], ['are you an artificial intelligence', 'is_ai'], ['are you chat gpt', 'is_ai'],
	['who made u', 'creator'], ['who is the creator', 'creator'],
	['how old r u', 'age'],
	['what kind of things can you do', 'help'], ['what can you help me with', 'help'], ['i need help', 'help'],
	['write a poem about cats', 'limits'], ['can you write some python code', 'limits'], ['search google for cats', 'limits'], ['translate hello to french', 'limits'],
	['is it raining', 'weather'], ['whats the weather like', 'weather'],
	['what are the latest headlines', 'news'],
	['thank you very much', 'thanks'], ['thanks a ton', 'thanks'], ['many thanks', 'thanks'],
	['ok bye', 'bye'], ['see you tomorrow', 'bye'], ['goodnight', 'bye'],
	['i am doing good', 'user_good'], ['im fine thanks', 'user_good'], ['pretty great actually', 'user_good'],
	['i feel sad today', 'user_bad'], ['today was a bad day', 'user_bad'], ['i feel lonely', 'user_bad'],
	['i am so tired', 'user_tired'], ['i need some rest', 'user_tired'],
	['im so bored', 'user_bored'],
	['i feel stressed out', 'user_stressed'], ['work is overwhelming', 'user_stressed'],
	['this is so frustrating', 'user_angry'],
	['you are very smart', 'compliment'], ['great job', 'compliment'],
	['you are so dumb', 'insult'], ['you are pretty useless', 'insult'],
	['tell me something funny', 'joke'], ['make me laugh please', 'joke'], ['do you know a good joke', 'joke'],
	['got a tip for me', 'tip'],
	['what are the keyboard shortcuts', 'shortcuts'],
	['tell me a fun fact', 'fact'], ['tell me something interesting', 'fact'],
	['what time is it now', 'time'], ['got the time', 'time'],
	['what day is today', 'date'], ['which year is it', 'date'],
	['do you know who i am', 'name_get'],
	['what do you know about me', 'recall'],
	['please forget everything about me', 'forget'],
	['start a new chat', 'clear_chat'],
	['turn on the dark mode', 'theme_dark'], ['switch to the light theme', 'theme_light'],
	['lets play a game', 'games'],
	['what is this app', 'omnitool'],
	['how many tools do you have', 'tool_count'],
	['where do i add my api key', 'api_key'],
	['is my data safe', 'privacy'], ['do you work offline', 'privacy'],
	['how do i pin tools', 'pin_help'],
	['how can i back up my data', 'data_help'],
	['whats the meaning of life', 'meaning'],
	['whats your favorite color', 'favorite'],
	['okay cool', 'ack'],
	['are you still there', 'ping_me'],
	['tell me another', 'again'],
	['can you say that again', 'repeat'],
	['yes please', 'yes'], ['no thanks', 'no'],
];

// A conversation, in order. Each step: [what you say, what the reply must show (regex on text, or a check of the reply object)].
const SCRIPT = [
	['hi', /What should I call you/],
	['Sam', /Nice to meet you, Sam/],
	['how are you?', /How about you|How are you|And you/],
	['pretty good actually', /Good to hear|Glad|Nice/],
	["what's my name", /Sam/],
	['tell me a joke', 'joke'],
	['another one', 'joke2'],
	['lol', /landed/],
	['remember that my car is blue', /your car is blue/],
	['what do you remember about me', /Sam[\s\S]*your car is blue/],
	['i need to pretty print some json', (r) => /JSON formatter/.test(r.text) && r.offer && r.offer.id === 'json-formatter'],
	['yes', (r) => r.action === 'open:json-formatter'],
	['what is a jwt', /three base64url parts/],
	['generate 3 uuids', (r) => r.command === 'generate 3 uuids'],
	["what's 12 times 7", (r) => /12\s*\*\s*7/.test(r.command || '')],
	['should i take the bus or walk', /Go with \*\*(take the bus|walk)\*\*/],
	['write me a poem', /beyond me|Claude/],
	['who won the world cup in 1998', /don't know|outside what I know|No idea/],
	['asdkjh qwe zzx', /didn't catch|not sure what you mean|went past me/],
	['I forgot my password', (r) => !r.command],
	['rock and roll', (r) => !r.command],
	['helo', /Hi|Hello|Hey|Good/],
	['wats teh time', /^It's \d/],
	['hola', /only understand English/],
	['i want to die', /988/],
	['dark mode', (r) => r.action === 'theme:dark'],
	['hi onyx, what can you do', /^Hi, Sam\.[\s\S]*Run tools/],
	['what is the meaning of life', /42/],
	["i'm bored", (r) => r.offer && r.offer.kind === 'games'],
	['forget me', (r) => r.offer && r.offer.kind === 'forget'],
	['yes', /forgotten your name/],
	["what's my name", /haven't told me/],
];

async function main() {
	const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((c) => fs.existsSync(c));
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitool-onyx-'));
	const child = spawn(exe, ['--headless=new', '--remote-debugging-port=9347', `--user-data-dir=${profile}`, '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' });
	const cdp = await Cdp.connect(9347);
	const errors = [];
	const requests = [];
	const lines = [];
	let failed = 0;
	const report = (ok, text) => {
		if (!ok) failed++;
		lines.push(`${ok ? 'PASS' : 'FAIL'} ${text}`);
	};
	try {
		await cdp.send('Page.enable');
		await cdp.send('Runtime.enable');
		await cdp.send('Network.enable');
		cdp.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails.exception ? p.exceptionDetails.exception.description.split('\n')[0] : p.exceptionDetails.text));
		cdp.on('Runtime.consoleAPICalled', (p) => ['error', 'warning'].includes(p.type) && errors.push(p.type + ': ' + p.args.map((a) => a.value || a.description).join(' ')));
		await cdp.send('Page.navigate', { url: 'file:///' + path.join(root, 'web', 'index.html').replace(/\\/g, '/') });
		for (let i = 0; i < 100 && !(await cdp.eval('!!(window.Omni && Omni.onyx && document.querySelector(".app"))').catch(() => false)); i++) await sleep(200);
		// From here on, any request that leaves the page's own files counts against Onyx.
		cdp.on('Network.requestWillBeSent', (p) => !/^(file|data|blob|about):/.test(p.request.url) && requests.push(p.request.url));

		// 1. Intent accuracy on held-out phrasings.
		const results = await cdp.eval(`(() => ${JSON.stringify(HELD_OUT)}.map(([text, want]) => { const r = Omni.onyx.classify(text); return { text, want, got: r[0] ? r[0].id : null, score: r[0] ? +r[0].score.toFixed(2) : 0 }; }))()`);
		const right = results.filter((r) => r.got === r.want);
		const accuracy = right.length / results.length;
		report(accuracy >= 0.9, `intent accuracy on ${results.length} held-out phrasings: ${(accuracy * 100).toFixed(1)}%`);
		results.filter((r) => r.got !== r.want).forEach((r) => lines.push(`     missed "${r.text}": wanted ${r.want}, got ${r.got} (${r.score})`));

		// 2. The conversation.
		await cdp.eval(`Omni.store.remove('onyx.memory'); Omni.onyx.reset(); true`);
		let lastJoke = null;
		for (const [say, expect] of SCRIPT) {
			const r = await cdp.eval(`Omni.onyx.respond(${JSON.stringify(say)}).then((r) => { const o = r ? JSON.parse(JSON.stringify(r)) : null; return o; })`);
			let ok;
			if (expect === 'joke') {
				ok = await cdp.eval(`Omni.onyxData.JOKES.includes(${JSON.stringify(r && r.text)})`);
				lastJoke = r && r.text;
			} else if (expect === 'joke2') ok = (await cdp.eval(`Omni.onyxData.JOKES.includes(${JSON.stringify(r && r.text)})`)) && r.text !== lastJoke;
			else if (expect instanceof RegExp) ok = !!r && expect.test(r.text);
			else ok = !!r && expect(r);
			report(ok, `"${say}" -> ${r ? (r.command ? `command: ${r.command}` : JSON.stringify(r.text).slice(0, 110)) + (r.offer ? ` [offer ${r.offer.kind}${r.offer.id ? ' ' + r.offer.id : ''}]` : '') + (r.action ? ` [action ${r.action}]` : '') : 'no reply'}`);
		}

		// 3. The agent panel: Onyx is the engine without a key, replies under its own name, and runs a command with steps.
		const panel = await cdp.eval(`(async () => {
			const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
			await Omni.secrets.clear('anthropic');
			Omni.toggleAgent(true);
			await sleep(300);
			const sw = [...document.querySelectorAll('.agent-mode .seg button')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + (b.disabled ? ' (disabled)' : '')).join(' | ');
			Omni.agent.ask('hi onyx');
			await sleep(900);
			const msg = [...document.querySelectorAll('.agent-log .msg')].pop();
			const who = msg.querySelector('.msg-who').textContent;
			Omni.agent.ask('convert 10 km to miles');
			await sleep(1500);
			const last = [...document.querySelectorAll('.agent-log .msg')].pop();
			const steps = [...last.querySelectorAll('.steps .step-name')].map((s) => s.textContent).join(', ');
			Omni.toggleAgent(false);
			return { sw, who, hi: msg.querySelector('.msg-body').textContent.trim().slice(0, 80), steps, result: /6\\.21/.test(last.textContent) };
		})()`, 20000);
		report(/Onyx\*/.test(panel.sw) && /Claude \(disabled\)/.test(panel.sw), `engine switch without a key: ${panel.sw}`);
		report(panel.who === 'Onyx' && panel.hi.length > 0, `panel reply from "${panel.who}": ${panel.hi}`);
		report(/run_tool/.test(panel.steps) && panel.result, `panel command ran ${panel.steps} and showed 10 km = 6.21 miles: ${panel.result}`);

		// 4. Speed: how long a reply takes to decide.
		const ms = await cdp.eval(`(async () => { const t = performance.now(); for (let i = 0; i < 50; i++) await Omni.onyx.respond('how do i convert a unix timestamp'); return (performance.now() - t) / 50; })()`);
		report(ms < 50, `average decision time: ${ms.toFixed(1)} ms`);
		await cdp.eval(`Omni.store.remove('onyx.memory'); true`);
	} finally {
		await cdp.eval('window.close(); true', 3000).catch(() => {});
		cdp.close();
		for (let i = 0; i < 20 && child.exitCode === null; i++) await sleep(250);
		if (child.exitCode === null) child.kill();
	}
	report(requests.length === 0, `network requests made by Onyx: ${requests.length}${requests.length ? ' (' + requests.slice(0, 3).join(', ') + ')' : ''}`);
	report(errors.length === 0, `page errors and warnings: ${errors.length}${errors.length ? ' (' + errors.slice(0, 3).join(' | ') + ')' : ''}`);
	lines.forEach((l) => console.log(l));
	console.log(`${lines.filter((l) => l.startsWith('PASS')).length} passed, ${failed} failed`);
	process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
