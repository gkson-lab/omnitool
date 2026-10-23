// No. 129 Box shadow generator: layered shadows with a live preview and the CSS.
Omni.register({
	no: 129,
	id: 'box-shadow',
	name: 'Box shadow generator',
	category: 'design',
	keywords: ['box-shadow', 'shadow', 'css', 'elevation', 'drop shadow'],
	description: 'Layers several box shadows (offset, blur, spread, color, inset) with a live preview, and gives you the CSS.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let layers = ctx.store.get('layers', [{ x: 0, y: 1, blur: 2, spread: 0, color: '#1d1716', alpha: 6, inset: false }, { x: 0, y: 12, blur: 32, spread: -12, color: '#1d1716', alpha: 22, inset: false }]);
		const boxBg = h('input', { type: 'color', id: 'bs-bg', value: ctx.store.get('bg', '#ffffff') });
		const preview = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px', borderRadius: 'var(--r-panel)', background: 'var(--sunken)' } });
		const box = h('div', { style: { width: '180px', height: '120px', borderRadius: '14px' } });
		preview.appendChild(box);
		const list = h('div', { class: 'stack' });
		const out = h('div');
		const value = () => layers.map((l) => {
			const c = Omni.color.parse(l.color);
			return `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px rgb(${c.r} ${c.g} ${c.b} / ${(l.alpha / 100).toFixed(2)})`;
		}).join(',\n    ');
		const draw = () => {
			ctx.store.set('layers', layers);
			ctx.store.set('bg', boxBg.value);
			box.style.background = boxBg.value;
			box.style.boxShadow = value().replace(/\n\s*/g, ' ');
			out.replaceChildren(Omni.forms.renderBlock({ type: 'text', label: 'CSS', value: `box-shadow: ${value() || 'none'};` }));
		};
		const slider = (l, key, label, min, max) => {
			const el = h('input', { type: 'range', min, max, value: l[key], 'aria-label': label });
			const num = h('span', { class: 'mono', style: { width: '3.2em', textAlign: 'right' } }, l[key]);
			el.addEventListener('input', () => ((l[key] = Number(el.value)), (num.textContent = el.value), draw()));
			return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, el, num));
		};
		const drawList = () => {
			list.replaceChildren(...layers.map((l, i) => {
				const color = h('input', { type: 'color', value: l.color, 'aria-label': `Layer ${i + 1} color` });
				color.addEventListener('input', () => ((l.color = color.value), draw()));
				const inset = h('input', { type: 'checkbox', id: `bs-inset-${i}`, checked: l.inset, onchange: () => ((l.inset = inset.checked), draw()) });
				return h('details', { open: i === layers.length - 1 }, h('summary', null, `Layer ${i + 1}`), h('div', { class: 'fields', style: { marginTop: '8px' } }, slider(l, 'x', 'X offset', -50, 50), slider(l, 'y', 'Y offset', -50, 50), slider(l, 'blur', 'Blur', 0, 100), slider(l, 'spread', 'Spread', -50, 50), slider(l, 'alpha', 'Opacity %', 0, 100), h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Color'), color), h('div', { class: 'field check' }, inset, h('label', { for: inset.id }, 'Inset')), layers.length > 1 ? h('button', { type: 'button', class: 'btn btn-small', onclick: () => (layers.splice(i, 1), drawList(), draw()) }, icon('trash'), 'Remove layer') : null));
			}), h('button', { type: 'button', class: 'btn btn-small', onclick: () => (layers.push({ x: 0, y: 4, blur: 8, spread: 0, color: '#000000', alpha: 15, inset: false }), drawList(), draw()) }, icon('plus'), 'Add layer'));
		};
		boxBg.addEventListener('input', draw);
		root.appendChild(h('div', { class: 'io split' }, h('div', { class: 'panel stack' }, list), h('div', { class: 'panel stack' }, preview, h('div', { class: 'field' }, h('label', { for: 'bs-bg' }, 'Box color'), boxBg), out)));
		drawList();
		draw();
	},
});
