// No. 016 Snippet manager: saved, tagged, searchable code snippets that can be sent to Code Pad.
Omni.register({
	no: 16,
	id: 'snippets',
	name: 'Snippet manager',
	category: 'code',
	keywords: ['snippet', 'library', 'save code', 'templates', 'gist'],
	description: 'Keeps reusable code snippets with tags. Search, copy, or open one in Code Pad.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let snippets = ctx.store.get('list', []);
		let selected = null;
		const save = () => ctx.store.set('list', snippets);
		const search = h('input', { type: 'search', placeholder: 'Search titles, tags and code', 'aria-label': 'Search snippets' });
		const list = h('ul', { class: 'list', 'aria-label': 'Snippets' });
		const title = h('input', { type: 'text', id: 'snip-title', placeholder: 'For example: debounce helper' });
		const lang = h('select', { id: 'snip-lang' }, Object.entries(Omni.editor.MODES).map(([k, m]) => h('option', { value: k }, m.label)));
		const tags = h('input', { type: 'text', id: 'snip-tags', placeholder: 'Comma separated, for example: js, timing' });
		const code = h('textarea', { class: 'code', rows: 12, id: 'snip-code', spellcheck: 'false' });
		const status = h('p', { class: 'muted', role: 'status' });

		const draw = () => {
			const q = search.value.trim().toLowerCase();
			const shown = snippets.filter((s) => !q || [s.title, s.tags.join(' '), s.code].join(' ').toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated);
			list.replaceChildren(
				...(shown.length
					? shown.map((s) =>
						h('li', null, h('div', { class: 'grow' }, h('button', { type: 'button', class: 'btn-quiet', style: { border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0, fontWeight: s.id === selected ? 700 : 500 }, onclick: () => edit(s.id) }, s.title || 'Untitled'), h('div', { class: 'row', style: { marginTop: '4px' } }, h('span', { class: 'chip' }, Omni.editor.MODES[s.lang] ? Omni.editor.MODES[s.lang].label : s.lang), s.tags.map((t) => h('span', { class: 'chip' }, t)))), h('button', { type: 'button', class: 'btn btn-small btn-quiet', onclick: () => Omni.util.copy(s.code), 'aria-label': `Copy ${s.title}` }, icon('copy'))),
					)
					: [h('li', null, h('span', { class: 'muted' }, snippets.length ? 'No snippet matches that search.' : 'No snippets yet. Fill in the form and press Save snippet.'))]),
			);
		};
		const edit = (id) => {
			selected = id;
			const s = snippets.find((x) => x.id === id) || { title: '', lang: 'javascript', tags: [], code: '' };
			title.value = s.title;
			lang.value = s.lang;
			tags.value = s.tags.join(', ');
			code.value = s.code;
			status.textContent = id ? `Editing "${s.title}"` : 'New snippet';
			draw();
		};
		const saveSnippet = () => {
			if (!code.value.trim()) return Omni.ui.toast('A snippet needs some code.', { error: true });
			const data = { title: title.value.trim() || 'Untitled', lang: lang.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean), code: code.value, updated: Date.now() };
			if (selected) Object.assign(snippets.find((s) => s.id === selected), data);
			else {
				selected = Math.random().toString(36).slice(2, 10);
				snippets.push({ id: selected, ...data });
			}
			save();
			status.textContent = `Saved "${data.title}"`;
			draw();
		};
		const remove = async () => {
			if (!selected) return;
			const s = snippets.find((x) => x.id === selected);
			if (!(await Omni.ui.confirm({ title: `Delete "${s.title}"?`, body: 'This removes it from this device.', confirmLabel: 'Delete snippet' }))) return;
			snippets = snippets.filter((x) => x.id !== selected);
			save();
			edit(null);
		};
		const toPad = () => {
			if (!code.value.trim()) return;
			const ext = (Omni.editor.MODES[lang.value] || { ext: ['txt'] }).ext[0];
			Omni.codepad.write(code.value, `${(title.value || 'snippet').replace(/[^\w-]+/g, '-').toLowerCase()}.${ext}`);
			Omni.open('codepad');
		};
		search.addEventListener('input', draw);
		root.appendChild(
			h('div', { class: 'io split' },
				h('div', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Library'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => edit(null) }, icon('plus'), 'New')), search, list, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.util.download('omnitool-snippets.json', JSON.stringify(snippets, null, 2), 'application/json') }, 'Export JSON'))),
				h('form', { class: 'panel stack', onsubmit: (e) => (e.preventDefault(), saveSnippet()) },
					status,
					h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'snip-title' }, 'Title'), title), h('div', { class: 'field' }, h('label', { for: 'snip-lang' }, 'Language'), lang), h('div', { class: 'field wide' }, h('label', { for: 'snip-tags' }, 'Tags'), tags), h('div', { class: 'field wide' }, h('label', { for: 'snip-code' }, 'Code'), code)),
					h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save snippet'), h('button', { type: 'button', class: 'btn', onclick: () => Omni.util.copy(code.value) }, 'Copy'), h('button', { type: 'button', class: 'btn', onclick: toPad }, 'Open in Code Pad'), h('button', { type: 'button', class: 'btn', onclick: remove }, 'Delete')),
				),
			),
		);
		edit(snippets[0] ? snippets[0].id : null);
	},
});
