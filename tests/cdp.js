// A small Chrome DevTools Protocol client (Node 22+, no dependencies) used by the self-test.
'use strict';

class Cdp {
	static async connect(port, match) {
		const deadline = Date.now() + 30000;
		for (;;) {
			try {
				const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
				const page = list.find((t) => t.type === 'page' && (!match || match(t)));
				if (page) return new Cdp(page.webSocketDebuggerUrl).open();
			} catch {
				// Browser still starting.
			}
			if (Date.now() > deadline) throw new Error(`No debuggable page on port ${port}`);
			await new Promise((r) => setTimeout(r, 300));
		}
	}

	constructor(url) {
		this.url = url;
		this.id = 0;
		this.pending = new Map();
		this.handlers = new Map();
	}

	open() {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.url);
			this.ws.onopen = () => resolve(this);
			this.ws.onerror = (e) => reject(new Error(`CDP socket error: ${e.message || e.type}`));
			this.ws.onmessage = (m) => {
				const msg = JSON.parse(m.data);
				if (msg.id && this.pending.has(msg.id)) {
					const { resolve: ok, reject: fail } = this.pending.get(msg.id);
					this.pending.delete(msg.id);
					if (msg.error) fail(new Error(msg.error.message));
					else ok(msg.result);
				} else if (msg.method) (this.handlers.get(msg.method) || []).forEach((fn) => fn(msg.params));
			};
		});
	}

	send(method, params) {
		const id = ++this.id;
		this.ws.send(JSON.stringify({ id, method, params: params || {} }));
		return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
	}

	on(method, fn) {
		if (!this.handlers.has(method)) this.handlers.set(method, []);
		this.handlers.get(method).push(fn);
	}

	/** Evaluates an async expression in the page and returns its JSON value. */
	async eval(expression, timeout = 60000) {
		const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout });
		if (r.exceptionDetails) throw new Error(`Page threw: ${r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text}`);
		return r.result.value;
	}

	close() {
		this.ws.close();
	}
}

module.exports = { Cdp };
