// No. 150 ASCII art generator: block-letter banners from a built-in 5x5 font, and images turned into characters.
(function () {
	'use strict';
	// 5 rows per glyph; "#" is ink. Drawn for this tool so there are no font license questions.
	const FONT = {
		A: ['.###.', '#...#', '#####', '#...#', '#...#'], B: ['####.', '#...#', '####.', '#...#', '####.'], C: ['.####', '#....', '#....', '#....', '.####'], D: ['####.', '#...#', '#...#', '#...#', '####.'],
		E: ['#####', '#....', '####.', '#....', '#####'], F: ['#####', '#....', '####.', '#....', '#....'], G: ['.####', '#....', '#..##', '#...#', '.####'], H: ['#...#', '#...#', '#####', '#...#', '#...#'],
		I: ['#####', '..#..', '..#..', '..#..', '#####'], J: ['..###', '...#.', '...#.', '#..#.', '.##..'], K: ['#...#', '#..#.', '###..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#####'],
		M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'], O: ['.###.', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '####.', '#....', '#....'],
		Q: ['.###.', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '####.', '#..#.', '#...#'], S: ['.####', '#....', '.###.', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..'],
		U: ['#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
		Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'], Z: ['#####', '...#.', '..#..', '.#...', '#####'],
		0: ['.###.', '#..##', '#.#.#', '##..#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '.###.'], 2: ['.###.', '#...#', '..##.', '.#...', '#####'], 3: ['####.', '....#', '.###.', '....#', '####.'],
		4: ['#..#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '####.'], 6: ['.###.', '#....', '####.', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '..#..'],
		8: ['.###.', '#...#', '.###.', '#...#', '.###.'], 9: ['.###.', '#...#', '.####', '....#', '.###.'],
		' ': ['...', '...', '...', '...', '...'], '!': ['#', '#', '#', '.', '#'], '?': ['.###.', '#...#', '..##.', '.....', '..#..'], '.': ['.', '.', '.', '.', '#'], ',': ['..', '..', '..', '.#', '#.'],
		'-': ['....', '....', '####', '....', '....'], ':': ['.', '#', '.', '#', '.'], '#': ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'], '/': ['....#', '...#.', '..#..', '.#...', '#....'], "'": ['#', '#', '.', '.', '.'],
	};

	function banner(text, ink, gap) {
		const rows = ['', '', '', '', ''];
		for (const ch of text.toUpperCase()) {
			const g = FONT[ch] || FONT['?'];
			for (let r = 0; r < 5; r++) rows[r] += g[r].replace(/#/g, ink).replace(/\./g, ' ') + ' '.repeat(gap);
		}
		return rows.map((r) => r.replace(/\s+$/, '')).join('\n');
	}

	Omni.register({
		no: 150,
		id: 'ascii-art',
		name: 'ASCII art generator',
		category: 'fun',
		keywords: ['ascii', 'art', 'banner', 'text art', 'figlet', 'image to ascii'],
		description: 'Turns text into big block-letter banners, or an image into ASCII characters, ready to paste into a README or terminal.',
		inputs: [
			{ name: 'mode', label: 'Make', type: 'seg', options: [{ value: 'banner', label: 'Text banner' }, { value: 'image', label: 'Image to ASCII' }], default: 'banner' },
			{ name: 'text', label: 'Text', type: 'text', default: 'OmniTool', when: (v) => v.mode === 'banner' },
			{ name: 'ink', label: 'Character', type: 'select', options: [{ value: '#', label: '#' }, { value: '█', label: '█ (block)' }, { value: '*', label: '*' }, { value: '@', label: '@' }], default: '█', when: (v) => v.mode === 'banner' },
			{ name: 'gap', label: 'Space between letters', type: 'number', min: 0, max: 4, default: 1, when: (v) => v.mode === 'banner' },
			{ name: 'file', label: 'Image', type: 'file', accept: 'image/*', when: (v) => v.mode === 'image' },
			{ name: 'width', label: 'Width in characters', type: 'number', min: 20, max: 240, default: 90, when: (v) => v.mode === 'image' },
			{ name: 'invert', label: 'For dark backgrounds (invert)', type: 'checkbox', when: (v) => v.mode === 'image' },
		],
		live: true,
		async run({ mode, text, ink, gap, file, width, invert }) {
			if (mode === 'banner') {
				if (!text) return { note: 'Type some text.' };
				if (text.length > 40) throw new Error('Keep banners to 40 characters or fewer.');
				return { text: banner(text, ink, Math.max(0, Math.min(4, gap ?? 1))), label: 'Banner' };
			}
			if (!file) return { note: 'Choose an image.' };
			const url = URL.createObjectURL(file);
			const img = await Omni.util.loadImage(url);
			URL.revokeObjectURL(url);
			const w = Math.max(20, Math.min(240, width || 90));
			// Characters are about twice as tall as wide, so sample half as many rows.
			const hgt = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w * 0.5));
			const c = document.createElement('canvas');
			c.width = w;
			c.height = hgt;
			const g = c.getContext('2d', { willReadFrequently: true });
			g.drawImage(img, 0, 0, w, hgt);
			const d = g.getImageData(0, 0, w, hgt).data;
			const ramp = ' .:-=+*#%@';
			const ordered = invert ? ramp : [...ramp].reverse().join('');
			const lines = [];
			for (let y = 0; y < hgt; y++) {
				let line = '';
				for (let x = 0; x < w; x++) {
					const i = (y * w + x) * 4;
					const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
					const a = d[i + 3] / 255;
					line += ordered[Math.min(ramp.length - 1, Math.floor((a * lum + (1 - a) * (invert ? 0 : 1)) * ramp.length))];
				}
				lines.push(line.replace(/\s+$/, ''));
			}
			return { text: lines.join('\n'), label: `${w} x ${hgt} characters` };
		},
	});
})();
