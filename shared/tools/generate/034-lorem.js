// No. 034 Lorem ipsum generator: classic Latin filler or English-like word salad.
(function () {
	'use strict';
	const LATIN = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');

	Omni.register({
		no: 34,
		id: 'lorem',
		name: 'Lorem ipsum generator',
		category: 'generate',
		keywords: ['lorem', 'ipsum', 'placeholder', 'dummy text', 'filler'],
		description: 'Placeholder text in paragraphs, sentences or words, as Latin lorem ipsum or English-like words.',
		action: 'Generate',
		inputs: [
			{ name: 'count', label: 'How many', type: 'number', min: 1, max: 500, default: 3 },
			{ name: 'unit', label: 'Of', type: 'seg', options: [{ value: 'paragraphs', label: 'Paragraphs' }, { value: 'sentences', label: 'Sentences' }, { value: 'words', label: 'Words' }], default: 'paragraphs' },
			{ name: 'style', label: 'Words from', type: 'select', options: [{ value: 'latin', label: 'Classic lorem ipsum' }, { value: 'english', label: 'English words' }], default: 'latin' },
			{ name: 'classic', label: 'Start with "Lorem ipsum dolor sit amet"', type: 'checkbox', default: true, when: (v) => v.style === 'latin' },
			{ name: 'html', label: 'Wrap paragraphs in <p>', type: 'checkbox' },
		],
		run({ count, unit, style, classic, html }) {
			const rand = Omni.random.source();
			const pool = style === 'english' ? Omni.words.common : LATIN;
			const word = () => Omni.random.pick(rand, pool);
			const sentence = () => {
				const n = Omni.random.int(rand, 6, 14);
				const ws = Array.from({ length: n }, word);
				if (n > 9) ws[Omni.random.int(rand, 3, n - 4)] += ',';
				const s = ws.join(' ');
				return s[0].toUpperCase() + s.slice(1) + '.';
			};
			const paragraph = () => Array.from({ length: Omni.random.int(rand, 4, 7) }, sentence).join(' ');
			const n = Math.max(1, Math.min(500, Math.floor(count || 1)));
			let out;
			if (unit === 'words') out = Array.from({ length: n }, word).join(' ');
			else if (unit === 'sentences') out = Array.from({ length: n }, sentence).join(' ');
			else out = Array.from({ length: n }, paragraph);
			if (style === 'latin' && classic) {
				const lead = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
				if (Array.isArray(out)) out[0] = lead + ' ' + out[0].split('. ').slice(1).join('. ');
				else if (unit === 'sentences') out = lead + ' ' + out.split('. ').slice(1).join('. ');
				else out = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'].slice(0, n).concat(out.split(' ').slice(5)).join(' ');
			}
			const text = Array.isArray(out) ? out.map((p) => (html ? `<p>${p}</p>` : p)).join(html ? '\n' : '\n\n') : out;
			return { text, label: 'Placeholder text', readings: [{ label: 'Words', value: text.replace(/<\/?p>/g, '').split(/\s+/).filter(Boolean).length, copy: false }, { label: 'Characters', value: text.length, copy: false }] };
		},
	});
})();
