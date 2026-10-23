// No. 090 Whitespace cleaner: trim, collapse, tabs and spaces, line endings and invisible characters.
Omni.register({
	no: 90,
	id: 'whitespace',
	name: 'Whitespace cleaner',
	category: 'text',
	keywords: ['whitespace', 'trim', 'spaces', 'tabs', 'line endings', 'crlf', 'lf', 'clean', 'nbsp'],
	description: 'Trims lines, collapses repeated spaces and blank lines, converts tabs and spaces and line endings, and strips invisible characters.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Text', type: 'textarea', rows: 8, mono: true, default: '  first   line   \t\n\n\n\tsecond line​  \r\nthird line   ' },
		{ name: 'trim', label: 'Trim each line', type: 'checkbox', default: true },
		{ name: 'collapse', label: 'Collapse repeated spaces', type: 'checkbox', default: true },
		{ name: 'blank', label: 'Blank lines', type: 'select', options: [{ value: 'keep', label: 'Keep' }, { value: 'collapse', label: 'At most one in a row' }, { value: 'remove', label: 'Remove all' }], default: 'collapse' },
		{ name: 'tabs', label: 'Tabs', type: 'select', options: [{ value: 'keep', label: 'Keep' }, { value: 'spaces2', label: 'To 2 spaces' }, { value: 'spaces4', label: 'To 4 spaces' }, { value: 'fromSpaces', label: 'Leading 4 spaces to tabs' }], default: 'keep' },
		{ name: 'eol', label: 'Line endings', type: 'select', options: [{ value: 'lf', label: 'LF (Linux, macOS)' }, { value: 'crlf', label: 'CRLF (Windows)' }], default: 'lf' },
		{ name: 'invisible', label: 'Replace non-breaking and zero-width spaces', type: 'checkbox', default: true },
	],
	run({ text, trim, collapse, blank, tabs, eol, invisible }) {
		let s = text.replace(/\r\n?/g, '\n');
		const before = { crlf: (text.match(/\r\n/g) || []).length, nbsp: (text.match(/[  ]/g) || []).length, zw: (text.match(/[​-‍⁠﻿]/g) || []).length };
		if (invisible) s = s.replace(/[   ]/g, ' ').replace(/[​-‍⁠﻿]/g, '');
		if (tabs === 'spaces2') s = s.replace(/\t/g, '  ');
		else if (tabs === 'spaces4') s = s.replace(/\t/g, '    ');
		else if (tabs === 'fromSpaces') s = s.replace(/^( {4})+/gm, (m) => '\t'.repeat(m.length / 4));
		let lines = s.split('\n');
		if (trim) lines = lines.map((l) => l.trim());
		if (collapse) lines = lines.map((l) => l.replace(/(\S) {2,}/g, '$1 '));
		if (blank === 'remove') lines = lines.filter((l) => l.trim());
		else if (blank === 'collapse') lines = lines.filter((l, i) => l.trim() || (i > 0 && lines[i - 1].trim()));
		const out = lines.join(eol === 'crlf' ? '\r\n' : '\n');
		return {
			text: out.replace(/\r/g, ''),
			label: 'Cleaned (shown with LF; copy and download keep your line-ending choice)',
			readings: [{ label: 'Characters removed', value: text.length - out.length, copy: false }, { label: 'Found CRLF line endings', value: before.crlf, copy: false }, { label: 'Found non-breaking spaces', value: before.nbsp, copy: false }, { label: 'Found zero-width characters', value: before.zw, copy: false }],
			download: { name: 'cleaned.txt', data: out, label: 'Download with the chosen line endings' },
		};
	},
});
