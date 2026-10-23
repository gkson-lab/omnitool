// No. 054 CSV and JSON converter: quoted fields, any delimiter, typed values, both directions.
Omni.register({
	no: 54,
	id: 'csv-json',
	name: 'CSV and JSON converter',
	category: 'convert',
	keywords: ['csv', 'json', 'convert', 'spreadsheet', 'tsv', 'excel'],
	description: 'Converts CSV to JSON (objects or arrays, with numbers and booleans typed) and JSON arrays back to CSV.',
	live: true,
	inputs: [
		{ name: 'direction', label: 'Direction', type: 'seg', options: [{ value: 'c2j', label: 'CSV to JSON' }, { value: 'j2c', label: 'JSON to CSV' }], default: 'c2j' },
		{ name: 'text', label: 'Input', type: 'textarea', mono: true, rows: 10, default: 'id,name,city,active\n1,"Avery, Jr.",Testville,true\n2,Blake,Sampleton,false\n3,Casey,"Demo City",true' },
		{ name: 'delimiter', label: 'Delimiter', type: 'select', options: [{ value: 'auto', label: 'Detect' }, { value: ',', label: 'Comma' }, { value: ';', label: 'Semicolon' }, { value: '\t', label: 'Tab' }, { value: '|', label: 'Pipe' }], default: 'auto' },
		{ name: 'header', label: 'First row is a header', type: 'checkbox', default: true, when: (v) => v.direction === 'c2j' },
		{ name: 'typed', label: 'Convert numbers and true/false', type: 'checkbox', default: true, when: (v) => v.direction === 'c2j' },
	],
	run({ direction, text, delimiter, header, typed }) {
		const C = Omni.csv;
		if (direction === 'c2j') {
			const { rows, delimiter: used } = C.parse(text, delimiter === 'auto' ? null : delimiter);
			if (!rows.length) return { note: 'Paste CSV above.' };
			const val = (v) => (typed ? C.typed(v) : v);
			let out;
			if (header) {
				const cols = rows[0].map((c, i) => c.trim() || `column${i + 1}`);
				out = rows.slice(1).map((r) => Object.fromEntries(cols.map((c, i) => [c, val(r[i] ?? '')])));
			} else out = rows.map((r) => r.map(val));
			return { text: JSON.stringify(out, null, 2), label: 'JSON', readings: [{ label: 'Rows', value: header ? rows.length - 1 : rows.length, copy: false }, { label: 'Columns', value: rows[0].length, copy: false }, { label: 'Delimiter used', value: used === '\t' ? 'tab' : used, copy: false }] };
		}
		const data = JSON.parse(text);
		if (!Array.isArray(data)) throw new Error('JSON to CSV needs an array (of objects or of arrays).');
		const d = delimiter === 'auto' ? ',' : delimiter;
		if (data.every((r) => Array.isArray(r))) return { text: C.stringify(data, d), label: 'CSV' };
		const cols = [...new Set(data.flatMap((r) => Object.keys(r || {})))];
		return { text: C.stringify([cols, ...data.map((r) => cols.map((c) => (r || {})[c]))], d), label: 'CSV', note: 'Nested objects are written as JSON text inside the cell.' };
	},
});
