// No. 012 JavaScript linter (JSHint) with the options people toggle most.
Omni.register({
	no: 12,
	id: 'js-linter',
	name: 'JavaScript linter',
	category: 'code',
	keywords: ['lint', 'jshint', 'javascript', 'errors', 'warnings', 'check'],
	description: 'Checks JavaScript with JSHint and lists warnings by line.',
	vendor: ['jshint.js'],
	action: 'Lint',
	inputs: [
		{ name: 'code', label: 'JavaScript', type: 'textarea', mono: true, rows: 12, default: 'function check(list) {\n  for (var i = 0; i < list.length; i++) {\n    if (list[i] == null) return i\n  }\n  unused = 1;\n}\n' },
		{ name: 'esversion', label: 'ECMAScript version', type: 'select', options: [{ value: '11', label: 'ES2020+' }, { value: '9', label: 'ES2018' }, { value: '6', label: 'ES2015' }, { value: '5', label: 'ES5' }], default: '11' },
		{ name: 'env', label: 'Globals', type: 'select', options: [{ value: 'browser', label: 'Browser' }, { value: 'node', label: 'Node.js' }, { value: 'both', label: 'Both' }], default: 'browser' },
		{ name: 'eqeqeq', label: 'Require === and !==', type: 'checkbox', default: true },
		{ name: 'undef', label: 'Flag undefined variables', type: 'checkbox', default: true },
		{ name: 'unused', label: 'Flag unused variables', type: 'checkbox', default: true },
		{ name: 'module', label: 'ES module (import/export)', type: 'checkbox', default: false },
	],
	run({ code, esversion, env, eqeqeq, undef, unused, module }) {
		const options = { esversion: Number(esversion), eqeqeq, undef, unused, module, browser: env !== 'node', node: env !== 'browser', devel: true, asi: false };
		window.JSHINT(code, options);
		const errors = window.JSHINT.errors.filter(Boolean);
		if (!errors.length) return { readings: [{ label: 'Warnings', value: 0, copy: false }], note: 'JSHint found nothing to report with these options.' };
		return {
			readings: [{ label: 'Warnings', value: errors.length, copy: false }, { label: 'Lines affected', value: new Set(errors.map((e) => e.line)).size, copy: false }],
			table: { columns: ['Line', 'Col', 'Code', 'Message'], rows: errors.map((e) => [e.line, e.character, e.code, e.reason]), numeric: [0, 1] },
		};
	},
});
