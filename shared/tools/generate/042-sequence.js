// No. 042 Number sequence generator: ranges with step, zero padding, prefix and suffix.
Omni.register({
	no: 42,
	id: 'sequence',
	name: 'Number sequence generator',
	category: 'generate',
	keywords: ['sequence', 'range', 'series', 'numbers', 'padding', 'list', 'filenames'],
	description: 'Lists of numbers with a start, end and step, optional zero padding, prefix and suffix (file001.txt to file100.txt).',
	live: true,
	inputs: [
		{ name: 'start', label: 'Start', type: 'number', step: 'any', default: 1 },
		{ name: 'end', label: 'End', type: 'number', step: 'any', default: 10 },
		{ name: 'step', label: 'Step', type: 'number', step: 'any', default: 1 },
		{ name: 'pad', label: 'Pad to digits', type: 'number', min: 0, max: 20, default: 3 },
		{ name: 'prefix', label: 'Prefix', type: 'text', default: 'file' },
		{ name: 'suffix', label: 'Suffix', type: 'text', default: '.txt' },
		{ name: 'separator', label: 'Separate with', type: 'select', options: [{ value: 'newline', label: 'New lines' }, { value: 'comma', label: 'Commas' }, { value: 'space', label: 'Spaces' }], default: 'newline' },
	],
	run({ start, end, step, pad, prefix, suffix, separator }) {
		const s = Number(step);
		if (!s) throw new Error('Step cannot be 0.');
		if ((end - start) / s < 0) throw new Error(`Counting from ${start} by ${s} never reaches ${end}. Flip the sign of the step.`);
		const count = Math.floor((end - start) / s + 1e-9) + 1;
		if (count > 100000) throw new Error(`That is ${count} numbers; the limit is 100,000.`);
		const decimals = Math.max(...[start, step].map((x) => (String(x).split('.')[1] || '').length));
		const out = [];
		for (let i = 0; i < count; i++) {
			const v = Number((start + i * s).toFixed(decimals));
			const neg = v < 0;
			const body = String(Math.abs(v)).split('.');
			body[0] = body[0].padStart(pad || 0, '0');
			out.push(`${prefix || ''}${neg ? '-' : ''}${body.join('.')}${suffix || ''}`);
		}
		const sep = { newline: '\n', comma: ', ', space: ' ' }[separator];
		return { text: out.join(sep), label: `${count} items` };
	},
});
