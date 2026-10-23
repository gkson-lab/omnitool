// No. 050 URL parser: splits a URL into its parts and lets you edit query parameters.
Omni.register({
	no: 50,
	id: 'url-parser',
	name: 'URL parser',
	category: 'convert',
	keywords: ['url', 'parse', 'query', 'parameters', 'host', 'path', 'utm'],
	description: 'Splits a URL into protocol, host, port, path, query and fragment, and rebuilds it as you edit the query parameters.',
	inputs: [{ name: 'url', label: 'URL', type: 'text', mono: true, default: 'https://user@example.com:8443/docs/search?q=omni+tool&lang=en&utm_source=mail#results' }],
	run({ url }) {
		const u = new URL(url.trim());
		return {
			readings: [
				{ label: 'Protocol', value: u.protocol },
				{ label: 'Host', value: u.hostname },
				{ label: 'Port', value: u.port || `(default for ${u.protocol.replace(':', '')})`, copy: !!u.port },
				{ label: 'Path', value: u.pathname },
				{ label: 'Fragment', value: u.hash || '(none)', copy: !!u.hash },
				{ label: 'Origin', value: u.origin },
			],
			table: { label: 'Query parameters', columns: ['Name', 'Value'], rows: [...u.searchParams.entries()] },
		};
	},
	mount(root, ctx) {
		const { h, icon } = Omni;
		const input = h('input', { type: 'text', class: 'code', id: 'urlp-in', value: (ctx.args && ctx.args.url) || ctx.store.get('url', Omni.byId['url-parser'].inputs[0].default) });
		const params = h('div', { class: 'stack' });
		const parts = h('div', { 'aria-live': 'polite' });
		const rebuilt = h('div');
		let current = null;
		const drawParams = () => {
			params.replaceChildren(
				...[...current.searchParams.entries()].map(([k, v], i) => {
					const kIn = h('input', { type: 'text', value: k, 'aria-label': `Parameter ${i + 1} name` });
					const vIn = h('input', { type: 'text', value: v, 'aria-label': `Parameter ${i + 1} value` });
					const update = () => {
						const entries = [...current.searchParams.entries()];
						entries[i] = [kIn.value, vIn.value];
						current.search = new URLSearchParams(entries).toString();
						showRebuilt();
					};
					kIn.addEventListener('input', update);
					vIn.addEventListener('input', update);
					return h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, kIn, vIn, h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove ${k}`, onclick: () => {
						const entries = [...current.searchParams.entries()].filter((_, j) => j !== i);
						current.search = new URLSearchParams(entries).toString();
						drawParams();
						showRebuilt();
					} }, icon('close')));
				}),
				h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
					current.searchParams.append('name', 'value');
					drawParams();
					showRebuilt();
				} }, icon('plus'), 'Add parameter'),
				h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
					[...current.searchParams.keys()].filter((k) => /^(utm_|fbclid|gclid|mc_)/.test(k)).forEach((k) => current.searchParams.delete(k));
					drawParams();
					showRebuilt();
				} }, 'Remove tracking parameters'),
			);
		};
		const showRebuilt = () => {
			input.value = current.toString();
			ctx.store.set('url', input.value);
			rebuilt.replaceChildren(Omni.forms.renderBlock({ type: 'text', label: 'Rebuilt URL', value: current.toString() }));
			Omni.forms.renderOutput(Omni.byId['url-parser'].run({ url: current.toString() }), parts);
		};
		const parse = () => {
			try {
				current = new URL(input.value.trim());
				input.removeAttribute('aria-invalid');
				drawParams();
				showRebuilt();
			} catch {
				input.setAttribute('aria-invalid', 'true');
				parts.replaceChildren(Omni.forms.stateBox('error', 'Not a full URL.', 'Include the scheme, for example https://example.com/path'));
				params.replaceChildren();
				rebuilt.replaceChildren();
			}
		};
		input.addEventListener('change', parse);
		input.addEventListener('input', Omni.util.debounce(parse, 300));
		root.appendChild(h('div', { class: 'io' },
			h('div', { class: 'panel stack' }, h('div', { class: 'field' }, h('label', { for: 'urlp-in' }, 'URL'), input), h('h2', null, 'Query parameters'), params, rebuilt),
			h('section', { class: 'panel', 'aria-label': 'Parts' }, parts),
		));
		parse();
	},
});
