// No. 119 Folder size analyzer (desktop): what takes up space inside a folder.
Omni.register({
	no: 119,
	id: 'folder-size',
	name: 'Folder size analyzer',
	category: 'system',
	editions: ['desktop'],
	keywords: ['folder size', 'disk space', 'largest files', 'cleanup', 'du', 'treesize'],
	description: 'Measures each subfolder of a folder and lists the 25 largest files, so you can see what fills the disk.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const folderLabel = h('code', null, ctx.store.get('folder', 'No folder chosen'));
		const out = h('div', { class: 'stack', 'aria-live': 'polite' });
		const cancel = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => Omni.native.sys.cancelFolderSize() }, 'Stop');
		const f = Omni.util.fmt.bytes;
		const scan = async (folder) => {
			out.replaceChildren(Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, `Measuring ${folder}`)));
			cancel.hidden = false;
			try {
				const r = await Omni.native.sys.folderSize(folder);
				const max = Math.max(1, ...r.children.map((c) => c.size));
				Omni.forms.renderOutput({
					readings: [{ label: 'Total size', value: f(r.total), copy: false }, { label: 'Files', value: r.files.toLocaleString(), copy: false }, { label: 'Folders', value: r.dirs.toLocaleString(), copy: false }, { label: 'Unreadable entries', value: r.skipped, copy: false }],
					blocks: [
						r.cancelled ? { type: 'note', value: 'Stopped early: totals cover what was measured so far.' } : null,
						{ type: 'node', node: Omni.forms.block('Inside this folder, largest first', h('div', { class: 'stack' }, r.children.slice(0, 40).map((c) => Omni.forms.meter(c.size / max, `${c.dir ? '[folder] ' : ''}${c.name}`, f(c.size))))) },
						{ type: 'table', label: 'Largest files', columns: ['File', 'Size'], rows: r.largest.map((x) => [x.path, f(x.size)]), numeric: [1] },
					].filter(Boolean),
				}, out);
			} catch (err) {
				out.replaceChildren(Omni.forms.stateBox('error', 'Could not measure that folder.', err.message));
			} finally {
				cancel.hidden = true;
			}
		};
		const choose = async () => {
			const folder = await Omni.native.dialog.openFolder();
			if (!folder) return;
			ctx.store.set('folder', folder);
			folderLabel.textContent = folder;
			scan(folder);
		};
		root.appendChild(h('div', { class: 'stack-lg' },
			h('div', { class: 'panel stack' }, h('p', null, 'Folder: ', folderLabel), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: choose }, 'Choose a folder'), h('button', { type: 'button', class: 'btn', onclick: () => ctx.store.get('folder') && scan(ctx.store.get('folder')) }, 'Measure again'), cancel)),
			h('section', { class: 'panel', 'aria-label': 'Sizes' }, out),
		));
		out.appendChild(Omni.forms.stateBox('empty', null, 'Choose a folder to measure. Big folders like C:\\Users can take a minute.'));
		return () => Omni.native.sys.cancelFolderSize();
	},
});
