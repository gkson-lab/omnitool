// No. 038 Barcode generator: Code 128 (sets B and C, switching for digit runs) as SVG or PNG.
(function () {
	'use strict';
	// Bar and space widths for code values 0-106 (106 is the stop pattern, which has 7 widths).
	const PATTERNS = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
	const START_B = 104;
	const START_C = 105;
	const CODE_B = 100;
	const CODE_C = 99;

	/** Encodes text as Code 128 values, using set C for runs of 4+ digits to keep the barcode short. */
	function encode(text) {
		if (!text) throw new Error('Type something to encode.');
		for (const ch of text) if (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126) throw new Error(`"${ch}" cannot be encoded; Code 128 here supports printable ASCII.`);
		const values = [];
		let set = /^\d{4}/.test(text) ? 'C' : 'B';
		values.push(set === 'C' ? START_C : START_B);
		let i = 0;
		while (i < text.length) {
			const digits = text.slice(i).match(/^\d+/);
			const run = digits ? digits[0].length : 0;
			if (set === 'B' && run >= 4) {
				values.push(CODE_C);
				set = 'C';
			} else if (set === 'C' && run < 2) {
				values.push(CODE_B);
				set = 'B';
			}
			if (set === 'C') {
				values.push(Number(text.substr(i, 2)));
				i += 2;
			} else {
				values.push(text.charCodeAt(i) - 32);
				i++;
			}
		}
		const check = values.reduce((sum, v, k) => sum + v * (k === 0 ? 1 : k), 0) % 103;
		values.push(check, 106);
		return values;
	}

	function modules(values) {
		const bars = [];
		for (const v of values) PATTERNS[v].split('').forEach((w, k) => bars.push({ dark: k % 2 === 0, w: Number(w) }));
		return bars;
	}

	Omni.register({
		no: 38,
		id: 'barcode',
		name: 'Barcode generator',
		category: 'generate',
		keywords: ['barcode', 'code128', 'code 128', 'label', 'sku'],
		description: 'Code 128 barcodes for any printable ASCII text, as SVG or PNG.',
		live: true,
		inputs: [
			{ name: 'text', label: 'Text', type: 'text', default: 'OMNI-0042-2026' },
			{ name: 'module', label: 'Bar width (px)', type: 'number', min: 1, max: 8, default: 2 },
			{ name: 'height', label: 'Height (px)', type: 'number', min: 20, max: 400, default: 90 },
			{ name: 'label', label: 'Print the text under the bars', type: 'checkbox', default: true },
		],
		run({ text, module, height, label }) {
			const bars = modules(encode(text));
			const m = Math.max(1, Math.min(8, module || 2));
			const hgt = Math.max(20, Math.min(400, height || 90));
			const quiet = 10;
			const total = bars.reduce((s, b) => s + b.w, 0) + quiet * 2;
			const textH = label ? 18 : 0;
			let x = quiet;
			const rects = [];
			for (const b of bars) {
				if (b.dark) rects.push(`<rect x="${x}" y="0" width="${b.w}" height="${hgt / m}"/>`);
				x += b.w;
			}
			const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total * m}" height="${hgt + textH}" viewBox="0 0 ${total} ${(hgt + textH) / m}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects.join('')}</g>${label ? `<text x="${total / 2}" y="${(hgt + textH - 4) / m}" font-family="monospace" font-size="${12 / m}" text-anchor="middle">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>` : ''}</svg>`;
			const canvas = document.createElement('canvas');
			canvas.width = total * m;
			canvas.height = hgt + textH;
			const ctx = canvas.getContext('2d');
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = '#000';
			x = quiet;
			for (const b of bars) {
				if (b.dark) ctx.fillRect(x * m, 0, b.w * m, hgt);
				x += b.w;
			}
			if (label) {
				ctx.font = '12px monospace';
				ctx.textAlign = 'center';
				ctx.fillText(text, canvas.width / 2, hgt + 14);
			}
			return { image: { src: canvas.toDataURL('image/png'), alt: `Code 128 barcode for ${text}`, name: 'barcode.png', label: `Code 128, ${total} modules` }, download: { name: 'barcode.svg', data: svg, mime: 'image/svg+xml', label: 'Download SVG' } };
		},
	});
})();
