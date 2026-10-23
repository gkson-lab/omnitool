// No. 085 Remove duplicate lines: keeps the first copy of each line, optionally ignoring case and spacing.
Omni.register({
	no: 85,
	id: 'dedupe-lines',
	name: 'Remove duplicate lines',
	category: 'text',
	keywords: ['duplicate', 'dedupe', 'unique', 'lines', 'distinct', 'remove'],
	description: 'Removes repeated lines and keeps the first copy of each, in the original order. Shows what was removed and how often.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Lines', type: 'textarea', rows: 10, default: 'apple\nBanana\napple\n banana\ncherry\nApple' },
		{ name: 'ignoreCase', label: 'Ignore case', type: 'checkbox', default: true },
		{ name: 'trim', label: 'Ignore leading and trailing spaces', type: 'checkbox', default: true },
		{ name: 'skipBlank', label: 'Drop blank lines', type: 'checkbox', default: true },
	],
	run({ text, ignoreCase, trim, skipBlank }) {
		const seen = new Map();
		const kept = [];
		for (const line of text.split(/\r?\n/)) {
			if (skipBlank && !line.trim()) continue;
			let key = trim ? line.trim() : line;
			if (ignoreCase) key = key.toLowerCase();
			if (seen.has(key)) seen.set(key, seen.get(key) + 1);
			else {
				seen.set(key, 1);
				kept.push(trim ? line.trim() : line);
			}
		}
		const dupes = [...seen].filter(([, n]) => n > 1);
		const removed = dupes.reduce((s, [, n]) => s + n - 1, 0);
		return {
			text: kept.join('\n'),
			label: `${kept.length} unique lines`,
			readings: [{ label: 'Lines removed', value: removed, copy: false }],
			table: dupes.length ? { label: 'Repeated lines', columns: ['Line', 'Times seen'], rows: dupes.map(([k, n]) => [k, n]), numeric: [1] } : null,
		};
	},
});
