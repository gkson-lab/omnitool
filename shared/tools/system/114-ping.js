// No. 114 Ping (desktop): the system ping command, streamed line by line, with a summary.
(function () {
	'use strict';
	/** Shared page for streaming command tools (ping, traceroute). */
	Omni.streamTool = function streamTool(root, ctx, opts) {
		const { h } = Omni;
		const host = h('input', { type: 'text', id: `${opts.id}-host`, value: (ctx.args && ctx.args.host) || ctx.store.get('host', 'example.com'), spellcheck: 'false' });
		const extra = opts.extraField ? opts.extraField(ctx) : null;
		const out = h('pre', { class: 'readout', 'aria-live': 'polite', style: { minHeight: '200px' } });
		const summary = h('div');
		const go = h('button', { type: 'submit', class: 'btn btn-primary' }, opts.action);
		const stop = h('button', { type: 'button', class: 'btn', hidden: true }, 'Stop');
		let job = null;
		const run = async (e) => {
			e.preventDefault();
			const target = host.value.trim();
			if (!/^[a-z0-9.:-]+$/i.test(target)) {
				host.setAttribute('aria-invalid', 'true');
				return Omni.ui.toast('Enter a host name or IP address (letters, digits, dots, colons, dashes).', { error: true });
			}
			host.removeAttribute('aria-invalid');
			ctx.store.set('host', target);
			out.textContent = '';
			summary.replaceChildren();
			go.disabled = true;
			stop.hidden = false;
			try {
				job = opts.start(target, extra ? extra.value() : null, (line) => {
					out.textContent += line + '\n';
					out.scrollTop = out.scrollHeight;
				});
				const result = await job.done;
				summary.replaceChildren(opts.summarize(out.textContent, result));
			} catch (err) {
				summary.replaceChildren(Omni.forms.stateBox('error', `${opts.action} failed.`, err.message));
			} finally {
				job = null;
				go.disabled = false;
				stop.hidden = true;
			}
		};
		stop.onclick = () => job && job.stop();
		root.appendChild(h('div', { class: 'stack-lg' },
			h('form', { class: 'panel', onsubmit: run }, h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: `${opts.id}-host` }, 'Host or IP address'), host), extra ? extra.el : null, h('div', { class: 'field row', style: { alignItems: 'flex-end' } }, go, stop))),
			h('section', { class: 'panel stack', 'aria-label': 'Output' }, summary, out),
		));
		return () => job && job.stop();
	};

	Omni.register({
		no: 114,
		id: 'ping',
		name: 'Ping',
		category: 'system',
		editions: ['desktop'],
		keywords: ['ping', 'latency', 'network', 'icmp', 'reachable', 'packet loss'],
		description: 'Pings a host with Windows\' own ping command and summarizes packet loss and round-trip times.',
		ai: false,
		mount(root, ctx) {
			const { h } = Omni;
			return Omni.streamTool(root, ctx, {
				id: 'ping',
				action: 'Ping',
				extraField: () => {
					const count = h('input', { type: 'number', id: 'ping-count', min: 1, max: 100, value: ctx.store.get('count', 4) });
					return { el: h('div', { class: 'field' }, h('label', { for: 'ping-count' }, 'Count'), count), value: () => (ctx.store.set('count', Number(count.value) || 4), Math.max(1, Math.min(100, Number(count.value) || 4))) };
				},
				start: (host, count, onLine) => Omni.native.net.ping(host, count, onLine),
				summarize: (text) => {
					const times = [...text.matchAll(/(?:time|Zeit|temps|tiempo)[=<]\s*(\d+(?:\.\d+)?)\s*ms/gi)].map((m) => Number(m[1]));
					const sent = (text.match(/Sent = (\d+)/i) || text.match(/(\d+) packets transmitted/i) || [])[1];
					const lost = (text.match(/Lost = (\d+)/i) || [])[1];
					if (!times.length) return Omni.forms.stateBox('error', 'No replies.', 'The host did not answer. It may be down, or it may block ping.');
					return Omni.forms.readings([{ label: 'Replies', value: `${times.length}${sent ? ` of ${sent}` : ''}`, copy: false }, { label: 'Lost', value: lost != null ? lost : '-', copy: false }, { label: 'Min / avg / max', value: `${Math.min(...times)} / ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} / ${Math.max(...times)} ms`, copy: false }]);
				},
			});
		},
	});
})();
