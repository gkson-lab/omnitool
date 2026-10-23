// No. 062 String escaper: escape or unescape text for JSON, JavaScript, HTML attributes, SQL, CSV and regex.
Omni.register({
	no: 62,
	id: 'string-escaper',
	name: 'String escaper',
	category: 'convert',
	keywords: ['escape', 'unescape', 'string', 'json', 'javascript', 'sql', 'csv', 'regex', 'quote'],
	description: 'Escapes text so it can be pasted into a JSON string, JavaScript, an HTML attribute, SQL, CSV or a regex, and unescapes it again.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Mode', type: 'seg', options: [{ value: 'escape', label: 'Escape' }, { value: 'unescape', label: 'Unescape' }], default: 'escape' },
		{ name: 'target', label: 'For', type: 'select', options: [{ value: 'json', label: 'JSON string' }, { value: 'js', label: 'JavaScript string' }, { value: 'html', label: 'HTML attribute' }, { value: 'sql', label: 'SQL string' }, { value: 'csv', label: 'CSV field' }, { value: 'regex', label: 'Regular expression' }], default: 'json' },
		{ name: 'text', label: 'Input', type: 'textarea', rows: 6, default: 'She said "hi"\nPath: C:\\temp\\file.txt\tdone' },
	],
	run({ mode, target, text }) {
		const esc = {
			json: (s) => JSON.stringify(s).slice(1, -1),
			js: (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\$\{/g, '\\${').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16)),
			html: (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
			sql: (s) => s.replace(/'/g, "''"),
			csv: (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s),
			regex: (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'),
		};
		const unesc = {
			json: (s) => JSON.parse(`"${s.replace(/(^|[^\\])"/g, '$1\\"')}"`),
			js: (s) => s.replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|.)/gis, (_, e) => {
				if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
				if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
				return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }[e] ?? e;
			}),
			html: (s) => {
				const ta = document.createElement('textarea');
				ta.innerHTML = s;
				return ta.value;
			},
			sql: (s) => s.replace(/''/g, "'"),
			csv: (s) => (/^".*"$/s.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s),
			regex: (s) => s.replace(/\\(.)/g, '$1'),
		};
		try {
			return { text: (mode === 'escape' ? esc : unesc)[target](text), label: mode === 'escape' ? 'Escaped' : 'Unescaped' };
		} catch {
			throw new Error(`That is not a valid escaped ${target.toUpperCase()} string.`);
		}
	},
});
