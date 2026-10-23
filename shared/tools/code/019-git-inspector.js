// No. 019 Git repository inspector (desktop): status, branches, recent commits and diff stat via the git command.
Omni.register({
	no: 19,
	id: 'git-inspector',
	name: 'Git repository inspector',
	category: 'code',
	editions: ['desktop'],
	keywords: ['git', 'status', 'branch', 'log', 'commits', 'repository'],
	description: 'Shows the status, branches, recent commits and uncommitted changes of a local Git repository. Read-only.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const out = h('div', { class: 'stack-lg', 'aria-live': 'polite' });
		const folderLabel = h('code', null, ctx.store.get('folder', 'No folder chosen'));
		const inspect = async (folder) => {
			out.replaceChildren(Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, 'Running git')));
			try {
				const r = await Omni.native.git.inspect(folder);
				const blocks = [
					{ type: 'readings', items: [
						{ label: 'Branch', value: r.branch },
						{ label: 'Upstream', value: r.upstream || 'none', copy: false },
						{ label: 'Ahead / behind', value: r.upstream ? `${r.ahead} / ${r.behind}` : '-', copy: false },
						{ label: 'Changed files', value: r.status.length, copy: false },
						{ label: 'Last commit', value: r.log[0] ? r.log[0].when : '-', copy: false },
					] },
					r.status.length ? { type: 'table', label: 'Working tree', columns: ['State', 'Path'], rows: r.status.map((s) => [s.state, s.path]) } : { type: 'note', value: 'Working tree is clean.' },
					r.diffstat ? { type: 'text', label: 'Uncommitted diff stat', value: r.diffstat } : null,
					{ type: 'table', label: 'Recent commits', columns: ['Commit', 'When', 'Author', 'Message'], rows: r.log.map((c) => [c.hash, c.when, c.author, c.subject]) },
					{ type: 'table', label: 'Branches', columns: ['Branch', 'Last commit'], rows: r.branches.map((b) => [(b.current ? '* ' : '') + b.name, b.when]) },
				].filter(Boolean);
				Omni.forms.renderOutput({ blocks }, out);
			} catch (err) {
				out.replaceChildren(Omni.forms.stateBox('error', 'Git could not read that folder.', err.message));
			}
		};
		const choose = async () => {
			const folder = await Omni.native.dialog.openFolder();
			if (!folder) return;
			ctx.store.set('folder', folder);
			folderLabel.textContent = folder;
			inspect(folder);
		};
		root.appendChild(h('div', { class: 'stack-lg' },
			h('div', { class: 'panel stack' }, h('p', null, 'Repository: ', folderLabel), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: choose }, 'Choose a repository folder'), h('button', { type: 'button', class: 'btn', onclick: () => ctx.store.get('folder') && inspect(ctx.store.get('folder')) }, 'Refresh'))),
			h('section', { class: 'panel' }, out),
		));
		if (ctx.store.get('folder')) inspect(ctx.store.get('folder'));
		else out.appendChild(Omni.forms.stateBox('empty', 'No repository yet.', 'Choose a folder that contains a .git directory. Needs Git installed (git-scm.com).'));
	},
});
