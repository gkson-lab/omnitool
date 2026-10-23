// No. 107 Kanban board: columns and cards you move with buttons (keyboard) or by dragging.
Omni.register({
	no: 107,
	id: 'kanban',
	name: 'Kanban board',
	category: 'productivity',
	keywords: ['kanban', 'board', 'cards', 'trello', 'columns', 'workflow', 'tasks'],
	description: 'A board of columns and cards. Move cards with the arrow buttons or by dragging; rename and add columns.',
	layout: 'wide',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let board = ctx.store.get('board', { columns: [{ id: 'todo', name: 'To do', cards: [] }, { id: 'doing', name: 'Doing', cards: [] }, { id: 'done', name: 'Done', cards: [] }] });
		const save = () => ctx.store.set('board', board);
		const wrap = h('div', { style: { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(250px, 1fr)', gap: '16px', overflowX: 'auto', paddingBottom: '8px', alignItems: 'start' } });
		let dragging = null;
		const id = () => Math.random().toString(36).slice(2, 10);
		const find = (cardId) => {
			for (const [ci, col] of board.columns.entries()) {
				const i = col.cards.findIndex((c) => c.id === cardId);
				if (i !== -1) return { ci, i, col };
			}
			return null;
		};
		const moveCard = (cardId, dc, di, focusName) => {
			const at = find(cardId);
			const toCol = at.ci + dc;
			if (toCol < 0 || toCol >= board.columns.length) return;
			const [card] = at.col.cards.splice(at.i, 1);
			const target = board.columns[toCol].cards;
			const pos = dc ? target.length : Math.max(0, Math.min(target.length, at.i + di));
			target.splice(pos, 0, card);
			save();
			draw();
			if (focusName) {
				const btn = wrap.querySelector(`[data-card="${cardId}"] [data-act="${focusName}"]`);
				if (btn && !btn.disabled) btn.focus();
			}
		};
		function draw() {
			wrap.replaceChildren(...board.columns.map((col, ci) => {
				const addInput = h('input', { type: 'text', placeholder: 'New card', 'aria-label': `New card in ${col.name}` });
				return h('section', {
					class: 'panel tight stack',
					'aria-label': col.name,
					ondragover: (e) => e.preventDefault(),
					ondrop: (e) => {
						e.preventDefault();
						if (!dragging) return;
						const at = find(dragging);
						const [card] = at.col.cards.splice(at.i, 1);
						col.cards.push(card);
						dragging = null;
						save();
						draw();
					},
				},
				h('div', { class: 'row between' }, h('h2', { style: { fontSize: '1rem' } }, col.name, h('span', { class: 'muted mono', style: { fontSize: '0.75rem', marginLeft: '6px' } }, col.cards.length)), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small btn-quiet', onclick: async () => {
					const v = await Omni.ui.prompt({ title: 'Rename column', value: col.name });
					if (v && v.trim()) {
						col.name = v.trim();
						save();
						draw();
					}
				} }, 'Rename'), board.columns.length > 1 ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete column ${col.name}`, onclick: async () => {
					if (col.cards.length && !(await Omni.ui.confirm({ title: `Delete "${col.name}" and its ${col.cards.length} cards?`, confirmLabel: 'Delete column' }))) return;
					board.columns.splice(ci, 1);
					save();
					draw();
				} }, icon('close')) : null)),
				h('ul', { class: 'list' }, col.cards.length ? col.cards.map((c, i) => h('li', { draggable: 'true', 'data-card': c.id, ondragstart: () => (dragging = c.id), style: { flexWrap: 'wrap', cursor: 'grab' } },
					h('span', { class: 'grow' }, c.title),
					h('div', { class: 'row', style: { gap: '2px' } },
						h('button', { type: 'button', class: 'icon-btn', 'data-act': 'left', 'aria-label': `Move "${c.title}" to ${board.columns[ci - 1] ? board.columns[ci - 1].name : 'previous column'}`, disabled: ci === 0, onclick: () => moveCard(c.id, -1, 0) }, icon('back')),
						h('button', { type: 'button', class: 'icon-btn', 'data-act': 'up', 'aria-label': `Move "${c.title}" up`, disabled: i === 0, onclick: () => moveCard(c.id, 0, -1, 'up') }, icon('up')),
						h('button', { type: 'button', class: 'icon-btn', 'data-act': 'down', 'aria-label': `Move "${c.title}" down`, disabled: i === col.cards.length - 1, onclick: () => moveCard(c.id, 0, 1, 'down') }, icon('down')),
						h('button', { type: 'button', class: 'icon-btn', 'data-act': 'right', 'aria-label': `Move "${c.title}" to ${board.columns[ci + 1] ? board.columns[ci + 1].name : 'next column'}`, disabled: ci === board.columns.length - 1, onclick: () => moveCard(c.id, 1, 0) }, h('span', { style: { transform: 'scaleX(-1)', display: 'inline-flex' } }, icon('back'))),
						h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete "${c.title}"`, onclick: () => ((col.cards = col.cards.filter((x) => x.id !== c.id)), save(), draw()) }, icon('trash')),
					),
				)) : [h('li', null, h('span', { class: 'muted' }, 'Empty'))]),
				h('form', { class: 'row', style: { flexWrap: 'nowrap' }, onsubmit: (e) => {
					e.preventDefault();
					if (!addInput.value.trim()) return;
					col.cards.push({ id: id(), title: addInput.value.trim() });
					save();
					draw();
					const again = wrap.querySelectorAll('section')[ci].querySelector('input');
					if (again) again.focus();
				} }, addInput, h('button', { type: 'submit', class: 'btn btn-small' }, 'Add')),
				);
			}), h('button', { type: 'button', class: 'btn', style: { alignSelf: 'start' }, onclick: async () => {
				const v = await Omni.ui.prompt({ title: 'New column', value: 'Review', confirmLabel: 'Add column' });
				if (v && v.trim()) {
					board.columns.push({ id: id(), name: v.trim(), cards: [] });
					save();
					draw();
				}
			} }, icon('plus'), 'Add column'));
		}
		root.appendChild(wrap);
		draw();
	},
});
