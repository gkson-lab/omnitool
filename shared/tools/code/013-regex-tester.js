// No. 013 Regex tester: live highlighting, capture groups and a replace preview.
Omni.register({
	no: 13,
	id: 'regex-tester',
	name: 'Regex tester',
	category: 'code',
	keywords: ['regex', 'regexp', 'regular expression', 'match', 'replace', 'test'],
	description: 'Tests a JavaScript regular expression against text: highlighted matches, capture groups and a replace preview.',
	inputs: [
		{ name: 'pattern', label: 'Pattern', type: 'text', mono: true, default: '(\\w+)@(\\w+)\\.com' },
		{ name: 'flags', label: 'Flags', type: 'text', mono: true, default: 'gi', hint: 'g all, i ignore case, m multiline, s dot matches newline, u unicode, y sticky' },
		{ name: 'text', label: 'Test text', type: 'textarea', rows: 8, default: 'Write to support@example.com or SALES@Example.com.\nNot an address: user@localhost' },
		{ name: 'replace', label: 'Replace with (optional)', type: 'text', mono: true, default: '$1 at $2', hint: '$1, $2 for groups, $& for the whole match, $<name> for named groups' },
	],
	live: true,
	run({ pattern, flags, text, replace }) {
		if (!pattern) return { note: 'Type a pattern.' };
		let re;
		try {
			re = new RegExp(pattern, flags);
		} catch (err) {
			throw new Error(err.message.replace(/^Invalid regular expression: /, ''));
		}
		const { h } = Omni;
		const global = re.flags.includes('g') || re.flags.includes('y');
		const matches = [];
		if (global) {
			for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
				matches.push(m);
				if (matches.length >= 5000) break;
			}
		} else {
			const m = text.match(re);
			if (m) matches.push(m);
		}
		const marked = h('pre', { class: 'readout', tabindex: '0' });
		let last = 0;
		for (const m of matches) {
			if (m[0] === '' ) continue;
			marked.append(text.slice(last, m.index), h('mark', null, m[0]));
			last = m.index + m[0].length;
		}
		marked.append(text.slice(last));
		const groupCount = matches[0] ? matches[0].length - 1 : 0;
		const rows = matches.slice(0, 500).map((m, i) => [i + 1, m.index, m[0], ...Array.from({ length: groupCount }, (_, g) => (m[g + 1] === undefined ? '(no match)' : m[g + 1]))]);
		const named = matches[0] && matches[0].groups ? Object.keys(matches[0].groups) : [];
		return {
			blocks: [
				{ type: 'readings', items: [{ label: 'Matches', value: matches.length, copy: false }, { label: 'Groups', value: groupCount + (named.length ? ` (${named.join(', ')})` : ''), copy: false }] },
				{ type: 'node', node: Omni.forms.block('Highlighted', marked) },
				matches.length ? { type: 'table', label: 'Matches', columns: ['#', 'Index', 'Match', ...Array.from({ length: groupCount }, (_, g) => `Group ${g + 1}`)], rows, numeric: [0, 1] } : null,
				replace ? { type: 'text', label: 'After replace', value: text.replace(re, replace) } : null,
			].filter(Boolean),
		};
	},
});
