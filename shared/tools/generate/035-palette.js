// No. 035 Color palette generator: harmonies and shade ramps from a base color, computed in OKLCH.
Omni.register({
	no: 35,
	id: 'palette',
	name: 'Color palette generator',
	category: 'generate',
	keywords: ['palette', 'color', 'scheme', 'harmony', 'complementary', 'shades', 'tints'],
	description: 'Builds complementary, analogous, triadic, tetradic, monochrome and shade palettes from one color. Click a swatch to copy it.',
	live: true,
	inputs: [
		{ name: 'base', label: 'Base color', type: 'color', default: '#c4242b' },
		{ name: 'harmony', label: 'Palette', type: 'select', options: [{ value: 'shades', label: 'Shades and tints (9 steps)' }, { value: 'complementary', label: 'Complementary' }, { value: 'analogous', label: 'Analogous' }, { value: 'triadic', label: 'Triadic' }, { value: 'tetradic', label: 'Tetradic' }, { value: 'split', label: 'Split complementary' }, { value: 'random', label: 'Random around the base' }], default: 'shades' },
	],
	run({ base, harmony }) {
		const C = Omni.color;
		const rgb = C.parse(base);
		if (!rgb) throw new Error('Pick a color.');
		const o = C.rgbToOklch(rgb);
		const at = (l, c, h) => C.toHex(C.oklchToRgb(Math.max(0, Math.min(1, l)), Math.max(0, c), ((h % 360) + 360) % 360));
		let colors;
		if (harmony === 'shades') colors = [0.97, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2].map((l) => at(l, o.c * (1 - Math.abs(l - 0.55) * 0.9), o.h));
		else if (harmony === 'random') {
			const rand = Omni.random.source();
			colors = Array.from({ length: 5 }, () => at(0.35 + rand() * 0.5, o.c * (0.5 + rand() * 0.6), o.h + (rand() - 0.5) * 80));
		} else {
			const offsets = { complementary: [0, 180], analogous: [-30, 0, 30], triadic: [0, 120, 240], tetradic: [0, 90, 180, 270], split: [0, 150, 210] }[harmony];
			colors = offsets.map((d) => at(o.l, o.c, o.h + d));
		}
		const { h } = Omni;
		const swatches = h('div', { class: 'swatches' }, colors.map((c) => h('button', { type: 'button', class: 'swatch', onclick: () => Omni.util.copy(c), 'aria-label': `Copy ${c}` }, h('span', { class: 'chip-color', style: { background: c } }), h('span', { class: 'swatch-label' }, c))));
		const css = `:root {\n${colors.map((c, i) => `  --palette-${i + 1}: ${c};`).join('\n')}\n}`;
		return { blocks: [{ type: 'node', node: Omni.forms.block('Palette', swatches) }, { type: 'text', label: 'CSS custom properties', value: css }, { type: 'text', label: 'Hex list', value: colors.join(', ') }] };
	},
});
