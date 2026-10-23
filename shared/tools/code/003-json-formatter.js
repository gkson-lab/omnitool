// No. 003 JSON formatter: pretty-print, minify and validate, pointing at the line and column of any error.
(function () {
	'use strict';

	/** Line and column of a JSON.parse error, from either V8 message style. */
	function errorPosition(text, err) {
		const lc = err.message.match(/line (\d+) column (\d+)/);
		if (lc) return { line: +lc[1], column: +lc[2] };
		const pos = err.message.match(/position (\d+)/);
		if (!pos) return null;
		const before = text.slice(0, +pos[1]);
		return { line: before.split('\n').length, column: +pos[1] - before.lastIndexOf('\n') };
	}

	function sortKeys(v) {
		if (Array.isArray(v)) return v.map(sortKeys);
		if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
		return v;
	}

	function stats(v) {
		let keys = 0;
		let depth = 0;
		const walk = (x, d) => {
			depth = Math.max(depth, d);
			if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1));
			else if (x && typeof x === 'object') {
				keys += Object.keys(x).length;
				Object.values(x).forEach((y) => walk(y, d + 1));
			}
		};
		walk(v, 0);
		return { keys, depth };
	}

	Omni.jsonTools = { errorPosition, sortKeys };

	Omni.register({
		no: 3,
		id: 'json-formatter',
		name: 'JSON formatter',
		category: 'code',
		keywords: ['json', 'pretty', 'prettify', 'minify', 'validate', 'lint'],
		description: 'Pretty-prints, minifies and validates JSON. Errors show the line and column.',
		live: true,
		inputs: [
			{ name: 'json', label: 'JSON', type: 'textarea', mono: true, rows: 12, default: '{"name":"OmniTool","tools":150,"editions":["desktop","web"],"agent":{"offline":true}}' },
			{ name: 'indent', label: 'Indent', type: 'select', options: [{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tabs' }, { value: 'min', label: 'Minified' }], default: '2' },
			{ name: 'sort', label: 'Sort keys A to Z', type: 'checkbox' },
		],
		run({ json, indent, sort }) {
			if (!json.trim()) return { note: 'Paste JSON above.' };
			let value;
			try {
				value = JSON.parse(json);
			} catch (err) {
				const at = errorPosition(json, err);
				const line = at ? json.split('\n')[at.line - 1] : '';
				return { error: `Invalid JSON${at ? ` at line ${at.line}, column ${at.column}` : ''}: ${err.message.replace(/^JSON\.parse: /, '')}${at ? `\n\n${line}\n${' '.repeat(Math.max(0, at.column - 1))}^` : ''}` };
			}
			if (sort) value = sortKeys(value);
			const space = indent === 'min' ? 0 : indent === 'tab' ? '\t' : Number(indent);
			const out = JSON.stringify(value, null, space);
			const s = stats(value);
			return {
				text: out,
				label: indent === 'min' ? 'Minified' : 'Formatted',
				readings: [
					{ label: 'Valid', value: 'Yes', copy: false },
					{ label: 'Top-level type', value: Array.isArray(value) ? `array of ${value.length}` : value === null ? 'null' : typeof value, copy: false },
					{ label: 'Object keys', value: s.keys, copy: false },
					{ label: 'Nesting depth', value: s.depth, copy: false },
					{ label: 'Size in / out', value: `${Omni.util.fmt.bytes(new Blob([json]).size)} / ${Omni.util.fmt.bytes(new Blob([out]).size)}`, copy: false },
				],
			};
		},
	});
})();
