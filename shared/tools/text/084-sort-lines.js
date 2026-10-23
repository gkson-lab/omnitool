// No. 084 Sort lines: alphabetical, natural (file2 before file10), numeric, by length, reversed or shuffled.
Omni.register({
	no: 84,
	id: 'sort-lines',
	name: 'Sort lines',
	category: 'text',
	keywords: ['sort', 'lines', 'alphabetical', 'natural sort', 'order', 'shuffle', 'reverse'],
	description: 'Sorts lines alphabetically, naturally (file2 before file10), numerically, by length, in reverse or at random.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Lines', type: 'textarea', rows: 10, default: 'file10.txt\nfile2.txt\nFile1.txt\nreadme.md\nfile1.txt' },
		{ name: 'mode', label: 'Order', type: 'select', options: [{ value: 'natural', label: 'Natural (numbers in order)' }, { value: 'alpha', label: 'Alphabetical' }, { value: 'numeric', label: 'By leading number' }, { value: 'length', label: 'By length' }, { value: 'reverse', label: 'Reverse current order' }, { value: 'shuffle', label: 'Shuffle' }], default: 'natural' },
		{ name: 'desc', label: 'Descending', type: 'checkbox', when: (v) => !['reverse', 'shuffle'].includes(v.mode) },
		{ name: 'ignoreCase', label: 'Ignore case', type: 'checkbox', default: true, when: (v) => ['natural', 'alpha'].includes(v.mode) },
		{ name: 'skipBlank', label: 'Drop blank lines', type: 'checkbox', default: true },
	],
	run({ text, mode, desc, ignoreCase, skipBlank }) {
		let lines = text.split(/\r?\n/);
		if (skipBlank) lines = lines.filter((l) => l.trim());
		const coll = new Intl.Collator(undefined, { numeric: mode === 'natural', sensitivity: ignoreCase ? 'base' : 'variant' });
		if (mode === 'reverse') lines.reverse();
		else if (mode === 'shuffle') lines = Omni.random.shuffle(Omni.random.source(), lines);
		else {
			const cmp = {
				natural: (a, b) => coll.compare(a, b),
				alpha: (a, b) => coll.compare(a, b),
				numeric: (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || coll.compare(a, b),
				length: (a, b) => a.length - b.length || coll.compare(a, b),
			}[mode];
			lines.sort(cmp);
			if (desc) lines.reverse();
		}
		return { text: lines.join('\n'), label: `${lines.length} lines` };
	},
});
