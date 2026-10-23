// No. 128 Gradient builder: linear, radial and conic CSS gradients with editable stops and a live preview.
Omni.register({
	no: 128,
	id: 'gradient',
	name: 'Gradient builder',
	category: 'design',
	keywords: ['gradient', 'css', 'linear-gradient', 'radial', 'conic', 'background'],
	description: 'Builds linear, radial and conic CSS gradients with as many color stops as you need, and gives you the CSS.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		const st = ctx.store.get('state', { type: 'linear', angle: 135, stops: [{ color: '#f6f3f2', at: 0 }, { color: '#c4242b', at: 100 }] });
		const type = h('select', { id: 'gr-type' }, h('option', { value: 'linear' }, 'Linear'), h('option', { value: 'radial' }, 'Radial'), h('option', { value: 'conic' }, 'Conic'));
		type.value = st.type;
		const angle = h('input', { type: 'range', id: 'gr-angle', min: 0, max: 360, value: st.angle });
		const stopsBox = h('div', { class: 'stack' });
		const preview = h('div', { style: { height: '240px', borderRadius: 'var(--r-panel)', border: '1px solid var(--line)' }, role: 'img', 'aria-label': 'Gradient preview' });
		const out = h('div');
		const css = () => {
			const stops = st.stops.slice().sort((a, b) => a.at - b.at).map((s) => `${s.color} ${s.at}%`).join(', ');
			return st.type === 'linear' ? `linear-gradient(${st.angle}deg, ${stops})` : st.type === 'radial' ? `radial-gradient(circle at center, ${stops})` : `conic-gradient(from ${st.angle}deg at center, ${stops})`;
		};
		const draw = () => {
			st.type = type.value;
			st.angle = Number(angle.value);
			ctx.store.set('state', st);
			angle.closest('.field').hidden = st.type === 'radial';
			const value = css();
			preview.style.background = value;
			out.replaceChildren(Omni.forms.renderBlock({ type: 'text', label: 'CSS', value: `background: ${value};` }));
		};
		const drawStops = () => {
			stopsBox.replaceChildren(...st.stops.map((s, i) => {
				const c = h('input', { type: 'color', value: s.color, 'aria-label': `Stop ${i + 1} color`, style: { width: '64px' } });
				const at = h('input', { type: 'range', min: 0, max: 100, value: s.at, 'aria-label': `Stop ${i + 1} position` });
				const num = h('span', { class: 'mono', style: { width: '3.5em' } }, `${s.at}%`);
				c.addEventListener('input', () => ((s.color = c.value), draw()));
				at.addEventListener('input', () => ((s.at = Number(at.value)), (num.textContent = `${s.at}%`), draw()));
				return h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, c, at, num, st.stops.length > 2 ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove stop ${i + 1}`, onclick: () => (st.stops.splice(i, 1), drawStops(), draw()) }, icon('close')) : null);
			}), h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
				st.stops.push({ color: '#255d86', at: 50 });
				drawStops();
				draw();
			} }, icon('plus'), 'Add stop'));
		};
		type.addEventListener('change', draw);
		angle.addEventListener('input', draw);
		root.appendChild(h('div', { class: 'io split' },
			h('div', { class: 'panel stack' }, h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'gr-type' }, 'Type'), type), h('div', { class: 'field' }, h('label', { for: 'gr-angle' }, 'Angle'), angle)), h('h2', null, 'Color stops'), stopsBox),
			h('div', { class: 'panel stack' }, preview, out),
		));
		drawStops();
		draw();
	},
});
