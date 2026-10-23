// No. 057 Color format converter: any CSS color to HEX, RGB, HSL, HSV, CMYK and OKLCH.
Omni.register({
	no: 57,
	id: 'color-converter',
	name: 'Color format converter',
	category: 'convert',
	keywords: ['color', 'hex', 'rgb', 'hsl', 'hsv', 'cmyk', 'oklch', 'convert'],
	description: 'Converts a color between HEX, RGB, HSL, HSV, CMYK and OKLCH. Accepts any of those or a CSS color name.',
	live: true,
	inputs: [{ name: 'color', label: 'Color', type: 'text', mono: true, default: 'hsl(357, 69%, 46%)', hint: 'For example #c4242b, rgb(196 36 43), hsl(357, 69%, 46%), oklch(54% 0.19 25) or tomato' }],
	run({ color }) {
		const C = Omni.color;
		const c = C.parse(color);
		if (!c) throw new Error('Cannot read that color. Try #rrggbb, rgb(), hsl(), hsv(), oklch() or a CSS name.');
		const f = C.formats(c);
		const { h } = Omni;
		const swatch = h('div', { style: { height: '72px', borderRadius: '8px', border: '1px solid var(--line)', background: f.hex, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.readableOn(c), fontFamily: 'var(--font-mono)' } }, f.hex);
		return {
			node: swatch,
			readings: [
				{ label: 'HEX', value: f.hex },
				{ label: 'RGB', value: f.rgb },
				{ label: 'HSL', value: f.hsl },
				{ label: 'HSV', value: f.hsv },
				{ label: 'CMYK', value: f.cmyk },
				{ label: 'OKLCH', value: f.oklch },
				{ label: 'Contrast on white / black', value: `${C.contrast(c, { r: 255, g: 255, b: 255 }).toFixed(2)} / ${C.contrast(c, { r: 0, g: 0, b: 0 }).toFixed(2)}`, copy: false },
			],
		};
	},
});
