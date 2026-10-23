// No. 106 Habit tracker: daily check-offs over the last two weeks with current and best streaks.
Omni.register({
	no: 106,
	id: 'habits',
	name: 'Habit tracker',
	category: 'productivity',
	keywords: ['habit', 'streak', 'daily', 'tracker', 'routine', 'goal'],
	description: 'Tick off habits each day and watch the current and best streak for each, over a two-week grid.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let habits = ctx.store.get('habits', []);
		const save = () => ctx.store.set('habits', habits);
		const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const days = Array.from({ length: 14 }, (_, i) => {
			const d = new Date();
			d.setDate(d.getDate() - 13 + i);
			return d;
		});
		const name = h('input', { type: 'text', id: 'habit-name', placeholder: 'For example: read 20 pages' });
		const table = h('div', { class: 'table-wrap' });
		const streaks = (done) => {
			const set = new Set(done);
			let cur = 0;
			const d = new Date();
			if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
			while (set.has(iso(d))) {
				cur++;
				d.setDate(d.getDate() - 1);
			}
			const sorted = [...set].sort();
			let best = 0;
			let run = 0;
			let prev = null;
			for (const s of sorted) {
				const t = new Date(s + 'T12:00').getTime();
				run = prev !== null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
				best = Math.max(best, run);
				prev = t;
			}
			return { cur, best };
		};
		const draw = () => {
			if (!habits.length) {
				table.replaceChildren(Omni.forms.stateBox('empty', 'No habits yet.', 'Add one above, then tick each day you do it.'));
				return;
			}
			table.replaceChildren(h('table', { class: 'data' },
				h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Habit'), days.map((d) => h('th', { scope: 'col', style: { textAlign: 'center', fontWeight: iso(d) === iso(new Date()) ? 800 : 500 } }, d.toLocaleDateString(undefined, { weekday: 'narrow' }), h('br'), d.getDate())), h('th', { scope: 'col' }, 'Streak'), h('th', null, h('span', { class: 'sr-only' }, 'Delete')))),
				h('tbody', null, habits.map((hb) => {
					const s = streaks(hb.done);
					return h('tr', null, h('th', { scope: 'row' }, hb.name), days.map((d) => {
						const key = iso(d);
						const box = h('input', { type: 'checkbox', checked: hb.done.includes(key), 'aria-label': `${hb.name} on ${d.toLocaleDateString(undefined, { dateStyle: 'medium' })}`, onchange: () => {
							hb.done = box.checked ? [...hb.done, key] : hb.done.filter((x) => x !== key);
							save();
							draw();
						} });
						return h('td', { style: { textAlign: 'center' } }, box);
					}), h('td', { class: 'num' }, `${s.cur} now, best ${s.best}`), h('td', null, h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${hb.name}`, onclick: async () => {
						if (await Omni.ui.confirm({ title: `Delete "${hb.name}"?`, body: 'Its history is removed too.', confirmLabel: 'Delete habit' })) {
							habits = habits.filter((x) => x !== hb);
							save();
							draw();
						}
					} }, icon('trash'))));
				})),
			));
		};
		root.appendChild(h('div', { class: 'stack-lg' },
			h('form', { class: 'panel row', onsubmit: (e) => {
				e.preventDefault();
				if (!name.value.trim()) return name.focus();
				habits.push({ name: name.value.trim(), done: [] });
				save();
				name.value = '';
				draw();
			} }, h('div', { class: 'field', style: { flex: '1' } }, h('label', { for: 'habit-name' }, 'New habit'), name), h('button', { type: 'submit', class: 'btn btn-primary', style: { alignSelf: 'flex-end' } }, 'Add habit')),
			h('section', { class: 'panel', 'aria-label': 'Last 14 days' }, table),
		));
		draw();
	},
});
