// No. 077 Aspect ratio calculator: simplify a ratio and solve the missing side when resizing.
Omni.register({
	no: 77,
	id: 'aspect-ratio',
	name: 'Aspect ratio calculator',
	category: 'math',
	keywords: ['aspect ratio', '16:9', 'resize', 'width', 'height', 'video', 'image', 'ratio'],
	description: 'Simplifies a width and height to a ratio (1920 x 1080 is 16:9) and works out the other side for a new width or height.',
	live: true,
	inputs: [
		{ name: 'w', label: 'Original width', type: 'number', min: 1, step: 'any', default: 1920 },
		{ name: 'h', label: 'Original height', type: 'number', min: 1, step: 'any', default: 1080 },
		{ name: 'newW', label: 'New width (optional)', type: 'number', min: 1, step: 'any', default: 1280 },
		{ name: 'newH', label: 'New height (optional)', type: 'number', min: 1, step: 'any' },
	],
	run({ w, h, newW, newH }) {
		if (!(w > 0 && h > 0)) return { note: 'Enter a width and height.' };
		const scale = 1000;
		const W = Math.round(w * scale);
		const H = Math.round(h * scale);
		const g = Omni.math.gcd(W, H);
		const known = { '16:9': 16 / 9, '4:3': 4 / 3, '3:2': 3 / 2, '21:9 (64:27)': 64 / 27, '1:1': 1, '9:16': 9 / 16, '5:4': 1.25, '2:1': 2, '1.85:1': 1.85, '2.39:1': 2.39 };
		const ratio = w / h;
		const near = Object.entries(known).find(([, v]) => Math.abs(v - ratio) / v < 0.01);
		const readings = [{ label: 'Ratio', value: `${W / g}:${H / g}` }, { label: 'Decimal', value: ratio.toFixed(4) }, { label: 'Closest common ratio', value: near ? near[0] : 'none within 1%', copy: false }];
		if (newW) readings.push({ label: `Height for width ${newW}`, value: Omni.math.format(newW / ratio, 6) });
		if (newH) readings.push({ label: `Width for height ${newH}`, value: Omni.math.format(newH * ratio, 6) });
		return { readings, text: `aspect-ratio: ${W / g} / ${H / g};`, label: 'CSS' };
	},
});
