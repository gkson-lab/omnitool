// No. 115 Traceroute (desktop): the route packets take to a host, hop by hop, via tracert.
Omni.register({
	no: 115,
	id: 'traceroute',
	name: 'Traceroute',
	category: 'system',
	editions: ['desktop'],
	keywords: ['traceroute', 'tracert', 'route', 'hops', 'network', 'latency'],
	description: 'Shows each hop between this PC and a host with its round-trip times, using Windows\' tracert. It can take a minute.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		return Omni.streamTool(root, ctx, {
			id: 'trace',
			action: 'Trace route',
			extraField: () => {
				const hops = h('input', { type: 'number', id: 'trace-hops', min: 1, max: 64, value: ctx.store.get('hops', 20) });
				return { el: h('div', { class: 'field' }, h('label', { for: 'trace-hops' }, 'Max hops'), hops), value: () => (ctx.store.set('hops', Number(hops.value) || 20), Math.max(1, Math.min(64, Number(hops.value) || 20))) };
			},
			start: (host, hops, onLine) => Omni.native.net.traceroute(host, hops, onLine),
			summarize: (text) => {
				const hopLines = text.split('\n').filter((l) => /^\s*\d+\s/.test(l));
				const timeouts = hopLines.filter((l) => /\*\s+\*\s+\*/.test(l)).length;
				return Omni.forms.readings([{ label: 'Hops', value: hopLines.length, copy: false }, { label: 'Hops that did not answer', value: timeouts, copy: false }, { label: 'Reached the host', value: /Trace complete|traceroute to/i.test(text) && !/Request timed out\.\s*$/.test(text.trim()) ? 'yes' : 'unknown', copy: false }]);
			},
		});
	},
});
