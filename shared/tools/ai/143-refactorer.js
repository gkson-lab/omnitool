// No. 143 Code refactorer: Claude rewrites code to an instruction; offline does renames, var to let/const and log removal.
Omni.aiTool({
	no: 143,
	id: 'refactorer',
	name: 'Code refactorer',
	keywords: ['refactor', 'rewrite', 'clean up', 'modernize', 'rename', 'improve code'],
	description: 'Rewrites code the way you describe and shows the diff. On desktop the result can go straight back into the LabsCode file, after you approve it.',
	action: 'Refactor',
	codeField: 'code',
	markdown: false,
	offlineLabel: 'Only does mechanical refactors: rename an identifier, turn var into const or let, remove logging lines.',
	inputs: [
		{ name: 'code', label: 'Code', type: 'textarea', mono: true, rows: 12, default: 'var total = 0;\nfor (var i = 0; i < items.length; i++) {\n  console.log("adding", items[i]);\n  total = total + items[i].price * items[i].qty;\n}\nvar tax = total * 0.2;\n' },
		{ name: 'language', label: 'Language', type: 'select', options: Omni.aiTool.LANGS, default: 'auto' },
		{ name: 'instruction', label: 'What to change (Claude)', type: 'textarea', rows: 3, default: 'Use reduce instead of the loop, const instead of var, and remove the logging.' },
		{ name: 'renameFrom', label: 'Offline: rename identifier', type: 'text', placeholder: 'oldName' },
		{ name: 'renameTo', label: 'to', type: 'text', placeholder: 'newName' },
		{ name: 'varToLet', label: 'Offline: var to const or let', type: 'checkbox', default: true },
		{ name: 'removeConsole', label: 'Offline: remove console.log and print lines', type: 'checkbox', default: true },
	],
	system: () => 'You refactor code exactly as instructed while keeping behavior the same unless the instruction says otherwise. Keep the existing style, names and comments that still apply. Reply with the complete rewritten code in one fenced code block, then a short Markdown list of the changes.',
	prompt: ({ code, language, instruction }) => `Refactor this ${language === 'auto' ? '' : language + ' '}code. Instruction: ${instruction || 'improve readability without changing behavior'}\n\n\`\`\`\n${code}\n\`\`\``,
	offline: ({ code, language, renameFrom, renameTo, varToLet, removeConsole }) => {
		const r = Omni.codeinfo.refactor(code, language, { rename: renameFrom && renameTo ? { from: renameFrom.trim(), to: renameTo.trim() } : null, varToLet, removeConsole });
		return { text: r.code, label: 'Refactored code', note: r.notes.join(' ') || 'No offline refactor was selected.' };
	},
	afterResult: async (text, args, output, source) => {
		const code = Omni.aiTool.extractCode(text);
		output.appendChild(Omni.forms.block('Changes', await Omni.agent.diffView(args.code, code)));
		Omni.aiTool.codeActions(code, args.code, output, source);
	},
});
