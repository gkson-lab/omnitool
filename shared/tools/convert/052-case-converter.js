// No. 052 Case converter: every common naming style at once, plus URL slugs.
(function () {
	'use strict';

	/** Splits any identifier or sentence into lowercase words: "parseHTTPResponse_v2" -> parse http response v2. */
	function words(text) {
		return text
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
			.split(/[^A-Za-z0-9]+/)
			.filter(Boolean)
			.map((w) => w.toLowerCase());
	}
	const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

	function all(text) {
		const w = words(text);
		const small = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via']);
		return {
			camel: w.map((x, i) => (i ? cap(x) : x)).join(''),
			pascal: w.map(cap).join(''),
			snake: w.join('_'),
			constant: w.join('_').toUpperCase(),
			kebab: w.join('-'),
			dot: w.join('.'),
			title: w.map((x, i) => (i && i < w.length - 1 && small.has(x) ? x : cap(x))).join(' '),
			sentence: cap(w.join(' ')),
			lower: text.toLowerCase(),
			upper: text.toUpperCase(),
			slug: w.join('-').slice(0, 80).replace(/-+$/, ''),
		};
	}
	Omni.caseStyles = { words, all };

	Omni.register({
		no: 52,
		id: 'case-converter',
		name: 'Case converter',
		category: 'convert',
		keywords: ['case', 'camelcase', 'snake_case', 'kebab-case', 'pascalcase', 'title case', 'slug', 'uppercase', 'lowercase', 'naming'],
		description: 'Shows text in camel, Pascal, snake, constant, kebab, dot, title and sentence case, and as a URL slug. Accents are stripped for slugs.',
		live: true,
		inputs: [{ name: 'text', label: 'Text or identifier', type: 'text', default: 'Parse HTTP response headers v2' }],
		run({ text }) {
			if (!text.trim()) return { note: 'Type something.' };
			const r = all(text);
			const labels = { camel: 'camelCase', pascal: 'PascalCase', snake: 'snake_case', constant: 'CONSTANT_CASE', kebab: 'kebab-case', dot: 'dot.case', title: 'Title Case', sentence: 'Sentence case', lower: 'lowercase', upper: 'UPPERCASE', slug: 'URL slug' };
			return { readings: Object.entries(r).map(([k, v]) => ({ label: labels[k], value: v })) };
		},
	});
})();
