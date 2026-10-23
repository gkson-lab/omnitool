// No. 104 Calendar: a month view with events stored on this device and .ics export for other calendar apps.
Omni.register({
	no: 104,
	id: 'calendar',
	name: 'Calendar',
	category: 'productivity',
	keywords: ['calendar', 'events', 'month', 'schedule', 'agenda', 'ics', 'date'],
	description: 'A month calendar for your own events, kept on this device. Export them as an .ics file for Outlook, Google or Apple Calendar.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let events = ctx.store.get('events', []);
		const pad = (n) => String(n).padStart(2, '0');
		const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		let selected = iso(new Date());
		let view = new Date();
		view.setDate(1);
		const title = h('h2');
		const grid = h('div', { role: 'grid', 'aria-label': 'Month', style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' } });
		const dayList = h('div', { class: 'stack' });
		const evTitle = h('input', { type: 'text', id: 'ev-title', placeholder: 'What' });
		const evTime = h('input', { type: 'time', id: 'ev-time' });
		const evNote = h('input', { type: 'text', id: 'ev-note', placeholder: 'Optional note' });
		// The week starts on the locale's first day (Monday in most places, Sunday in the US); getWeekInfo replaced weekInfo.
		const locale = new Intl.Locale(navigator.language);
		const weekInfo = locale.getWeekInfo ? locale.getWeekInfo() : locale.weekInfo;
		const firstDay = weekInfo ? weekInfo.firstDay % 7 : 1;
		const save = () => ctx.store.set('events', events);

		function drawGrid() {
			title.textContent = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
			const start = new Date(view);
			start.setDate(1 - ((view.getDay() - firstDay + 7) % 7));
			const names = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + ((firstDay + i) % 7)).toLocaleDateString(undefined, { weekday: 'short' }));
			const cells = names.map((n) => h('div', { role: 'columnheader', class: 'muted', style: { fontSize: '0.78rem', textAlign: 'center' } }, n));
			const todayIso = iso(new Date());
			for (let i = 0; i < 42; i++) {
				const d = new Date(start);
				d.setDate(start.getDate() + i);
				const key = iso(d);
				const count = events.filter((e) => e.date === key).length;
				const inMonth = d.getMonth() === view.getMonth();
				cells.push(h('button', {
					type: 'button',
					role: 'gridcell',
					'aria-selected': String(key === selected),
					'aria-label': `${d.toLocaleDateString(undefined, { dateStyle: 'full' })}${count ? `, ${count} events` : ''}`,
					'data-date': key,
					tabindex: key === selected ? '0' : '-1',
					class: 'btn',
					style: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: '58px', padding: '4px 6px', color: inMonth ? 'var(--ink)' : 'var(--muted)', background: key === selected ? 'var(--sunken)' : '', borderColor: key === todayIso ? 'var(--ink)' : key === selected ? 'var(--edge)' : 'var(--line)', fontWeight: key === todayIso ? 700 : 500 },
					onclick: () => select(key),
					onkeydown: (e) => {
						const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
						if (!step) return;
						e.preventDefault();
						const n = new Date(key + 'T12:00');
						n.setDate(n.getDate() + step);
						if (n.getMonth() !== view.getMonth()) view = new Date(n.getFullYear(), n.getMonth(), 1);
						select(iso(n), true);
					},
				}, String(d.getDate()), count ? h('span', { class: 'chip', style: { marginTop: 'auto', fontSize: '0.68rem' } }, `${count}`) : null));
			}
			grid.replaceChildren(...cells);
		}
		function drawDay() {
			const list = events.filter((e) => e.date === selected).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
			dayList.replaceChildren(
				h('h3', null, new Date(selected + 'T12:00').toLocaleDateString(undefined, { dateStyle: 'full' })),
				list.length ? h('ul', { class: 'list' }, list.map((e) => h('li', null, h('div', { class: 'grow' }, h('strong', null, `${e.time ? e.time + ' ' : ''}${e.title}`), e.note ? h('div', { class: 'muted', style: { fontSize: '0.84rem' } }, e.note) : null), h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${e.title}`, onclick: () => ((events = events.filter((x) => x.id !== e.id)), save(), drawGrid(), drawDay()) }, icon('trash'))))) : h('p', { class: 'muted' }, 'No events this day.'),
			);
		}
		function select(key, focus) {
			selected = key;
			drawGrid();
			drawDay();
			if (focus) grid.querySelector(`[data-date="${key}"]`).focus();
		}
		const add = (e) => {
			e.preventDefault();
			if (!evTitle.value.trim()) return evTitle.focus();
			events.push({ id: Math.random().toString(36).slice(2, 10), date: selected, time: evTime.value || null, title: evTitle.value.trim(), note: evNote.value.trim() });
			save();
			evTitle.value = '';
			evNote.value = '';
			drawGrid();
			drawDay();
		};
		const exportIcs = () => {
			if (!events.length) return Omni.ui.toast('No events to export yet.');
			const esc = (s) => String(s).replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
			const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
			const body = events.map((e) => {
				const d = e.date.replace(/-/g, '');
				const when = e.time ? `DTSTART:${d}T${e.time.replace(':', '')}00\r\nDURATION:PT1H` : `DTSTART;VALUE=DATE:${d}`;
				return `BEGIN:VEVENT\r\nUID:${e.id}@omnitool\r\nDTSTAMP:${stamp}\r\n${when}\r\nSUMMARY:${esc(e.title)}${e.note ? `\r\nDESCRIPTION:${esc(e.note)}` : ''}\r\nEND:VEVENT`;
			}).join('\r\n');
			Omni.util.download('omnitool-calendar.ics', `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//gklabs//OmniTool//EN\r\n${body}\r\nEND:VCALENDAR\r\n`, 'text/calendar');
		};
		const nav = (d) => {
			view = new Date(view.getFullYear(), view.getMonth() + d, 1);
			drawGrid();
		};
		root.appendChild(h('div', { class: 'io aside-right' },
			h('div', { class: 'panel stack' }, h('div', { class: 'row between' }, title, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => nav(-1) }, 'Previous'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => ((view = new Date()), view.setDate(1), select(iso(new Date()))) }, 'Today'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => nav(1) }, 'Next'))), grid, h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Arrow keys move between days.')),
			h('div', { class: 'panel stack' }, dayList, h('form', { class: 'stack', onsubmit: add }, h('h3', null, 'Add to this day'), h('div', { class: 'field' }, h('label', { for: 'ev-title' }, 'Title'), evTitle), h('div', { class: 'field' }, h('label', { for: 'ev-time' }, 'Time (optional)'), evTime), h('div', { class: 'field' }, h('label', { for: 'ev-note' }, 'Note'), evNote), h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add event'), h('button', { type: 'button', class: 'btn', onclick: exportIcs }, 'Export .ics')))),
		));
		select(selected);
	},
});
