// No. 056 Image converter: PNG, JPEG and WebP with resizing and quality, done locally on a canvas.
Omni.register({
	no: 56,
	id: 'image-converter',
	name: 'Image converter',
	category: 'convert',
	keywords: ['image', 'convert', 'png', 'jpg', 'jpeg', 'webp', 'resize', 'compress', 'svg'],
	description: 'Converts images (including SVG) to PNG, JPEG or WebP, resizes them and sets the quality. Nothing is uploaded.',
	action: 'Convert',
	inputs: [
		{ name: 'file', label: 'Image', type: 'file', accept: 'image/*' },
		{ name: 'format', label: 'Convert to', type: 'select', options: [{ value: 'image/png', label: 'PNG' }, { value: 'image/jpeg', label: 'JPEG' }, { value: 'image/webp', label: 'WebP' }], default: 'image/webp' },
		{ name: 'quality', label: 'Quality (JPEG and WebP)', type: 'range', min: 10, max: 100, default: 82 },
		{ name: 'width', label: 'Width (blank keeps it)', type: 'number', min: 1, max: 12000 },
		{ name: 'height', label: 'Height (blank keeps the ratio)', type: 'number', min: 1, max: 12000 },
		{ name: 'background', label: 'Fill transparent areas (JPEG)', type: 'color', default: '#ffffff', when: (v) => v.format === 'image/jpeg' },
	],
	async run({ file, format, quality, width, height, background }) {
		if (!file) return { note: 'Choose an image.' };
		const url = URL.createObjectURL(file);
		try {
			const img = await Omni.util.loadImage(url);
			const w0 = img.naturalWidth || 512;
			const h0 = img.naturalHeight || 512;
			let w = width || (height ? Math.round((w0 * height) / h0) : w0);
			let h = height || (width ? Math.round((h0 * width) / w0) : h0);
			w = Math.max(1, Math.min(12000, w));
			h = Math.max(1, Math.min(12000, h));
			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d');
			if (format === 'image/jpeg') {
				ctx.fillStyle = background || '#ffffff';
				ctx.fillRect(0, 0, w, h);
			}
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, 0, 0, w, h);
			const blob = await new Promise((resolve) => canvas.toBlob(resolve, format, (quality || 82) / 100));
			if (!blob) throw new Error('This browser cannot encode that format.');
			if (blob.type !== format) throw new Error(`This browser cannot write ${format.split('/')[1].toUpperCase()}; it produced ${blob.type} instead.`);
			const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[format];
			const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
			const change = 1 - blob.size / file.size;
			return {
				image: { src: URL.createObjectURL(blob), alt: `Converted ${file.name}`, label: `${w} x ${h} ${ext.toUpperCase()}` },
				readings: [{ label: 'Original', value: `${w0} x ${h0}, ${Omni.util.fmt.bytes(file.size)}`, copy: false }, { label: 'Converted', value: `${w} x ${h}, ${Omni.util.fmt.bytes(blob.size)}`, copy: false }, { label: 'Size change', value: `${change >= 0 ? '-' : '+'}${Math.abs(Math.round(change * 100))}%`, copy: false }],
				download: { name, data: blob, label: `Download ${name}` },
			};
		} finally {
			URL.revokeObjectURL(url);
		}
	},
});
