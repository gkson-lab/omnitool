// No. 091 Line transformer: number lines, add prefixes and suffixes, quote them, or join them into one line.
Omni.register({
	no: 91,
	id: 'line-transformer',
	name: 'Line transformer',
	category: 'text',
	keywords: ['lines', 'prefix', 'suffix', 'number lines', 'quote', 'join', 'wrap', 'list', 'sql in'],
	description: 'Numbers lines, adds a prefix or suffix, wraps each in quotes, and joins them, for example into a SQL IN list or a JS array.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Lines', type: 'textarea', rows: 8, default: 'alpha\nbeta\ngamma' },
		{ name: 'prefix', label: 'Prefix', type: 'text' },
		{ name: 'suffix', label: 'Suffix', type: 'text' },
		{ name: 'quote', label: 'Wrap each in', type: 'select', options: [{ value: '', label: 'Nothing' }, { value: "'", label: "'single quotes'" }, { value: '"', label: '"double quotes"' }, { value: '`', label: '`backticks`' }], default: "'" },
		{ name: 'number', label: 'Number the lines', type: 'select', options: [{ value: '', label: 'No' }, { value: '1. ', label: '1. 2. 3.' }, { value: '1) ', label: '1) 2) 3)' }, { value: 'pad', label: '001 002 003' }], default: '' },
		{ name: 'join', label: 'Join with', type: 'select', options: [{ value: '\n', label: 'New lines (keep lines)' }, { value: ', ', label: 'Comma and space' }, { value: ',', label: 'Comma' }, { value: ' ', label: 'Space' }, { value: ' | ', label: 'Pipe' }], default: ', ' },
		{ name: 'wrap', label: 'Wrap the result in', type: 'select', options: [{ value: '', label: 'Nothing' }, { value: '()', label: '( ) for SQL IN' }, { value: '[]', label: '[ ] for an array' }, { value: '{}', label: '{ } for a set' }], default: '()' },
		{ name: 'skipBlank', label: 'Skip blank lines', type: 'checkbox', default: true },
	],
	run({ text, prefix, suffix, quote, number, join, wrap, skipBlank }) {
		let lines = text.split(/\r?\n/);
		if (skipBlank) lines = lines.filter((l) => l.trim());
		const width = String(lines.length).length;
		const out = lines.map((l, i) => {
			const body = quote ? `${quote}${l.split(quote).join('\\' + quote)}${quote}` : l;
			const n = number === 'pad' ? String(i + 1).padStart(Math.max(3, width), '0') + ' ' : number ? number.replace('1', String(i + 1)) : '';
			return `${n}${prefix || ''}${body}${suffix || ''}`;
		});
		const joined = out.join(join);
		return { text: wrap ? `${wrap[0]}${joined}${wrap[1]}` : joined, label: `${lines.length} lines` };
	},
});
