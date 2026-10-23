// No. 098 To-do list: priorities, due dates, filters and keyboard reordering, saved on this device.
Omni.register({
	no: 98,
	id: 'todo',
	name: 'To-do list',
	category: 'productivity',
	keywords: ['todo', 'tasks', 'checklist', 'list', 'due', 'priority'],
	description: 'Tasks with priority and due date. Filter by active, done or overdue; reorder with the arrow buttons.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let items = ctx.store.get('items', []);
		let filter = ctx.store.get('filter', 'active');
		const save = () => ctx.store.set('items', items);
		const today = () => new Date().toISOString().slice(0, 10);
		const text = h('input', { type: 'text', id: 'todo-text', placeholder: 'What needs doing?', required: true });
		const prio = h('select', { id: 'todo-prio' }, h('option', { value: 'normal' }, 'Normal'), h('option', { value: 'high' }, 'High'), h('option', { value: 'low' }, 'Low'));
		const due = h('input', { type: 'date', id: 'todo-due' });
		const list = h('ul', { class: 'list', 'aria-label': 'Tasks' });
		const counts = h('p', { class: 'muted', role: 'status' });
		const filters = h('div', { class: 'seg', role: 'group', 'aria-label': 'Show' });

		const visible = () => items.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : filter === 'overdue' ? !t.done && t.due && t.due < today() : !t.done));
		const move = (id, d) => {
			const i = items.findIndex((t) => t.id === id);
			const j = i + d;
			if (j < 0 || j >= items.length) return;
			[items[i], items[j]] = [items[j], items[i]];
			save();
			draw();
			const btn = list.querySelector(`[data-id="${id}"] [data-move="${d}"]`);
			if (btn) btn.focus();
		};
		const edit = async (t) => {
			const v = await Omni.ui.prompt({ title: 'Edit task', value: t.text, confirmLabel: 'Save' });
			if (v && v.trim()) {
				t.text = v.trim();
				save();
				draw();
			}
		};
		function draw() {
			filters.replaceChildren(...[['active', 'Active'], ['overdue', 'Overdue'], ['done', 'Done'], ['all', 'All']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(filter === v), onclick: () => ((filter = v), ctx.store.set('filter', v), draw()) }, l)));
			const shown = visible();
			list.replaceChildren(
				...(shown.length
					? shown.map((t) => {
						const overdue = !t.done && t.due && t.due < today();
						const cb = h('input', { type: 'checkbox', checked: t.done, 'aria-label': `Done: ${t.text}`, onchange: () => ((t.done = cb.checked), (t.doneAt = cb.checked ? Date.now() : null), save(), draw()) });
						return h('li', { 'data-id': t.id },
							cb,
							h('div', { class: 'grow' }, h('span', { style: { textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--muted)' : 'inherit' } }, t.text), h('div', { class: 'row', style: { marginTop: '2px' } }, t.prio !== 'normal' ? h('span', { class: 'chip' }, t.prio === 'high' ? 'High priority' : 'Low priority') : null, t.due ? h('span', { class: 'chip', style: overdue ? { borderColor: 'var(--signal)', color: 'var(--signal)' } : null }, overdue ? `Overdue: ${t.due}` : `Due ${t.due}`) : null)),
							h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move up: ${t.text}`, 'data-move': '-1', onclick: () => move(t.id, -1) }, icon('up')),
							h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move down: ${t.text}`, 'data-move': '1', onclick: () => move(t.id, 1) }, icon('down')),
							h('button', { type: 'button', class: 'btn btn-small btn-quiet', onclick: () => edit(t) }, 'Edit'),
							h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete: ${t.text}`, onclick: () => ((items = items.filter((x) => x.id !== t.id)), save(), draw()) }, icon('trash')),
						);
					})
					: [h('li', null, h('span', { class: 'muted' }, items.length ? `Nothing ${filter === 'all' ? 'here' : filter}.` : 'No tasks yet. Add one above.'))]),
			);
			const open = items.filter((t) => !t.done).length;
			counts.textContent = `${open} open, ${items.length - open} done, ${items.filter((t) => !t.done && t.due && t.due < today()).length} overdue.`;
		}
		const add = (e) => {
			e.preventDefault();
			if (!text.value.trim()) return text.focus();
			items.unshift({ id: Math.random().toString(36).slice(2, 10), text: text.value.trim(), prio: prio.value, due: due.value || null, done: false, created: Date.now() });
			save();
			text.value = '';
			due.value = '';
			if (filter === 'done') filter = 'active';
			draw();
			text.focus();
		};
		root.appendChild(h('div', { class: 'stack-lg' },
			h('form', { class: 'panel', onsubmit: add }, h('div', { class: 'fields' }, h('div', { class: 'field wide' }, h('label', { for: 'todo-text' }, 'New task'), text), h('div', { class: 'field' }, h('label', { for: 'todo-prio' }, 'Priority'), prio), h('div', { class: 'field' }, h('label', { for: 'todo-due' }, 'Due date'), due), h('div', { class: 'field' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add task')))),
			h('section', { class: 'panel stack', 'aria-label': 'Tasks' }, h('div', { class: 'row between' }, filters, h('button', { type: 'button', class: 'btn btn-small', onclick: async () => {
				const done = items.filter((t) => t.done).length;
				if (!done) return Omni.ui.toast('No finished tasks to clear.');
				if (await Omni.ui.confirm({ title: `Clear ${done} finished tasks?`, body: 'They are deleted from this device.', confirmLabel: 'Clear finished' })) {
					items = items.filter((t) => !t.done);
					save();
					draw();
				}
			} }, 'Clear finished')), counts, list),
		));
		draw();
	},
});
