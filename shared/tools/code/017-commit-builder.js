// No. 017 Commit message builder: assembles and checks a Conventional Commits message.
Omni.register({
	no: 17,
	id: 'commit-builder',
	name: 'Commit message builder',
	category: 'code',
	keywords: ['git', 'commit', 'conventional commits', 'message', 'changelog'],
	description: 'Builds a Conventional Commits message and checks it against the usual rules.',
	live: true,
	inputs: [
		{ name: 'type', label: 'Type', type: 'select', options: [
			{ value: 'feat', label: 'feat: a new feature' }, { value: 'fix', label: 'fix: a bug fix' }, { value: 'docs', label: 'docs: documentation' }, { value: 'style', label: 'style: formatting only' },
			{ value: 'refactor', label: 'refactor: no behavior change' }, { value: 'perf', label: 'perf: faster' }, { value: 'test', label: 'test: tests' }, { value: 'build', label: 'build: build or dependencies' },
			{ value: 'ci', label: 'ci: CI config' }, { value: 'chore', label: 'chore: maintenance' }, { value: 'revert', label: 'revert: undo a commit' },
		], default: 'fix' },
		{ name: 'scope', label: 'Scope (optional)', type: 'text', placeholder: 'For example: parser' },
		{ name: 'subject', label: 'Subject', type: 'text', default: 'handle empty input without crashing', wide: true },
		{ name: 'body', label: 'Body (optional)', type: 'textarea', rows: 4, placeholder: 'What changed and why. Wrap at 72 characters.' },
		{ name: 'breaking', label: 'Breaking change', type: 'checkbox' },
		{ name: 'breakingNote', label: 'What breaks', type: 'text', when: (v) => v.breaking, wide: true },
		{ name: 'refs', label: 'Closes issues', type: 'text', placeholder: '#12, #40' },
	],
	run({ type, scope, subject, body, breaking, breakingNote, refs }) {
		const header = `${type}${scope.trim() ? `(${scope.trim()})` : ''}${breaking ? '!' : ''}: ${subject.trim()}`;
		const wrap = (text) => text.split('\n').map((para) => para.split(' ').reduce((lines, word) => {
			const last = lines[lines.length - 1];
			if (last && (last + ' ' + word).length <= 72) lines[lines.length - 1] = last + ' ' + word;
			else lines.push(word);
			return lines;
		}, []).join('\n')).join('\n');
		const parts = [header];
		if (body.trim()) parts.push(wrap(body.trim()));
		const footer = [];
		if (breaking) footer.push(`BREAKING CHANGE: ${breakingNote.trim() || 'describe what breaks'}`);
		refs.split(/[,\s]+/).filter(Boolean).forEach((r) => footer.push(`Closes ${r.startsWith('#') ? r : '#' + r}`));
		if (footer.length) parts.push(footer.join('\n'));
		const message = parts.join('\n\n');
		const s = subject.trim();
		const checks = [
			['Subject is filled in', !!s],
			[`Header is 72 characters or fewer (now ${header.length})`, header.length <= 72],
			['Subject starts lowercase', !s || s[0] === s[0].toLowerCase()],
			['Subject has no trailing period', !s.endsWith('.')],
			['Subject is imperative ("add", not "added" or "adds")', !/^(added|adds|fixed|fixes|updated|updates|removed|removes|changed|changes)\b/i.test(s)],
			['Scope is one lowercase word', !scope.trim() || /^[a-z0-9-]+$/.test(scope.trim())],
		];
		return {
			text: message,
			label: 'Commit message',
			table: { label: 'Checks', columns: ['Rule', 'Result'], rows: checks.map(([r, ok]) => [r, ok ? 'Pass' : 'Fix this']) },
			note: `Use it with: git commit -F message.txt, or paste it into your editor.`,
		};
	},
});
