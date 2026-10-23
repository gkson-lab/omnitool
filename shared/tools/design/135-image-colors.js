// No. 135 Image color extractor: the dominant colors of an image by k-means clustering in OKLab-ish space.
Omni.register({
	no: 135,
	id: 'image-colors',
	name: 'Image color extractor',
	category: 'design',
	keywords: ['palette from image', 'dominant colors', 'extract colors', 'kmeans', 'photo', 'swatches'],
	description: 'Finds the dominant colors of an image and how much of it each covers. The image never leaves this device.',
	action: 'Extract colors',
	inputs: [
		{ name: 'file', label: 'Image', type: 'file', accept: 'image/*' },
		{ name: 'k', label: 'Number of colors', type: 'number', min: 2, max: 12, default: 6 },
	],
	async run({ file, k }) {
		if (!file) return { note: 'Choose an image.' };
		const url = URL.createObjectURL(file);
		const img = await Omni.util.loadImage(url);
		const scale = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
		const c = document.createElement('canvas');
		c.width = Math.max(1, Math.round(img.naturalWidth * scale));
		c.height = Math.max(1, Math.round(img.naturalHeight * scale));
		const g = c.getContext('2d', { willReadFrequently: true });
		g.drawImage(img, 0, 0, c.width, c.height);
		URL.revokeObjectURL(url);
		const data = g.getImageData(0, 0, c.width, c.height).data;
		const C = Omni.color;
		const px = [];
		for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) {
			const o = C.rgbToOklch({ r: data[i], g: data[i + 1], b: data[i + 2] });
			px.push([o.l, o.c * Math.cos((o.h * Math.PI) / 180), o.c * Math.sin((o.h * Math.PI) / 180), data[i], data[i + 1], data[i + 2]]);
		}
		if (!px.length) throw new Error('The image is fully transparent.');
		const K = Math.max(2, Math.min(12, k || 6));
		// k-means++ seeding, then Lloyd iterations on the perceptual coordinates.
		const rand = Omni.random.source('omnitool');
		const centers = [px[Math.floor(rand() * px.length)].slice(0, 3)];
		const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
		while (centers.length < K) {
			const dist = px.map((p) => Math.min(...centers.map((q) => d2(p, q))));
			const sum = dist.reduce((a, b) => a + b, 0);
			let t = rand() * sum;
			let idx = 0;
			while (t > dist[idx] && idx < px.length - 1) t -= dist[idx++];
			centers.push(px[idx].slice(0, 3));
		}
		let assign = new Array(px.length).fill(0);
		for (let iter = 0; iter < 12; iter++) {
			assign = px.map((p) => {
				let best = 0;
				let bd = Infinity;
				centers.forEach((q, j) => {
					const d = d2(p, q);
					if (d < bd) {
						bd = d;
						best = j;
					}
				});
				return best;
			});
			for (let j = 0; j < K; j++) {
				const members = px.filter((_, i) => assign[i] === j);
				if (members.length) centers[j] = [0, 1, 2].map((d) => members.reduce((s, p) => s + p[d], 0) / members.length);
			}
		}
		const clusters = centers.map((_, j) => {
			const members = px.filter((_, i) => assign[i] === j);
			if (!members.length) return null;
			const avg = [3, 4, 5].map((d) => members.reduce((s, p) => s + p[d], 0) / members.length);
			return { hex: C.toHex({ r: avg[0], g: avg[1], b: avg[2] }), share: members.length / px.length };
		}).filter(Boolean).sort((a, b) => b.share - a.share);
		const { h } = Omni;
		return {
			node: Omni.forms.block('Dominant colors (click to copy)', h('div', { class: 'swatches' }, clusters.map((cl) => h('button', { type: 'button', class: 'swatch', onclick: () => Omni.util.copy(cl.hex) }, h('span', { class: 'chip-color', style: { background: cl.hex } }), h('span', { class: 'swatch-label' }, `${cl.hex} · ${(cl.share * 100).toFixed(1)}%`))))),
			text: clusters.map((cl) => cl.hex).join(', '),
			label: 'Hex list',
			image: { src: c.toDataURL(), alt: 'Analyzed image', label: 'Image (downscaled for analysis)' },
		};
	},
});
