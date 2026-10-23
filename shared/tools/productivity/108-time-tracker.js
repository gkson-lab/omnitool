// No. 108 Time tracker: start and stop a timer per project; totals for today and this week, CSV export.
Omni.register({
	no: 108,
	id: 'time-tracker',
	name: 'Time tracker',
	category: 'productivity',
	keywords: ['time tracking', 'timesheet', 'hours', 'project', 'billing', 'log'],
	description: 'Start a timer for a project, stop it when you switch. See today\'s and this week\'s totals and export entries as CSV.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let entries = ctx.store.get('entries', []);
		let running = ctx.store.get('running', null);
		const save = () => {
			ctx.store.set('entries', entries);
			ctx.store.set('running', running);
		};
		const project = h('input', { type: 'text', id: 'tt-project', list: 'tt-projects', placeholder: 'Project or task' });
		const datalist = h('datalist', { id: 'tt-projects' });
		const startBtn = h('button', { type: 'submit', class: 'btn btn-primary' });
		const live = h('p', { class: 'mono', role: 'timer', style: { fontSize: '1.6rem' } });
		const totals = h('div');
		const log = h('div');
		const dayStart = () => new Date(new Date().toDateString()).getTime();
		const weekStart = () => {
			const d = new Date(new Date().toDateString());
			d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
			return d.getTime();
		};
		const fmt = (ms) => Omni.util.fmt.duration(ms);
		const draw = () => {
			datalist.replaceChildren(...[...new Set(entries.map((e) => e.project))].map((p) => h('option', { value: p })));
			startBtn.textContent = running ? `Stop "${running.project}"` : 'Start timer';
			const sum = (since) => {
				const m = new Map();
				for (const e of entries) if (e.end > since) m.set(e.project, (m.get(e.project) || 0) + e.end - Math.max(e.start, since));
				if (running && Date.now() > since) m.set(running.project, (m.get(running.project) || 0) + Date.now() - Math.max(running.start, since));
				return [...m].sort((a, b) => b[1] - a[1]);
			};
			const today = sum(dayStart());
			const week = sum(weekStart());
			totals.replaceChildren(Omni.forms.readings([{ label: 'Today', value: fmt(today.reduce((s, [, v]) => s + v, 0)), copy: false }, { label: 'This week', value: fmt(week.reduce((s, [, v]) => s + v, 0)), copy: false }]), week.length ? Omni.forms.block('This week by project', Omni.forms.table(['Project', 'Today', 'This week'], week.map(([p, v]) => [p, fmt((today.find((x) => x[0] === p) || [0, 0])[1]), fmt(v)]), { numeric: [1, 2] })) : null);
			log.replaceChildren(entries.length ? Omni.forms.table(['Project', 'Start', 'Duration', ''], entries.slice().reverse().slice(0, 50).map((e) => [e.project, new Date(e.start).toLocaleString(), fmt(e.end - e.start), h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${e.project} entry`, onclick: () => ((entries = entries.filter((x) => x !== e)), save(), draw()) }, icon('trash'))]), { numeric: [2] }) : Omni.forms.stateBox('empty', null, 'Entries appear here when you stop a timer.'));
		};
		const tick = () => (live.textContent = running ? `${running.project}: ${fmt(Date.now() - running.start)}` : 'No timer running');
		const toggle = (e) => {
			e.preventDefault();
			if (running) {
				entries.push({ project: running.project, start: running.start, end: Date.now() });
				running = null;
			} else {
				const p = project.value.trim();
				if (!p) return project.focus();
				running = { project: p, start: Date.now() };
			}
			save();
			draw();
			tick();
		};
		const exportCsv = () => Omni.util.download('time-entries.csv', Omni.csv.stringify([['project', 'start', 'end', 'minutes'], ...entries.map((e) => [e.project, new Date(e.start).toISOString(), new Date(e.end).toISOString(), ((e.end - e.start) / 60000).toFixed(1)])]), 'text/csv');
		root.appendChild(h('div', { class: 'stack-lg' },
			h('form', { class: 'panel stack', onsubmit: toggle }, h('div', { class: 'row', style: { alignItems: 'flex-end' } }, h('div', { class: 'field', style: { flex: '1' } }, h('label', { for: 'tt-project' }, 'Working on'), project, datalist), startBtn), live),
			h('section', { class: 'panel stack', 'aria-label': 'Totals' }, totals),
			h('section', { class: 'panel stack', 'aria-label': 'Entries' }, h('div', { class: 'row between' }, h('h2', null, 'Entries'), h('button', { type: 'button', class: 'btn btn-small', onclick: exportCsv }, icon('download'), 'CSV')), log),
		));
		draw();
		tick();
		const timer = setInterval(() => {
			tick();
			if (running) draw();
		}, 1000);
		return () => clearInterval(timer);
	},
});
