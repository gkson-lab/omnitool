// No. 139 Bug finder: Claude reviews code for bugs; offline runs JSHint (for JavaScript) and common-mistake checks.
Omni.aiTool({
	no: 139,
	id: 'bug-finder',
	name: 'Bug finder',
	keywords: ['bugs', 'review', 'code review', 'lint', 'errors', 'security', 'mistakes'],
	description: 'Reviews code for bugs, security problems or slow spots and says where and how to fix each.',
	action: 'Find problems',
	codeField: 'code',
	vendor: ['jshint.js'],
	offlineLabel: 'Runs JSHint (JavaScript) and pattern checks for common mistakes; it cannot reason about intent.',
	inputs: [
		{ name: 'code', label: 'Code', type: 'textarea', mono: true, rows: 12, default: 'async function loadUsers(ids) {\n  var users = [];\n  ids.forEach(async (id) => {\n    const r = await fetch("/api/users/" + id);\n    if (r.status == 200) users.push(await r.json());\n  });\n  return users;\n}\n' },
		{ name: 'language', label: 'Language', type: 'select', options: Omni.aiTool.LANGS, default: 'auto' },
		{ name: 'focus', label: 'Look for', type: 'select', options: [{ value: 'bugs', label: 'Bugs and wrong behavior' }, { value: 'security', label: 'Security problems' }, { value: 'perf', label: 'Performance problems' }, { value: 'all', label: 'All of these' }], default: 'bugs' },
	],
	system: () => 'You are a careful code reviewer. Report only real problems, most serious first. For each: the line, what goes wrong and when, and a concrete fix. If you find nothing serious, say so plainly. Use a Markdown list.',
	prompt: ({ code, language, focus }) => `Are there any ${{ bugs: 'bugs or cases where this code behaves wrongly', security: 'security problems', perf: 'performance problems', all: 'bugs, security problems or performance problems' }[focus]} in this ${language === 'auto' ? '' : language + ' '}code?\n\n\`\`\`\n${code}\n\`\`\``,
	async offline({ code, language }) {
		const found = Omni.codeinfo.findIssues(code, language);
		const rows = found.issues.map((i) => [i.line, i.severity, i.message]);
		if (['javascript', 'typescript'].includes(found.lang)) {
			await Omni.vendor('jshint.js');
			window.JSHINT(code, { esversion: 11, undef: true, unused: true, browser: true, node: true, devel: true, module: /\b(import|export)\b/.test(code) });
			window.JSHINT.errors.filter(Boolean).forEach((e) => rows.push([e.line, 'lint', e.reason]));
		}
		rows.sort((a, b) => a[0] - b[0]);
		return rows.length
			? { text: rows.map(([l, s, m]) => `Line ${l} (${s}): ${m}`).join('\n'), label: `${rows.length} findings (${found.lang})`, table: { columns: ['Line', 'Kind', 'Finding'], rows, numeric: [0] } }
			: { text: 'No common mistakes found by the offline checks.', label: 'Result' };
	},
});
