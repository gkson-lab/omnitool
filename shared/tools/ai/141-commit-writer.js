// No. 141 Commit message writer: Claude summarizes a diff; offline builds a Conventional Commits message from file stats.
Omni.aiTool({
	no: 141,
	id: 'commit-writer',
	name: 'Commit message writer',
	keywords: ['commit', 'git', 'message', 'diff', 'conventional commits', 'changelog'],
	description: 'Writes a commit message from a diff. On desktop it can read the staged (or unstaged) diff of a repository for you.',
	action: 'Write message',
	codeField: 'diff',
	noLoad: true,
	markdown: false,
	emptyText: Omni.edition === 'desktop' ? 'Paste a diff, or press "Load diff from a repository".' : 'Paste the output of git diff --staged.',
	offlineLabel: 'Builds a Conventional Commits message from which files changed and how many lines.',
	inputs: [
		{ name: 'diff', label: 'Diff', type: 'textarea', mono: true, rows: 12, default: 'diff --git a/src/parser.js b/src/parser.js\n--- a/src/parser.js\n+++ b/src/parser.js\n@@ -10,6 +10,9 @@ export function parse(input) {\n+  if (!input) {\n+    return [];\n+  }\n   const tokens = tokenize(input);\n' },
		{ name: 'style', label: 'Style', type: 'select', options: [{ value: 'conventional', label: 'Conventional Commits' }, { value: 'plain', label: 'Plain imperative' }], default: 'conventional' },
		{ name: 'body', label: 'Include a body explaining why', type: 'checkbox', default: true },
	],
	extraActions: (set) => (Omni.native ? Omni.h('button', { type: 'button', class: 'btn', onclick: async () => {
		const folder = await Omni.native.dialog.openFolder();
		if (!folder) return;
		try {
			const d = await Omni.native.git.diff(folder);
			if (!d.diff.trim()) return Omni.ui.toast('That repository has no uncommitted changes.');
			set('diff', d.diff);
			Omni.ui.toast(`Loaded the ${d.staged ? 'staged' : 'unstaged'} diff of ${folder}`);
		} catch (err) {
			Omni.ui.toast(err.message, { error: true, title: 'Could not read the diff.' });
		}
	} }, 'Load diff from a repository') : null),
	system: () => 'You write git commit messages. Subject line: imperative mood, at most 72 characters, no trailing period. If a body is requested, add a blank line and wrap the body at 72 columns, explaining what changed and why in plain sentences. Reply with only the commit message, no code fences or commentary.',
	prompt: ({ diff, style, body }) => `Write a ${style === 'conventional' ? 'Conventional Commits (type(scope): subject)' : 'plain imperative'} commit message${body ? ' with a short body' : ', subject line only'} for this diff:\n\n${diff.slice(0, 120000)}`,
	offline: ({ diff, style, body }) => {
		const r = Omni.codeinfo.commitFromDiff(diff);
		const subject = style === 'conventional' ? `${r.type}${r.scope ? `(${r.scope})` : ''}: ${r.subject}` : r.subject.charAt(0).toUpperCase() + r.subject.slice(1);
		return { text: body ? `${subject}\n\n${r.message.split('\n\n')[1]}` : subject, label: 'Commit message' };
	},
});
