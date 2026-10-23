// No. 123 HTTP request tester: send any method with headers and a body; see status, headers, timing and body.
Omni.register({
	no: 123,
	id: 'http-tester',
	name: 'HTTP request tester',
	category: 'system',
	keywords: ['http', 'api', 'rest', 'request', 'curl', 'postman', 'fetch', 'get', 'post', 'headers'],
	description: 'Sends HTTP requests with any method, headers and body, and shows the status, timing, response headers and a formatted body.',
	action: 'Send',
	ai: false,
	layout: 'split',
	inputs: [
		{ name: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], default: 'GET' },
		{ name: 'url', label: 'URL', type: 'url', default: 'https://httpbin.org/get?tool=omnitool', wide: true },
		{ name: 'headers', label: 'Headers (one "Name: value" per line)', type: 'textarea', mono: true, rows: 4, default: 'Accept: application/json' },
		{ name: 'body', label: 'Body', type: 'textarea', mono: true, rows: 5, when: (v) => !['GET', 'HEAD'].includes(v.method) },
	],
	async run({ method, url, headers, body }) {
		let target;
		try {
			target = new URL(url);
		} catch {
			throw new Error('Enter a full URL starting with http:// or https://.');
		}
		if (!/^https?:$/.test(target.protocol)) throw new Error('Only http and https URLs can be requested.');
		const hdrs = {};
		for (const line of headers.split('\n').map((l) => l.trim()).filter(Boolean)) {
			const i = line.indexOf(':');
			if (i < 1) throw new Error(`"${line}" is not a header. Use Name: value.`);
			hdrs[line.slice(0, i).trim()] = line.slice(i + 1).trim();
		}
		const sendBody = ['GET', 'HEAD'].includes(method) ? undefined : body;
		let res;
		const t0 = performance.now();
		if (Omni.native) res = await Omni.native.net.http({ method, url: target.toString(), headers: hdrs, body: sendBody });
		else {
			let r;
			try {
				r = await fetch(target, { method, headers: hdrs, body: sendBody, redirect: 'follow' });
			} catch {
				throw new Error('The browser blocked the request or the server did not answer. Servers must allow cross-origin requests (CORS) for the web edition; the desktop edition has no such limit.');
			}
			res = { status: r.status, statusText: r.statusText, headers: [...r.headers.entries()], body: method === 'HEAD' ? '' : await r.text(), ms: Math.round(performance.now() - t0), url: r.url };
		}
		let pretty = res.body;
		const type = (res.headers.find(([k]) => k.toLowerCase() === 'content-type') || [, ''])[1];
		if (/json/.test(type) || /^\s*[[{]/.test(res.body)) {
			try {
				pretty = JSON.stringify(JSON.parse(res.body), null, 2);
			} catch {
				// Not JSON after all; show it as text.
			}
		}
		return {
			readings: [{ label: 'Status', value: `${res.status} ${res.statusText || ''}`.trim(), copy: false }, { label: 'Time', value: `${res.ms} ms`, copy: false }, { label: 'Size', value: Omni.util.fmt.bytes(new Blob([res.body]).size), copy: false }, { label: 'Final URL', value: res.url }],
			blocks: [{ type: 'text', label: 'Body', value: pretty.length > 200000 ? pretty.slice(0, 200000) + '\n[cut at 200 KB]' : pretty || '(empty)' }, { type: 'table', label: 'Response headers', columns: ['Header', 'Value'], rows: res.headers }],
			note: Omni.native ? null : 'Web edition: the browser hides some response headers and enforces CORS.',
		};
	},
});
