// No. 015 Diff viewer: side-by-side line diff of two files plus a unified patch (jsdiff).
Omni.register({
	no: 15,
	id: 'diff-viewer',
	name: 'Diff viewer',
	category: 'code',
	keywords: ['diff', 'compare', 'patch', 'changes', 'side by side'],
	description: 'Compares two versions of a file line by line, side by side, and exports a unified patch.',
	vendor: ['diff.min.js'],
	layout: 'wide',
	action: 'Compare',
	inputs: [
		{ name: 'before', label: 'Original', type: 'textarea', mono: true, rows: 10, default: 'const port = 3000;\nconst host = "localhost";\n\nfunction start() {\n  console.log("starting");\n  listen(port, host);\n}\n' },
		{ name: 'after', label: 'Changed', type: 'textarea', mono: true, rows: 10, default: 'const port = process.env.PORT || 3000;\nconst host = "0.0.0.0";\n\nfunction start() {\n  listen(port, host);\n  console.log(`listening on ${port}`);\n}\n' },
		{ name: 'name', label: 'File name for the patch', type: 'text', default: 'server.js' },
		{ name: 'ignoreWs', label: 'Ignore whitespace changes', type: 'checkbox' },
		{ name: 'context', label: 'Context lines in the patch', type: 'number', min: 0, max: 20, default: 3 },
	],
	run({ before, after, name, ignoreWs, context }) {
		const D = window.Diff;
		const parts = D.diffLines(before, after, { ignoreWhitespace: !!ignoreWs });
		const { h } = Omni;
		const rows = [];
		let ln = 1;
		let rn = 1;
		let added = 0;
		let removed = 0;
		// Pair removed and added runs so a changed line sits next to its replacement.
		for (let i = 0; i < parts.length; i++) {
			const p = parts[i];
			const lines = p.value.replace(/\n$/, '').split('\n');
			if (p.removed && parts[i + 1] && parts[i + 1].added) {
				const adds = parts[i + 1].value.replace(/\n$/, '').split('\n');
				const n = Math.max(lines.length, adds.length);
				for (let k = 0; k < n; k++) rows.push([k < lines.length ? ln++ : '', k < lines.length ? lines[k] : null, k < adds.length ? rn++ : '', k < adds.length ? adds[k] : null, 'chg']);
				removed += lines.length;
				added += adds.length;
				i++;
			} else if (p.removed) {
				lines.forEach((l) => rows.push([ln++, l, '', null, 'del']));
				removed += lines.length;
			} else if (p.added) {
				lines.forEach((l) => rows.push(['', null, rn++, l, 'add']));
				added += lines.length;
			} else lines.forEach((l) => rows.push([ln++, l, rn++, l, '']));
		}
		const table = h(
			'div',
			{ class: 'table-wrap' },
			h('table', { class: 'data diff-table' },
				h('thead', null, h('tr', null, h('th', { class: 'num' }, '#'), h('th', null, 'Original'), h('th', { class: 'num' }, '#'), h('th', null, 'Changed'))),
				h('tbody', null, rows.map(([a, l, b, r, k]) => h('tr', null, h('td', { class: 'ln' }, a), h('td', { class: 'code ' + (l !== null && (k === 'del' || k === 'chg') ? 'del' : '') }, l === null ? '' : l), h('td', { class: 'ln' }, b), h('td', { class: 'code ' + (r !== null && (k === 'add' || k === 'chg') ? 'add' : '') }, r === null ? '' : r)))),
			),
		);
		const patch = D.createTwoFilesPatch('a/' + (name || 'file'), 'b/' + (name || 'file'), before, after, '', '', { context: context == null ? 3 : context, ignoreWhitespace: !!ignoreWs });
		return {
			blocks: [
				{ type: 'readings', items: [{ label: 'Lines added', value: added, copy: false }, { label: 'Lines removed', value: removed, copy: false }, { label: 'Unchanged', value: rows.filter((r) => r[4] === '').length, copy: false }] },
				{ type: 'node', node: Omni.forms.block('Side by side', table) },
				{ type: 'text', label: 'Unified patch', value: patch },
				{ type: 'download', name: (name || 'changes') + '.patch', data: patch, label: 'Download the patch' },
			],
		};
	},
});
