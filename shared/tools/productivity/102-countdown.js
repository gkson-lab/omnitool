// No. 102 Countdown timers: several named timers that ring even while you use other tools.
(function () {
	'use strict';
	const KEY = 'tool.countdown.timers';
	const load = () => Omni.store.get(KEY, []);
	const left = (t) => (t.running ? Math.max(0, t.endAt - Date.now()) : t.left);

	setInterval(() => {
		const timers = load();
		let changed = false;
		for (const t of timers) if (t.running && Date.now() >= t.endAt) {
			t.running = false;
			t.left = 0;
			t.rang = true;
			changed = true;
			Omni.alarm.notify('Timer done', `${t.name} (${Omni.util.fmt.duration(t.total)}) has finished.`);
			Omni.alarm.flash(`[data-timer="${t.id}"]`);
		}
		if (changed) {
			Omni.store.set(KEY, timers);
			Omni.emit('countdown');
		}
	}, 500);

	Omni.register({
		no: 102,
		id: 'countdown',
		name: 'Countdown timers',
		category: 'productivity',
		keywords: ['countdown', 'timer', 'alarm', 'kitchen timer', 'reminder'],
		description: 'Run several named countdowns at once. Each rings and notifies when it reaches zero, even if you are in another tool.',
		ai: false,
		mount(root) {
			const { h, icon } = Omni;
			const name = h('input', { type: 'text', id: 'cd-name', placeholder: 'For example: tea', value: '' });
			const dur = h('input', { type: 'text', id: 'cd-dur', class: 'code', value: '5:00', 'aria-describedby': 'cd-hint' });
			const list = h('ul', { class: 'list', 'aria-label': 'Timers' });
			const parse = (s) => {
				const p = s.trim().split(':').map(Number);
				if (p.some((x) => !Number.isFinite(x) || x < 0) || !p.length || p.length > 3) return 0;
				return (p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60) * 1000;
			};
			const update = (fn) => {
				const timers = load();
				fn(timers);
				Omni.store.set(KEY, timers);
				draw();
			};
			function draw() {
				const timers = load();
				list.replaceChildren(...(timers.length ? timers.map((t) => h('li', null,
					h('div', { class: 'grow' }, h('strong', null, t.name), h('div', { class: 'mono', style: { fontSize: '1.4rem' }, 'data-timer': t.id }, Omni.util.fmt.duration(left(t))), t.rang ? h('span', { class: 'chip' }, 'Finished') : null),
					h('button', { type: 'button', class: 'btn btn-small' + (t.running ? '' : ' btn-primary'), onclick: () => update((ts) => {
						const x = ts.find((y) => y.id === t.id);
						if (x.running) {
							x.left = Math.max(0, x.endAt - Date.now());
							x.running = false;
						} else {
							if (!x.left) x.left = x.total;
							x.endAt = Date.now() + x.left;
							x.running = true;
							x.rang = false;
							Omni.alarm.ask();
						}
					}) }, t.running ? 'Pause' : t.left && t.left < t.total ? 'Resume' : 'Start'),
					h('button', { type: 'button', class: 'btn btn-small', onclick: () => update((ts) => Object.assign(ts.find((y) => y.id === t.id), { running: false, left: t.total, rang: false })) }, 'Reset'),
					h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${t.name}`, onclick: () => update((ts) => ts.splice(ts.findIndex((y) => y.id === t.id), 1)) }, icon('trash')),
				)) : [h('li', null, h('span', { class: 'muted' }, 'No timers yet. Add one above.'))]));
			}
			const add = (e) => {
				e.preventDefault();
				const ms = parse(dur.value);
				if (!ms) {
					dur.setAttribute('aria-invalid', 'true');
					return Omni.ui.toast('Use minutes, mm:ss or h:mm:ss, for example 5, 4:30 or 1:00:00.', { error: true });
				}
				dur.removeAttribute('aria-invalid');
				update((ts) => ts.push({ id: Math.random().toString(36).slice(2, 10), name: name.value.trim() || `Timer ${ts.length + 1}`, total: ms, left: ms, running: true, endAt: Date.now() + ms }));
				Omni.alarm.ask();
				name.value = '';
			};
			root.appendChild(h('div', { class: 'stack-lg' },
				h('form', { class: 'panel', onsubmit: add }, h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'cd-name' }, 'Name'), name), h('div', { class: 'field' }, h('label', { for: 'cd-dur' }, 'Duration'), dur, h('span', { class: 'hint', id: 'cd-hint' }, 'Minutes, mm:ss or h:mm:ss')), h('div', { class: 'field' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add and start')))),
				h('section', { class: 'panel', 'aria-label': 'Timers' }, list),
			));
			draw();
			const tick = setInterval(() => {
				const timers = load();
				list.querySelectorAll('[data-timer]').forEach((el) => {
					const t = timers.find((x) => x.id === el.dataset.timer);
					if (t) el.textContent = Omni.util.fmt.duration(left(t));
				});
			}, 250);
			const off = Omni.on('countdown', draw);
			return () => {
				clearInterval(tick);
				off();
			};
		},
	});
})();
