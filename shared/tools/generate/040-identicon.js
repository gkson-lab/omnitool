// No. 040 Identicon generator: a symmetric 5x5 pattern derived from the MD5 of any text.
Omni.register({
	no: 40,
	id: 'identicon',
	name: 'Identicon generator',
	category: 'generate',
	keywords: ['identicon', 'avatar', 'placeholder', 'hash', 'icon', 'profile'],
	description: 'Turns any text (a username, an email) into a repeatable geometric avatar. The same text always gives the same picture.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Text', type: 'text', default: 'omnitool' },
		{ name: 'size', label: 'Size (px)', type: 'number', min: 16, max: 1024, default: 160 },
		{ name: 'background', label: 'Background', type: 'select', options: [{ value: 'light', label: 'Light' }, { value: 'transparent', label: 'Transparent' }], default: 'light' },
	],
	run({ text, size, background }) {
		const hash = Omni.bytes.md5(Omni.bytes.utf8(text));
		const nib = hash.split('').map((c) => parseInt(c, 16));
		// Hue from the last bytes, then a 5x5 grid mirrored left to right from 15 hash bits.
		const hue = parseInt(hash.slice(-7), 16) % 360;
		const color = Omni.color.toHex(Omni.color.oklchToRgb(0.55, 0.13, hue));
		const cells = [];
		for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (nib[r * 3 + c] % 2 === 0) {
			cells.push([r, c]);
			if (c < 2) cells.push([r, 4 - c]);
		}
		const px = Math.max(16, Math.min(1024, size || 160));
		const pad = 0.5;
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 6 6" shape-rendering="crispEdges">${background === 'light' ? '<rect width="6" height="6" fill="#f0f0f0"/>' : ''}<g fill="${color}">${cells.map(([r, c]) => `<rect x="${c + pad}" y="${r + pad}" width="1" height="1"/>`).join('')}</g></svg>`;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = px;
		const ctx = canvas.getContext('2d');
		const u = px / 6;
		if (background === 'light') {
			ctx.fillStyle = '#f0f0f0';
			ctx.fillRect(0, 0, px, px);
		}
		ctx.fillStyle = color;
		cells.forEach(([r, c]) => ctx.fillRect(Math.round((c + pad) * u), Math.round((r + pad) * u), Math.ceil(u), Math.ceil(u)));
		return { image: { src: canvas.toDataURL('image/png'), alt: `Identicon for ${text}`, name: 'identicon.png', label: `Identicon (${color})` }, download: { name: 'identicon.svg', data: svg, mime: 'image/svg+xml', label: 'Download SVG' } };
	},
});
