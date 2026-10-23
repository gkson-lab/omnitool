// No. 134 Favicon generator: favicons from letters or an image, as PNG sizes and a multi-size .ico.
(function () {
	'use strict';
	const SIZES = [16, 32, 48, 180, 192, 512];

	function drawIcon(size, src) {
		const c = document.createElement('canvas');
		c.width = c.height = size;
		const g = c.getContext('2d');
		if (src.image) {
			const s = Math.min(src.image.naturalWidth, src.image.naturalHeight);
			g.imageSmoothingQuality = 'high';
			g.drawImage(src.image, (src.image.naturalWidth - s) / 2, (src.image.naturalHeight - s) / 2, s, s, 0, 0, size, size);
		} else {
			const r = (src.radius / 100) * (size / 2);
			g.fillStyle = src.bg;
			g.beginPath();
			g.roundRect(0, 0, size, size, r);
			g.fill();
			g.fillStyle = src.fg;
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			g.font = `700 ${size * (src.text.length > 1 ? 0.5 : 0.62)}px Archivo, system-ui, sans-serif`;
			g.fillText(src.text, size / 2, size / 2 + size * 0.04);
		}
		return c;
	}

	/** ICO container holding PNG images (supported by every current browser and Windows Vista onward). */
	async function toIco(canvases) {
		const pngs = await Promise.all(canvases.map((c) => new Promise((r) => c.toBlob((b) => b.arrayBuffer().then(r), 'image/png'))));
		const head = 6 + 16 * pngs.length;
		const total = head + pngs.reduce((s, p) => s + p.byteLength, 0);
		const buf = new ArrayBuffer(total);
		const v = new DataView(buf);
		v.setUint16(2, 1, true);
		v.setUint16(4, pngs.length, true);
		let offset = head;
		pngs.forEach((p, i) => {
			const size = canvases[i].width;
			const e = 6 + i * 16;
			v.setUint8(e, size >= 256 ? 0 : size);
			v.setUint8(e + 1, size >= 256 ? 0 : size);
			v.setUint16(e + 4, 1, true);
			v.setUint16(e + 6, 32, true);
			v.setUint32(e + 8, p.byteLength, true);
			v.setUint32(e + 12, offset, true);
			new Uint8Array(buf, offset, p.byteLength).set(new Uint8Array(p));
			offset += p.byteLength;
		});
		return new Blob([buf], { type: 'image/x-icon' });
	}

	Omni.register({
		no: 134,
		id: 'favicon',
		name: 'Favicon generator',
		category: 'design',
		keywords: ['favicon', 'icon', 'ico', 'apple-touch-icon', 'pwa', 'site icon'],
		description: 'Makes favicons from one or two letters or from an image: a multi-size favicon.ico, PNGs from 16 to 512 px, and the HTML tags.',
		action: 'Make favicons',
		inputs: [
			{ name: 'source', label: 'From', type: 'seg', options: [{ value: 'text', label: 'Letters' }, { value: 'image', label: 'An image' }], default: 'text' },
			{ name: 'text', label: 'Letters (1 or 2)', type: 'text', default: 'O', when: (v) => v.source === 'text' },
			{ name: 'bg', label: 'Background', type: 'color', default: '#1d1716', when: (v) => v.source === 'text' },
			{ name: 'fg', label: 'Letter color', type: 'color', default: '#f6f3f2', when: (v) => v.source === 'text' },
			{ name: 'radius', label: 'Corner rounding (%)', type: 'range', min: 0, max: 100, default: 20, when: (v) => v.source === 'text' },
			{ name: 'file', label: 'Square-ish image', type: 'file', accept: 'image/*', when: (v) => v.source === 'image' },
		],
		async run({ source, text, bg, fg, radius, file }) {
			let src;
			if (source === 'image') {
				if (!file) return { note: 'Choose an image.' };
				const url = URL.createObjectURL(file);
				src = { image: await Omni.util.loadImage(url) };
			} else {
				if (!text.trim()) return { note: 'Type one or two letters.' };
				await document.fonts.load('700 32px Archivo').catch(() => {});
				src = { text: [...text.trim()].slice(0, 2).join(''), bg, fg, radius: Number(radius) || 0 };
			}
			const canvases = SIZES.map((s) => drawIcon(s, src));
			const ico = await toIco(canvases.filter((c) => c.width <= 48));
			const { h } = Omni;
			const row = h('div', { class: 'row', style: { alignItems: 'flex-end', gap: '16px' } }, canvases.map((c) => h('figure', { style: { margin: 0, textAlign: 'center' } }, h('img', { src: c.toDataURL(), alt: `${c.width} px icon`, width: Math.min(c.width, 96), height: Math.min(c.width, 96), style: { imageRendering: c.width < 48 ? 'pixelated' : 'auto' } }), h('figcaption', { class: 'muted mono', style: { fontSize: '0.72rem' } }, `${c.width}px`), h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.util.download(`icon-${c.width}.png`, Omni.util.dataUrlToBlob(c.toDataURL('image/png'))) }, 'PNG'))));
			return {
				node: Omni.forms.block('Sizes', row),
				download: { name: 'favicon.ico', data: ico, label: 'Download favicon.ico (16, 32, 48 px)' },
				text: '<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">\n<link rel="apple-touch-icon" href="/icon-180.png">\n<!-- In a web app manifest: icon-192.png and icon-512.png -->',
				label: 'HTML for the <head>',
			};
		},
	});
})();
