// No. 110 Quick launcher (desktop): pinned folders, programs and web links that open with one click.
Omni.register({
	no: 110,
	id: 'launcher',
	name: 'Quick launcher',
	category: 'productivity',
	editions: ['desktop'],
	keywords: ['launcher', 'shortcuts', 'open', 'folders', 'apps', 'bookmarks', 'quick'],
	description: 'Keep the folders, programs, files and web links you open all day in one list. One click opens each.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		const n = Omni.native;
		let items = ctx.store.get('items', []);
		const save = () => ctx.store.set('items', items);
		const list = h('ul', { class: 'list', 'aria-label': 'Shortcuts' });
		const add = (target, kind) => {
			const label = target.split(/[\\/]/).filter(Boolean).pop() || target;
			items.push({ id: Math.random().toString(36).slice(2, 10), label, target, kind });
			save();
			draw();
		};
		const draw = () => {
			list.replaceChildren(...(items.length ? items.map((it, i) => h('li', null,
				h('button', { type: 'button', class: 'btn', onclick: async () => {
					try {
						await n.launcher.open(it.target);
					} catch (err) {
						Omni.ui.toast(err.message, { error: true, title: `Could not open ${it.label}.` });
					}
				} }, 'Open'),
				h('div', { class: 'grow' }, h('strong', null, it.label), h('div', { class: 'muted mono', style: { fontSize: '0.76rem' } }, `${it.kind}: ${it.target}`)),
				h('button', { type: 'button', class: 'btn btn-small btn-quiet', onclick: async () => {
					const v = await Omni.ui.prompt({ title: 'Rename shortcut', value: it.label });
					if (v && v.trim()) {
						it.label = v.trim();
						save();
						draw();
					}
				} }, 'Rename'),
				h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move ${it.label} up`, disabled: i === 0, onclick: () => (([items[i - 1], items[i]] = [items[i], items[i - 1]]), save(), draw()) }, icon('up')),
				h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove ${it.label}`, onclick: () => ((items = items.filter((x) => x !== it)), save(), draw()) }, icon('trash')),
			)) : [h('li', null, h('span', { class: 'muted' }, 'No shortcuts yet. Add a folder, a program or a link.'))]));
		};
		root.appendChild(h('div', { class: 'panel stack' },
			h('div', { class: 'row' },
				h('button', { type: 'button', class: 'btn', onclick: async () => {
					const f = await n.dialog.openFolder();
					if (f) add(f, 'folder');
				} }, icon('plus'), 'Folder'),
				h('button', { type: 'button', class: 'btn', onclick: async () => {
					const f = await n.dialog.openFile({});
					if (f && f[0]) add(f[0].path, /\.(exe|bat|cmd|lnk|msc)$/i.test(f[0].path) ? 'program' : 'file');
				} }, icon('plus'), 'Program or file'),
				h('button', { type: 'button', class: 'btn', onclick: async () => {
					const u = await Omni.ui.prompt({ title: 'Add a web link', value: 'https://', confirmLabel: 'Add link' });
					if (!u) return;
					if (!/^https?:\/\//i.test(u.trim())) return Omni.ui.toast('Links must start with http:// or https://', { error: true });
					items.push({ id: Math.random().toString(36).slice(2, 10), label: u.trim().replace(/^https?:\/\//, '').split('/')[0], target: u.trim(), kind: 'link' });
					save();
					draw();
				} }, icon('plus'), 'Web link'),
			),
			list,
		));
		draw();
	},
});
