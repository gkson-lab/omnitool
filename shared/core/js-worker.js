// Worker for No. 025 JavaScript console. Loaded as a worker it runs itself; loaded in the page (manifest) it only
// exposes its source, which the file:// web edition turns into a blob worker because Chrome blocks file workers there.
(function () {
	'use strict';
	function workerMain() {
		const fmt = (x) => {
			try {
				return typeof x === 'string' ? x : x === undefined ? 'undefined' : typeof x === 'function' ? x.toString() : JSON.stringify(x, null, 2);
			} catch {
				return String(x);
			}
		};
		const send = (kind, args) => postMessage({ kind, text: Array.from(args, fmt).join(' ') });
		self.console = {
			log: (...a) => send('log', a),
			info: (...a) => send('info', a),
			warn: (...a) => send('warn', a),
			error: (...a) => send('error', a),
			debug: (...a) => send('log', a),
			table: (t) => send('table', [t]),
		};
		onmessage = async (e) => {
			const t0 = performance.now();
			try {
				// Indirect eval runs in the worker's global scope and returns the last expression's value.
				let value = (0, eval)(e.data);
				if (value && typeof value.then === 'function') value = await value;
				postMessage({ kind: 'done', text: fmt(value), ms: performance.now() - t0 });
			} catch (err) {
				postMessage({ kind: 'fail', text: (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err)), ms: performance.now() - t0 });
			}
		};
	}
	if (typeof window === 'undefined') workerMain();
	else window.Omni.jsWorkerMain = workerMain;
})();
