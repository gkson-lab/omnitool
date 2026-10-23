// No. 055 Table converter: CSV or TSV to a Markdown table, an HTML table or SQL inserts.
Omni.register({
	no: 55,
	id: 'table-converter',
	name: 'Table converter',
	category: 'convert',
	keywords: ['table', 'markdown table', 'html table', 'sql insert', 'csv', 'tsv'],
	description: 'Turns CSV or tab-separated data (pasted from a spreadsheet) into a Markdown table, an HTML table or SQL INSERT statements.',
	live: true,
	inputs: [
		{ name: 'text', label: 'CSV or TSV (first row is the header)', type: 'textarea', mono: true, rows: 8, default: 'Tool\tNumber\tEdition\nLabsCode\t1\tDesktop\nCode Pad\t2\tBoth\nJSON formatter\t3\tBoth' },
		{ name: 'target', label: 'Output', type: 'seg', options: [{ value: 'md', label: 'Markdown' }, { value: 'html', label: 'HTML' }, { value: 'sql', label: 'SQL' }], default: 'md' },
		{ name: 'table', label: 'SQL table name', type: 'text', default: 'my_table', when: (v) => v.target === 'sql' },
		{ name: 'align', label: 'Right-align number columns (Markdown)', type: 'checkbox', default: true, when: (v) => v.target === 'md' },
	],
	run({ text, target, table, align }) {
		const { rows } = Omni.csv.parse(text);
		if (rows.length < 1) return { note: 'Paste a table above.' };
		const head = rows[0];
		const body = rows.slice(1).map((r) => head.map((_, i) => r[i] ?? ''));
		const numeric = head.map((_, i) => body.length && body.every((r) => r[i] === '' || /^-?\d+(\.\d+)?$/.test(r[i])));
		if (target === 'md') {
			const esc = (s) => String(s).replace(/\|/g, '\\|');
			const widths = head.map((hd, i) => Math.max(3, esc(hd).length, ...body.map((r) => esc(r[i]).length)));
			const line = (cells) => '| ' + cells.map((c, i) => (numeric[i] && align ? esc(c).padStart(widths[i]) : esc(c).padEnd(widths[i]))).join(' | ') + ' |';
			const sep = '| ' + widths.map((w, i) => (numeric[i] && align ? '-'.repeat(w - 1) + ':' : '-'.repeat(w))).join(' | ') + ' |';
			return { text: [line(head), sep, ...body.map(line)].join('\n'), label: 'Markdown table' };
		}
		const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		if (target === 'html') return { text: `<table>\n  <thead>\n    <tr>${head.map((c) => `<th>${e(c)}</th>`).join('')}</tr>\n  </thead>\n  <tbody>\n${body.map((r) => `    <tr>${r.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('\n')}\n  </tbody>\n</table>`, label: 'HTML table' };
		const ident = (s) => (/^[A-Za-z_][\w]*$/.test(s) ? s : `"${String(s).replace(/"/g, '""')}"`);
		const lit = (v, i) => (v === '' ? 'NULL' : numeric[i] ? v : `'${String(v).replace(/'/g, "''")}'`);
		return { text: body.map((r) => `INSERT INTO ${ident(table || 'my_table')} (${head.map(ident).join(', ')}) VALUES (${r.map(lit).join(', ')});`).join('\n'), label: 'SQL' };
	},
});
