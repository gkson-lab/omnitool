// No. 131 Contrast checker: WCAG 2 contrast ratio and AA/AAA verdicts, with a nearest passing color suggestion.
Omni.register({
	no: 131,
	id: 'contrast',
	name: 'Contrast checker',
	category: 'design',
	keywords: ['contrast', 'wcag', 'accessibility', 'a11y', 'aa', 'aaa', 'readable', 'color'],
	description: 'Computes the WCAG contrast ratio of a text color on a background, says which AA and AAA levels pass, and suggests the nearest passing text color.',
	live: true,
	inputs: [
		{ name: 'fg', label: 'Text color', type: 'text', mono: true, default: '#6c605d' },
		{ name: 'bg', label: 'Background color', type: 'text', mono: true, default: '#f6f3f2' },
	],
	run({ fg, bg }) {
		const C = Omni.color;
		const f = C.parse(fg);
		const b = C.parse(bg);
		if (!f || !b) throw new Error('Enter two colors, for example #333333 and white.');
		const ratio = C.contrast(f, b);
		const pass = (n) => (ratio >= n ? 'Pass' : 'Fail');
		// Darken or lighten the text in OKLCH until AA passes, keeping its hue.
		let suggestion = null;
		if (ratio < 4.5) {
			const o = C.rgbToOklch(f);
			const darker = C.luminance(b) > 0.18;
			for (let l = o.l; l >= 0 && l <= 1; l += darker ? -0.01 : 0.01) {
				const c = C.oklchToRgb(l, o.c, o.h);
				if (C.contrast(c, b) >= 4.5) {
					suggestion = C.toHex(c);
					break;
				}
			}
		}
		const { h } = Omni;
		const sample = h('div', { style: { padding: '20px', borderRadius: 'var(--r-panel)', border: '1px solid var(--line)', background: C.toHex(b), color: C.toHex(f) } }, h('p', { style: { fontSize: '1.4rem', fontWeight: 700, margin: 0 } }, 'Large text sample (18px bold and up)'), h('p', { style: { margin: '6px 0 0' } }, 'Normal body text sample. The quick brown fox jumps over the lazy dog.'));
		return {
			node: sample,
			meter: { value: Math.min(1, (ratio - 1) / 20), label: 'Contrast ratio (21:1 is the maximum)', text: `${ratio.toFixed(2)}:1` },
			table: { columns: ['Use', 'Needs', 'Result'], rows: [['Normal text, AA', '4.5:1', pass(4.5)], ['Large text, AA', '3:1', pass(3)], ['Normal text, AAA', '7:1', pass(7)], ['Large text, AAA', '4.5:1', pass(4.5)], ['Icons and control borders', '3:1', pass(3)]] },
			readings: suggestion ? [{ label: 'Nearest text color that passes AA', value: suggestion }] : null,
		};
	},
});
