// No. 004 JSON tree explorer: a collapsible tree of a JSON document; each node copies its path.
Omni.register({
	no: 4,
	id: 'json-tree',
	name: 'JSON tree explorer',
	category: 'code',
	keywords: ['json', 'tree', 'viewer', 'path', 'jsonpath', 'explore'],
	description: 'Shows JSON as a collapsible tree. Filter by key or value and copy any node\'s path.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const input = h('textarea', { class: 'code', rows: 10, spellcheck: 'false', 'aria-label': 'JSON' });
		input.value = ctx.store.get('json', '{\n  "user": { "id": 7, "name": "Example", "roles": ["admin", "editor"] },\n  "settings": { "theme": "dark", "beta": false }\n}');
		const filter = h('input', { type: 'search', placeholder: 'Filter keys and values', 'aria-label': 'Filter the tree' });
		const tree = h('div', { class: 'stack', style: { fontFamily: 'var(--font-mono)', fontSize: '0.84rem', fontStretch: '87.5%' } });
		const pathOut = h('code', { class: 'muted' }, 'Select a key to see its path');
		let data = null;

		const pathOf = (parts) => parts.reduce((p, k) => (typeof k === 'number' ? `${p}[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `${p}.${k}` : `${p}[${JSON.stringify(k)}]`), '$');
		const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));
		const matches = (v, key, q) => !q || String(key).toLowerCase().includes(q) || (typeof v !== 'object' && show(v).toLowerCase().includes(q)) || (v && typeof v === 'object' && Object.entries(v).some(([k, x]) => matches(x, k, q)));

		function node(key, value, parts, q) {
			const label = h('button', { type: 'button', class: 'btn-quiet', style: { border: 0, background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: '2px 4px', minHeight: '28px' }, onclick: (e) => {
				e.preventDefault();
				const p = pathOf(parts);
				pathOut.textContent = p;
				Omni.util.copy(p);
			} }, h('strong', null, key === null ? '$' : String(key)));
			if (value && typeof value === 'object') {
				const entries = Object.entries(value).filter(([k, v]) => matches(v, k, q));
				const det = h('details', { open: parts.length < 2 || !!q }, h('summary', null, label, h('span', { class: 'muted' }, Array.isArray(value) ? ` [${value.length}]` : ` {${Object.keys(value).length}}`)));
				const list = h('div', { style: { paddingLeft: '18px', borderLeft: '1px solid var(--line)', marginLeft: '6px' } });
				entries.forEach(([k, v]) => list.appendChild(node(Array.isArray(value) ? Number(k) : k, v, [...parts, Array.isArray(value) ? Number(k) : k], q)));
				det.appendChild(list);
				return det;
			}
			return h('div', null, label, ': ', h('span', { style: { color: typeof value === 'string' ? 'inherit' : 'var(--muted)' } }, show(value)));
		}

		const draw = () => {
			ctx.store.set('json', input.value);
			try {
				data = JSON.parse(input.value);
				input.removeAttribute('aria-invalid');
				tree.replaceChildren(node(null, data, [], filter.value.trim().toLowerCase()));
			} catch (err) {
				input.setAttribute('aria-invalid', 'true');
				tree.replaceChildren(Omni.forms.stateBox('error', 'Invalid JSON.', err.message));
			}
		};
		const setAll = (open) => tree.querySelectorAll('details').forEach((d) => (d.open = open));
		input.addEventListener('input', Omni.util.debounce(draw, 250));
		filter.addEventListener('input', Omni.util.debounce(draw, 150));
		root.appendChild(
			h('div', { class: 'io split' },
				h('div', { class: 'panel stack' }, h('label', { class: 'field-label' }, 'JSON'), input),
				h('div', { class: 'panel stack' }, h('div', { class: 'row' }, filter, h('button', { type: 'button', class: 'btn btn-small', onclick: () => setAll(true) }, 'Expand all'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => setAll(false) }, 'Collapse all')), h('p', null, 'Path: ', pathOut), tree),
			),
		);
		draw();
	},
});
