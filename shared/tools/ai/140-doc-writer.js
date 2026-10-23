// No. 140 Doc comment writer: Claude writes real documentation comments; offline inserts skeletons from signatures.
Omni.aiTool({
	no: 140,
	id: 'doc-writer',
	name: 'Doc comment writer',
	keywords: ['documentation', 'jsdoc', 'docstring', 'comments', 'document code', 'tsdoc'],
	description: 'Adds JSDoc or docstring comments to each function, describing parameters, return values and errors, without changing the code.',
	action: 'Write docs',
	codeField: 'code',
	markdown: false,
	offlineLabel: 'Inserts comment skeletons from each function\'s signature for you to fill in.',
	inputs: [
		{ name: 'code', label: 'Code', type: 'textarea', mono: true, rows: 12, default: 'export function clamp(value, min, max) {\n  if (min > max) throw new RangeError("min > max");\n  return Math.min(max, Math.max(min, value));\n}\n\nexport async function fetchJson(url, timeoutMs = 5000) {\n  const ctrl = new AbortController();\n  const t = setTimeout(() => ctrl.abort(), timeoutMs);\n  try {\n    const r = await fetch(url, { signal: ctrl.signal });\n    return await r.json();\n  } finally {\n    clearTimeout(t);\n  }\n}\n' },
		{ name: 'language', label: 'Language', type: 'select', options: Omni.aiTool.LANGS, default: 'auto' },
	],
	system: () => 'You add documentation comments to code: JSDoc/TSDoc for JavaScript and TypeScript, docstrings for Python, the idiomatic style for other languages. Document purpose, parameters, return value and thrown errors in short sentences. Change nothing else: no renames, no reformatting, no new logic. Reply with the complete code in a single fenced code block and nothing else.',
	prompt: ({ code, language }) => `Add documentation comments to every function in this ${language === 'auto' ? '' : language + ' '}code.\n\n\`\`\`\n${code}\n\`\`\``,
	offline: ({ code, language }) => {
		const r = Omni.codeinfo.docSkeletons(code, language);
		return { text: r.code, label: `${r.added} skeletons added (${r.lang})` };
	},
	afterResult: (text, args, output, source) => Omni.aiTool.codeActions(Omni.aiTool.extractCode(text), args.code, output, source),
});
