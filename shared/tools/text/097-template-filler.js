// No. 097 Template filler: a {{placeholder}} template filled once per CSV row (mail merge for text).
Omni.register({
	no: 97,
	id: 'template-filler',
	name: 'Template filler',
	category: 'text',
	keywords: ['template', 'mail merge', 'placeholder', 'mustache', 'csv', 'bulk', 'generate'],
	description: 'Fills a template with {{column}} placeholders once for every row of a CSV, for bulk messages, configs or SQL.',
	action: 'Fill',
	inputs: [
		{ name: 'template', label: 'Template', type: 'textarea', rows: 6, default: 'Hi {{name}},\nyour order {{order}} ships on {{date}}.\n' },
		{ name: 'csv', label: 'Data (CSV, first row names the placeholders)', type: 'textarea', mono: true, rows: 6, default: 'name,order,date\nAvery,1042,Monday\nBlake,1043,Tuesday' },
		{ name: 'separator', label: 'Between results', type: 'select', options: [{ value: '\n---\n', label: 'A --- line' }, { value: '\n', label: 'A blank line' }, { value: '', label: 'Nothing' }], default: '\n---\n' },
		{ name: 'strict', label: 'Flag placeholders with no column', type: 'checkbox', default: true },
	],
	run({ template, csv, separator, strict }) {
		const { rows } = Omni.csv.parse(csv);
		if (rows.length < 2) throw new Error('The data needs a header row and at least one row of values.');
		const head = rows[0].map((h) => h.trim());
		const used = [...new Set([...template.matchAll(/\{\{\s*([\w .-]+?)\s*\}\}/g)].map((m) => m[1]))];
		const missing = used.filter((u) => !head.includes(u));
		if (strict && missing.length) throw new Error(`No column for: ${missing.join(', ')}. Columns: ${head.join(', ')}.`);
		const out = rows.slice(1).map((r) => template.replace(/\{\{\s*([\w .-]+?)\s*\}\}/g, (m, key) => {
			const i = head.indexOf(key);
			return i === -1 ? m : r[i] ?? '';
		}));
		return { text: out.join(separator), label: `${out.length} filled copies`, readings: [{ label: 'Placeholders used', value: used.join(', ') || 'none', copy: false }, { label: 'Unused columns', value: head.filter((h) => !used.includes(h)).join(', ') || 'none', copy: false }] };
	},
});
