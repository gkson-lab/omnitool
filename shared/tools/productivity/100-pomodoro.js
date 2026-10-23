// No. 100 Pomodoro timer. The timer runs on stored timestamps, so it keeps going while you use other tools.
(function () {
	'use strict';

	/** Short beep and a system notification (when allowed), shared by the timers. */
	Omni.alarm = {
		beep(times) {
			try {
				const ctx = new (window.AudioContext || window.webkitAudioContext)();
				for (let i = 0; i < (times || 3); i++) {
					const o = ctx.createOscillator();
					const g = ctx.createGain();
					o.frequency.value = 880;
					g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
					g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.35 + 0.02);
					g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.25);
					o.connect(g).connect(ctx.destination);
					o.start(ctx.currentTime + i * 0.35);
					o.stop(ctx.currentTime + i * 0.35 + 0.3);
				}
				setTimeout(() => ctx.close(), (times || 3) * 400 + 200);
			} catch {
				// Audio blocked until the page gets a click; the toast still shows.
			}
		},
		notify(title, body) {
			Omni.ui.toast(body, { title });
			try {
				if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
			} catch {
				// Some file:// contexts refuse notifications; the toast is enough.
			}
			Omni.alarm.beep();
		},
		ask() {
			if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
		},
	};

	const KEY = 'tool.pomodoro.state';
	const defaults = { work: 25, short: 5, long: 15, every: 4 };
	const fresh = () => ({ phase: 'work', endAt: 0, left: 0, running: false, done: 0 });
	const state = () => Omni.store.get(KEY, fresh());
	const settings = () => ({ ...defaults, ...Omni.store.get('tool.pomodoro.settings', {}) });
	const minutesFor = (phase) => settings()[phase === 'work' ? 'work' : phase === 'short' ? 'short' : 'long'];
	const todayKey = () => 'tool.pomodoro.day.' + new Date().toISOString().slice(0, 10);

	function advance(s) {
		if (s.phase === 'work') {
			s.done++;
			Omni.store.set(todayKey(), Omni.store.get(todayKey(), 0) + 1);
			s.phase = s.done % settings().every === 0 ? 'long' : 'short';
		} else s.phase = 'work';
		s.running = false;
		s.endAt = 0;
		s.left = minutesFor(s.phase) * 60000;
		return s;
	}

	// One app-wide ticker finishes a phase even when the Pomodoro page is closed.
	setInterval(() => {
		const s = state();
		if (s.running && s.endAt && Date.now() >= s.endAt) {
			const was = s.phase;
			Omni.store.set(KEY, advance(s));
			Omni.alarm.notify('Pomodoro', was === 'work' ? `Focus session done. Time for a ${s.phase === 'long' ? 'long' : 'short'} break.` : 'Break over. Ready for the next focus session.');
			Omni.emit('pomodoro');
		}
	}, 1000);

	Omni.register({
		no: 100,
		id: 'pomodoro',
		name: 'Pomodoro timer',
		category: 'productivity',
		keywords: ['pomodoro', 'focus', 'timer', 'break', 'productivity', 'work'],
		description: 'Focus sessions and breaks (25 / 5 / 15 minutes by default) with a notification at each change and a count of sessions today.',
		ai: false,
		mount(root) {
			const { h } = Omni;
			const clock = h('div', { class: 'readout big', role: 'timer', 'aria-live': 'off', style: { fontSize: 'clamp(3rem, 2rem + 6vw, 6rem)', textAlign: 'center', fontStretch: '100%' } });
			const phaseLabel = h('h2', { style: { textAlign: 'center' }, 'aria-live': 'polite' });
			const scaleBox = h('div');
			const startBtn = h('button', { type: 'button', class: 'btn btn-primary' });
			const today = h('p', { class: 'muted', style: { textAlign: 'center' } });
			const s0 = settings();
			const field = (id, label, value, min, max) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { type: 'number', id, min, max, value, onchange: (e) => {
				const next = { ...settings(), [id.replace('pomo-', '')]: Math.max(min, Math.min(max, Number(e.target.value) || value)) };
				Omni.store.set('tool.pomodoro.settings', next);
				const s = state();
				if (!s.running) {
					s.left = minutesFor(s.phase) * 60000;
					Omni.store.set(KEY, s);
				}
				draw();
			} }));
			function draw() {
				const s = state();
				const total = minutesFor(s.phase) * 60000;
				const left = s.running ? Math.max(0, s.endAt - Date.now()) : s.left || total;
				clock.textContent = Omni.util.fmt.duration(left);
				phaseLabel.textContent = { work: 'Focus', short: 'Short break', long: 'Long break' }[s.phase];
				startBtn.textContent = s.running ? 'Pause' : left < total ? 'Resume' : 'Start';
				scaleBox.replaceChildren(Omni.forms.meter(1 - left / total, 'Progress', `${Math.round((1 - left / total) * 100)}%`));
				today.textContent = `${Omni.store.get(todayKey(), 0)} focus sessions finished today.`;
				document.title = s.running ? `${Omni.util.fmt.duration(left)} ${phaseLabel.textContent} · OmniTool` : 'Pomodoro timer · OmniTool';
			}
			startBtn.onclick = () => {
				Omni.alarm.ask();
				const s = state();
				if (s.running) {
					s.left = Math.max(0, s.endAt - Date.now());
					s.running = false;
				} else {
					s.endAt = Date.now() + (s.left || minutesFor(s.phase) * 60000);
					s.running = true;
				}
				Omni.store.set(KEY, s);
				draw();
			};
			const reset = () => {
				const s = state();
				s.running = false;
				s.left = minutesFor(s.phase) * 60000;
				Omni.store.set(KEY, s);
				draw();
			};
			const skip = () => {
				Omni.store.set(KEY, advance(state()));
				draw();
			};
			root.appendChild(h('div', { class: 'io split' },
				h('div', { class: 'panel stack' }, phaseLabel, clock, scaleBox, h('div', { class: 'row', style: { justifyContent: 'center' } }, startBtn, h('button', { type: 'button', class: 'btn', onclick: reset }, 'Reset'), h('button', { type: 'button', class: 'btn', onclick: skip }, 'Skip to next')), today),
				h('div', { class: 'panel stack' }, h('h2', null, 'Lengths (minutes)'), h('div', { class: 'fields' }, field('pomo-work', 'Focus', s0.work, 1, 180), field('pomo-short', 'Short break', s0.short, 1, 60), field('pomo-long', 'Long break', s0.long, 1, 120), field('pomo-every', 'Long break after', s0.every, 2, 12)), h('p', { class: 'muted', style: { fontSize: '0.86rem' } }, 'The timer keeps running while you use other tools. Allow notifications when asked to get an alert outside OmniTool.')),
			));
			draw();
			const tick = setInterval(draw, 250);
			const off = Omni.on('pomodoro', draw);
			return () => {
				clearInterval(tick);
				off();
				document.title = 'OmniTool';
			};
		},
	});
})();
