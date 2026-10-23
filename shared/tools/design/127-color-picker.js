// No. 127 Color picker: pick, adjust in HSL, sample the screen with the EyeDropper (where supported), keep recent colors.
Omni.register({
	no: 127,
	id: 'color-picker',
	name: 'Color picker',
	category: 'design',
	keywords: ['color picker', 'eyedropper', 'pick color', 'hex', 'swatch', 'hsl'],
	description: 'Pick a color, fine-tune hue, saturation and lightness, sample any pixel on screen where the browser allows it, and reuse recent colors.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const C = Omni.color;
		let current = C.parse(ctx.store.get('color', '#c4242b'));
		let recent = ctx.store.get('recent', []);
		const native = h('input', { type: 'color', id: 'cp-native', 'aria-label': 'Color' });
		const sliders = ['Hue', 'Saturation', 'Lightness'].map((l, i) => h('input', { type: 'range', id: `cp-${l}`, min: 0, max: i ? 100 : 360, step: 1, 'aria-label': l }));
		const sample = h('div', { style: { height: '140px', borderRadius: 'var(--r-panel)', border: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', padding: '12px', fontFamily: 'var(--font-mono)' } });
		const out = h('div');
		const recentBox = h('div', { class: 'swatches' });
		const set = (c, from) => {
			current = c;
			const hex = C.toHex({ ...c, a: 1 });
			ctx.store.set('color', hex);
			if (from !== 'native') native.value = hex;
			if (from !== 'sliders') {
				const hsl = C.rgbToHsl(c);
				sliders[0].value = Math.round(hsl.h);
				sliders[1].value = Math.round(hsl.s);
				sliders[2].value = Math.round(hsl.l);
			}
			sample.style.background = hex;
			sample.style.color = C.readableOn(c);
			sample.textContent = hex;
			const f = C.formats(c);
			out.replaceChildren(Omni.forms.readings([{ label: 'HEX', value: f.hex }, { label: 'RGB', value: f.rgb }, { label: 'HSL', value: f.hsl }, { label: 'OKLCH', value: f.oklch }, { label: 'Contrast on white', value: C.contrast(c, { r: 255, g: 255, b: 255 }).toFixed(2), copy: false }, { label: 'Contrast on black', value: C.contrast(c, { r: 0, g: 0, b: 0 }).toFixed(2), copy: false }]));
		};
		const remember = () => {
			const hex = C.toHex({ ...current, a: 1 });
			recent = [hex, ...recent.filter((x) => x !== hex)].slice(0, 16);
			ctx.store.set('recent', recent);
			drawRecent();
		};
		const drawRecent = () => recentBox.replaceChildren(...(recent.length ? recent.map((hex) => h('button', { type: 'button', class: 'swatch', onclick: () => set(C.parse(hex)), 'aria-label': `Use ${hex}` }, h('span', { class: 'chip-color', style: { background: hex, height: '40px' } }), h('span', { class: 'swatch-label' }, hex))) : [h('p', { class: 'muted' }, 'Colors you keep appear here.')]));
		native.addEventListener('input', () => set(C.parse(native.value), 'native'));
		sliders.forEach((s) => s.addEventListener('input', () => set(C.hslToRgb(+sliders[0].value, +sliders[1].value, +sliders[2].value), 'sliders')));
		const eyedrop = 'EyeDropper' in window ? h('button', { type: 'button', class: 'btn', onclick: async () => {
			try {
				const r = await new window.EyeDropper().open();
				set(C.parse(r.sRGBHex));
				remember();
			} catch {
				// Cancelled with Escape.
			}
		} }, 'Pick from screen') : h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Picking from the screen needs a Chromium browser (Edge or Chrome).');
		root.appendChild(h('div', { class: 'io split' },
			h('div', { class: 'panel stack' }, sample, h('div', { class: 'field' }, h('label', { for: 'cp-native' }, 'Color'), native), ...sliders.map((s, i) => h('div', { class: 'field' }, h('label', { for: s.id }, ['Hue', 'Saturation', 'Lightness'][i]), s)), h('div', { class: 'row' }, eyedrop, h('button', { type: 'button', class: 'btn', onclick: remember }, 'Keep this color'))),
			h('div', { class: 'panel stack' }, out, h('h2', null, 'Recent'), recentBox),
		));
		set(current);
		drawRecent();
	},
});
