// No. 058 Roman numeral converter (1 to 3999), strict about malformed numerals like IIII or VX.
(function () {
	'use strict';
	const TABLE = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
	const toRoman = (n) => TABLE.reduce((s, [v, r]) => {
		while (n >= v) {
			s += r;
			n -= v;
		}
		return s;
	}, '');
	const VALID = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

	Omni.register({
		no: 58,
		id: 'roman',
		name: 'Roman numeral converter',
		category: 'convert',
		keywords: ['roman', 'numerals', 'mmxxvi', 'convert', 'number'],
		description: 'Converts numbers from 1 to 3999 to Roman numerals and back, rejecting malformed numerals.',
		live: true,
		inputs: [{ name: 'value', label: 'Number or numeral', type: 'text', default: '2026' }],
		run({ value }) {
			const v = String(value).trim().toUpperCase();
			if (!v) return { note: 'Type a number or a numeral.' };
			if (/^\d+$/.test(v)) {
				const n = Number(v);
				if (n < 1 || n > 3999) throw new Error('Standard Roman numerals cover 1 to 3999.');
				return { text: toRoman(n), big: true, label: `${n} in Roman numerals` };
			}
			if (!VALID.test(v)) throw new Error(`"${v}" is not a valid Roman numeral. Rules: at most three in a row (III), and only IV, IX, XL, XC, CD, CM subtract.`);
			const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
			let n = 0;
			for (let i = 0; i < v.length; i++) n += vals[v[i]] < (vals[v[i + 1]] || 0) ? -vals[v[i]] : vals[v[i]];
			return { text: String(n), big: true, label: `${v} as a number` };
		},
	});
})();
