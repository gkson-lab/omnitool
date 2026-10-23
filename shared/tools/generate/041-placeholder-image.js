// No. 041 Placeholder image generator: sized images with a label, for layouts before the real assets exist.
Omni.register({
	no: 41,
	id: 'placeholder-image',
	name: 'Placeholder image generator',
	category: 'generate',
	keywords: ['placeholder', 'image', 'dummy', 'mockup', 'size', 'svg', 'png'],
	description: 'Images of any size labeled with their dimensions or your text, as PNG or SVG.',
	live: true,
	inputs: [
		{ name: 'width', label: 'Width', type: 'number', min: 1, max: 4000, default: 640 },
		{ name: 'height', label: 'Height', type: 'number', min: 1, max: 4000, default: 360 },
		{ name: 'label', label: 'Label', type: 'text', placeholder: 'Defaults to the size, e.g. 640 x 360' },
		{ name: 'bg', label: 'Background', type: 'color', default: '#e2d9d6' },
		{ name: 'fg', label: 'Text color', type: 'color', default: '#6c605d' },
	],
	run({ width, height, label, bg, fg }) {
		const w = Math.max(1, Math.min(4000, Math.round(width || 640)));
		const h = Math.max(1, Math.min(4000, Math.round(height || 360)));
		const text = (label || '').trim() || `${w} x ${h}`;
		const fontSize = Math.max(10, Math.min(w / Math.max(4, text.length * 0.62), h / 3));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = fg;
		ctx.globalAlpha = 0.35;
		ctx.lineWidth = Math.max(1, Math.min(w, h) / 200);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(w, h);
		ctx.moveTo(w, 0);
		ctx.lineTo(0, h);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.fillStyle = bg;
		ctx.font = `600 ${fontSize}px Archivo, sans-serif`;
		const tw = ctx.measureText(text).width;
		ctx.fillRect((w - tw) / 2 - fontSize * 0.4, h / 2 - fontSize * 0.75, tw + fontSize * 0.8, fontSize * 1.5);
		ctx.fillStyle = fg;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, w / 2, h / 2);
		const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${bg}"/><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="${fg}" stroke-opacity=".35"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${fontSize.toFixed(0)}" fill="${fg}">${esc}</text></svg>`;
		return { image: { src: canvas.toDataURL('image/png'), alt: `Placeholder ${w} by ${h}`, name: `placeholder-${w}x${h}.png`, label: `${w} x ${h} PNG` }, download: { name: `placeholder-${w}x${h}.svg`, data: svg, mime: 'image/svg+xml', label: 'Download SVG' } };
	},
});
