// No. 099 Notes: Markdown notes with search and a sanitized preview, saved on this device.
Omni.register({
	no: 99,
	id: 'notes',
	name: 'Notes',
	category: 'productivity',
	keywords: ['notes', 'notepad', 'markdown', 'journal', 'memo', 'write'],
	description: 'Markdown notes with search and preview. Saved as you type; download any note as a .md file.',
	vendor: ['marked.umd.js', 'purify.min.js'],
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let notes = ctx.store.get('notes', []);
		let current = ctx.store.get('current', notes[0] ? notes[0].id : null);
		let preview = false;
		const save = Omni.util.debounce(() => ctx.store.set('notes', notes), 300);
		const search = h('input', { type: 'search', placeholder: 'Search notes', 'aria-label': 'Search notes' });
		const list = h('ul', { class: 'list', 'aria-label': 'Notes' });
		const title = h('input', { type: 'text', id: 'note-title', placeholder: 'Title' });
		const body = h('textarea', { id: 'note-body', rows: 18, placeholder: 'Write in Markdown: # heading, **bold**, - lists' });
		const view = h('div', { class: 'msg-body panel', hidden: true, style: { minHeight: '300px' } });
		const toggle = h('button', { type: 'button', class: 'btn btn-small', 'aria-pressed': 'false' }, 'Preview');
		const stamp = h('span', { class: 'muted', style: { fontSize: '0.8rem' } });
		const editor = h('div', { class: 'stack' });
		const note = () => notes.find((n) => n.id === current);

		const drawList = () => {
			const q = search.value.trim().toLowerCase();
			const shown = notes.filter((n) => !q || (n.title + ' ' + n.body).toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated);
			list.replaceChildren(...(shown.length ? shown.map((n) => h('li', null, h('button', { type: 'button', class: 'grow', style: { border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontWeight: n.id === current ? 700 : 400, padding: '4px 0' }, 'aria-current': n.id === current ? 'true' : null, onclick: () => open(n.id) }, n.title || 'Untitled', h('br'), h('span', { class: 'muted', style: { fontSize: '0.78rem' } }, new Date(n.updated).toLocaleString())))) : [h('li', null, h('span', { class: 'muted' }, notes.length ? 'No note matches.' : 'No notes yet.'))]));
		};
		const drawEditor = () => {
			const n = note();
			editor.hidden = !n;
			if (!n) return;
			title.value = n.title;
			body.value = n.body;
			stamp.textContent = `Edited ${new Date(n.updated).toLocaleString()}`;
			renderPreview();
		};
		const renderPreview = () => {
			body.hidden = preview;
			view.hidden = !preview;
			toggle.setAttribute('aria-pressed', String(preview));
			toggle.textContent = preview ? 'Edit' : 'Preview';
			if (preview) view.innerHTML = window.DOMPurify.sanitize(window.marked.parse(body.value || '*Empty note*'));
		};
		const open = (id) => {
			current = id;
			ctx.store.set('current', id);
			drawList();
			drawEditor();
		};
		const create = () => {
			const n = { id: Math.random().toString(36).slice(2, 10), title: '', body: '', updated: Date.now() };
			notes.push(n);
			ctx.store.set('notes', notes);
			preview = false;
			open(n.id);
			title.focus();
		};
		const change = () => {
			const n = note();
			if (!n) return;
			n.title = title.value;
			n.body = body.value;
			n.updated = Date.now();
			stamp.textContent = 'Saved';
			save();
			drawList();
		};
		title.addEventListener('input', change);
		body.addEventListener('input', change);
		search.addEventListener('input', drawList);
		toggle.onclick = () => ((preview = !preview), renderPreview());
		Omni.append(editor, [
			h('div', { class: 'field' }, h('label', { for: 'note-title' }, 'Title'), title),
			h('div', { class: 'row between' }, h('label', { for: 'note-body', class: 'field-label' }, 'Note'), h('div', { class: 'row' }, toggle, h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.util.download(`${(note().title || 'note').replace(/[^\w -]+/g, '').trim() || 'note'}.md`, `# ${note().title}\n\n${note().body}`) }, icon('download'), '.md'), h('button', { type: 'button', class: 'btn btn-small', onclick: async () => {
				if (!(await Omni.ui.confirm({ title: `Delete "${note().title || 'Untitled'}"?`, body: 'The note is removed from this device.', confirmLabel: 'Delete note' }))) return;
				notes = notes.filter((n) => n.id !== current);
				ctx.store.set('notes', notes);
				current = notes[0] ? notes[0].id : null;
				drawList();
				drawEditor();
			} }, 'Delete'))),
			body,
			view,
			stamp,
		]);
		root.appendChild(h('div', { class: 'io aside-left' },
			h('div', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Notes'), h('button', { type: 'button', class: 'btn btn-small btn-primary', onclick: create }, icon('plus'), 'New note')), search, list),
			h('div', { class: 'panel' }, editor, notes.length ? null : Omni.forms.stateBox('empty', 'No notes yet.', 'Press New note to start one.')),
		));
		Omni.vendor(['marked.umd.js', 'purify.min.js']).then(() => {
			drawList();
			drawEditor();
		});
		return () => ctx.store.set('notes', notes);
	},
});
