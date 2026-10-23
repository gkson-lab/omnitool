// No. 142 Unit test writer: Claude writes runnable tests; offline writes one skeleton per function.
Omni.aiTool({
	no: 142,
	id: 'test-writer',
	name: 'Unit test writer',
	keywords: ['unit tests', 'tests', 'jest', 'vitest', 'pytest', 'testing', 'tdd', 'coverage'],
	description: 'Writes unit tests for the functions in a file, covering normal cases and edge cases, for the framework you use.',
	action: 'Write tests',
	codeField: 'code',
	markdown: false,
	offlineLabel: 'Writes a test skeleton per exported function; you fill in the inputs and expected values.',
	inputs: [
		{ name: 'code', label: 'Code to test', type: 'textarea', mono: true, rows: 12, default: 'export function slugify(text) {\n  return text\n    .toLowerCase()\n    .normalize("NFKD")\n    .replace(/[\\u0300-\\u036f]/g, "")\n    .replace(/[^a-z0-9]+/g, "-")\n    .replace(/^-|-$/g, "");\n}\n' },
		{ name: 'language', label: 'Language', type: 'select', options: Omni.aiTool.LANGS, default: 'auto' },
		{ name: 'framework', label: 'Framework', type: 'select', options: ['vitest', 'jest', 'node:test', 'pytest', 'unittest', 'JUnit 5', 'xUnit'], default: 'vitest' },
		{ name: 'module', label: 'Module path to import from', type: 'text', default: './slugify.js' },
	],
	system: () => 'You write focused, runnable unit tests. Cover typical inputs, boundaries, empty and invalid inputs, and documented errors. Each test checks one behavior and has a descriptive name. Do not test private helpers. Reply with the complete test file in one fenced code block, then at most three sentences on anything you could not test.',
	prompt: ({ code, language, framework, module }) => `Write ${framework} tests for this ${language === 'auto' ? '' : language + ' '}code, importing from "${module}".\n\n\`\`\`\n${code}\n\`\`\``,
	offline: ({ code, language, module }) => {
		const r = Omni.codeinfo.testSkeletons(code, language, module);
		if (!r.count) throw new Error('No top-level functions were found to write tests for.');
		return { text: r.code, label: `Skeletons for ${r.count} functions` };
	},
	afterResult: (text, args, output) => Omni.aiTool.codeActions(Omni.aiTool.extractCode(text), '', output, null),
});
