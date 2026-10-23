// No. 025 JavaScript console: runs code in a Web Worker so a runaway loop can be stopped without freezing OmniTool.
Omni.register({
	no: 25,
	id: 'js-console',
	name: 'JavaScript console',
	category: 'code',
	keywords: ['javascript', 'console', 'run', 'repl', 'eval', 'sandbox'],
	description: 'Runs JavaScript in an isolated worker and shows console output and the final value. Stops after the time limit.',
	inputs: [
		{ name: 'code', label: 'JavaScript', type: 'textarea', mono: true, rows: 12, default: 'const primes = [];\nfor (let n = 2; primes.length < 10; n++) {\n  if (primes.every((p) => n % p)) primes.push(n);\n}\nconsole.log("first ten primes:", primes);\nconsole.table(primes.map((p) => ({ p, square: p * p })));\nprimes.reduce((a, b) => a + b, 0);\n' },
		{ name: 'timeout', label: 'Time limit (seconds)', type: 'number', min: 1, max: 120, default: 5 },
	],
	action: 'Run',
	run({ code, timeout }) {
		// The worker has no DOM and no access to OmniTool or its storage. A worker loaded from its own file does not
		// inherit the desktop page's Content Security Policy, so eval works there without loosening the app's policy.
		const fromFile = Omni.edition === 'desktop' || location.protocol !== 'file:';
		return new Promise((resolve) => {
			let worker;
			try {
				worker = fromFile ? new Worker(Omni.sharedBase + 'core/js-worker.js') : new Worker(URL.createObjectURL(new Blob([`(${Omni.jsWorkerMain})()`], { type: 'text/javascript' })));
			} catch (err) {
				resolve({ error: `This browser blocked the worker that runs code (${err.message}).` });
				return;
			}
			const lines = [];
			const finish = (summary) => {
				clearTimeout(timer);
				worker.terminate();
				resolve({ blocks: [summary, { type: 'text', label: 'Console', value: lines.length ? lines.join('\n') : '(nothing logged)' }] });
			};
			const timer = setTimeout(() => finish({ type: 'error', message: `Stopped after ${timeout} seconds. An endless loop? Raise the limit if the code is just slow.` }), (timeout || 5) * 1000);
			worker.onmessage = (e) => {
				const m = e.data;
				if (m.kind === 'done') finish({ type: 'readings', items: [{ label: 'Result', value: m.text }, { label: 'Time', value: `${m.ms.toFixed(1)} ms`, copy: false }] });
				else if (m.kind === 'fail') finish({ type: 'error', message: m.text });
				else lines.push(m.kind === 'log' ? m.text : `${m.kind}: ${m.text}`);
			};
			worker.onerror = (e) => {
				e.preventDefault();
				finish({ type: 'error', message: e.message });
			};
			worker.postMessage(code);
		});
	},
});
