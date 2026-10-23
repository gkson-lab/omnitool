// No. 083 Find and replace: plain or regex, case and whole-word options, with the number of replacements.
Omni.register({
	no: 83,
	id: 'find-replace',
	name: 'Find and replace',
	category: 'text',
	keywords: ['find', 'replace', 'search', 'substitute', 'regex', 'bulk edit'],
	description: 'Finds and replaces text, as plain text or a regular expression, matching case or whole words if you want.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Text', type: 'textarea', rows: 8, default: 'color: Color; colorful COLOR.\nThe colour of the sky.' },
		{ name: 'find', label: 'Find', type: 'text', default: 'colou?r' },
		{ name: 'replace', label: 'Replace with', type: 'text', default: 'hue' },
		{ name: 'regex', label: 'Regular expression', type: 'checkbox', default: true },
		{ name: 'matchCase', label: 'Match case', type: 'checkbox' },
		{ name: 'wholeWord', label: 'Whole words only', type: 'checkbox', default: true },
	],
	run({ text, find, replace, regex, matchCase, wholeWord }) {
		if (!find) return { note: 'Type what to find.' };
		let src = regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		if (wholeWord) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
		let re;
		try {
			re = new RegExp(src, 'gu' + (matchCase ? '' : 'i'));
		} catch (err) {
			throw new Error(err.message.replace(/^Invalid regular expression: /, ''));
		}
		let count = 0;
		const out = text.replace(re, (...m) => {
			count++;
			if (!regex) return replace;
			// Expand $1, $& and $<name> the same way String.replace would.
			return replace.replace(/\$(\d+|&|<[^>]+>)/g, (_, g) => {
				if (g === '&') return m[0];
				if (g.startsWith('<')) return (m[m.length - 1] || {})[g.slice(1, -1)] ?? '';
				return m[Number(g)] ?? '';
			});
		});
		return { readings: [{ label: 'Replacements', value: count, copy: false }], text: out, label: 'Result' };
	},
});
