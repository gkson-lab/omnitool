// No. 081 Math notebook: line-by-line calculations with variables; each result shows beside its line.
Omni.register({
	no: 81,
	id: 'math-notebook',
	name: 'Math notebook',
	category: 'math',
	keywords: ['notebook', 'calculator', 'variables', 'soulver', 'scratch', 'math', 'sheet'],
	description: 'Write one calculation per line, name results (rent = 1200) and reuse them below. "ans" is the line above. Saved as you type.',
	inputs: [{ name: 'text', label: 'Lines', type: 'textarea', mono: true, default: 'price = 49.99\nqty = 12\nsubtotal = price * qty\ntax = subtotal * 0.2\nsubtotal + tax' }],
	run({ text }) {
		const vars = {};
		let ans = 0;
		const rows = text.split('\n').map((line, i) => {
			const src = line.replace(/#.*/, '').trim();
			if (!src) return [i + 1, line, ''];
			const m = src.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
			try {
				const v = Omni.math.evaluate(m ? m[2] : src, { ...vars, ans }, {});
				if (m) vars[m[1]] = v;
				ans = v;
				return [i + 1, line, Omni.math.format(v, 12)];
			} catch (err) {
				return [i + 1, line, `error: ${err.message}`];
			}
		});
		return { table: { columns: ['Line', 'Input', 'Result'], rows, numeric: [0, 2] }, readings: [{ label: 'Last result', value: Omni.math.format(ans, 12) }] };
	},
	mount(root, ctx) {
		const { h } = Omni;
		const ta = h('textarea', { class: 'code', id: 'nb-text', spellcheck: 'false', 'aria-label': 'Notebook lines', style: { minHeight: '420px', lineHeight: '28px', padding: '6px 10px', resize: 'vertical' } });
		ta.value = ctx.store.get('text', Omni.byId['math-notebook'].inputs[0].default);
		const results = h('div', { 'aria-live': 'polite', style: { fontFamily: 'var(--font-mono)', fontStretch: '87.5%', fontSize: '0.84rem', lineHeight: '28px', padding: '7px 10px', minHeight: '420px', borderRadius: 'var(--r-control)', background: 'var(--sunken)', overflow: 'hidden' } });
		const draw = () => {
			ctx.store.set('text', ta.value);
			const r = Omni.byId['math-notebook'].run({ text: ta.value });
			results.replaceChildren(...r.table.rows.map(([, , res]) => h('div', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: res.startsWith('error') ? 'var(--signal)' : 'inherit', height: '28px' }, title: res }, res || ' ')));
			results.scrollTop = ta.scrollTop;
		};
		ta.addEventListener('input', draw);
		ta.addEventListener('scroll', () => (results.scrollTop = ta.scrollTop));
		root.appendChild(h('div', { class: 'panel stack' },
			h('label', { for: 'nb-text', class: 'field-label' }, 'One calculation per line. "name = expression" stores a value; # starts a comment.'),
			h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '12px' } }, ta, results),
			h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.util.copy(ta.value.split('\n').map((l, i) => `${l}${results.children[i] && results.children[i].textContent.trim() ? '  = ' + results.children[i].textContent : ''}`).join('\n')) }, 'Copy with results'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
				ta.value = '';
				draw();
				ta.focus();
			} }, 'Clear')),
		));
		draw();
	},
});
