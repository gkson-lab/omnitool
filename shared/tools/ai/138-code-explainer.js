// No. 138 Code explainer: Claude explains code for a chosen audience; offline gives a structural outline.
Omni.aiTool({
	no: 138,
	id: 'code-explainer',
	name: 'Code explainer',
	keywords: ['explain', 'code', 'understand', 'walkthrough', 'what does this do', 'review'],
	description: 'Explains what a piece of code does, step by step, for the level of detail you pick.',
	action: 'Explain',
	codeField: 'code',
	offlineLabel: 'Shows an outline of imports, functions, classes and their complexity, made without a model.',
	inputs: [
		{ name: 'code', label: 'Code', type: 'textarea', mono: true, rows: 12, default: 'function debounce(fn, ms) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}\n' },
		{ name: 'language', label: 'Language', type: 'select', options: Omni.aiTool.LANGS, default: 'auto' },
		{ name: 'audience', label: 'Explain for', type: 'select', options: [{ value: 'new', label: 'Someone new to this language' }, { value: 'dev', label: 'An experienced developer' }, { value: 'brief', label: 'A one-paragraph summary' }], default: 'dev' },
	],
	system: () => 'You explain code clearly and concretely. Describe what it does, how data flows, and anything surprising (edge cases, side effects, performance). Refer to names and line numbers from the code. Do not rewrite the code unless asked. Use short Markdown sections.',
	prompt: ({ code, language, audience }) => `Explain this ${language === 'auto' ? '' : language + ' '}code ${{ new: 'for someone new to the language, defining terms as you go', dev: 'for an experienced developer, focusing on intent, edge cases and pitfalls', brief: 'in one short paragraph' }[audience]}.\n\n\`\`\`\n${code}\n\`\`\``,
	offline: ({ code, language }) => ({ text: Omni.codeinfo.explain(code, language).text, label: 'Outline' }),
});
