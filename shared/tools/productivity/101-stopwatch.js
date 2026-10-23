// No. 101 Stopwatch with laps. Runs on stored timestamps, so it keeps counting while you use other tools.
Omni.register({
	no: 101,
	id: 'stopwatch',
	name: 'Stopwatch',
	category: 'productivity',
	keywords: ['stopwatch', 'timer', 'lap', 'split', 'time'],
	description: 'A stopwatch with laps and split times, accurate to the hundredth of a second. Space starts and stops, L records a lap.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		let st = ctx.store.get('state', { running: false, startAt: 0, elapsed: 0, laps: [] });
		const save = () => ctx.store.set('state', st);
		const now = () => (st.running ? st.elapsed + Date.now() - st.startAt : st.elapsed);
		const fmt = (ms) => {
			const cs = Math.floor((ms % 1000) / 10);
			return `${Omni.util.fmt.duration(ms)}.${String(cs).padStart(2, '0')}`;
		};
		const clock = h('div', { class: 'readout big', role: 'timer', style: { fontSize: 'clamp(2.6rem, 2rem + 5vw, 5rem)', textAlign: 'center', fontStretch: '100%' } });
		const startBtn = h('button', { type: 'button', class: 'btn btn-primary' });
		const lapBtn = h('button', { type: 'button', class: 'btn' }, 'Lap');
		const laps = h('div');
		const toggle = () => {
			if (st.running) {
				st.elapsed = now();
				st.running = false;
			} else {
				st.startAt = Date.now();
				st.running = true;
			}
			save();
			draw();
		};
		const lap = () => {
			if (!st.running) return;
			st.laps.push(now());
			save();
			draw();
		};
		const reset = () => {
			st = { running: false, startAt: 0, elapsed: 0, laps: [] };
			save();
			draw();
		};
		function draw() {
			clock.textContent = fmt(now());
			startBtn.textContent = st.running ? 'Stop' : now() ? 'Resume' : 'Start';
			lapBtn.disabled = !st.running;
			if (laps.childElementCount !== (st.laps.length ? 1 : 0) || laps.dataset.n !== String(st.laps.length)) {
				laps.dataset.n = st.laps.length;
				const times = st.laps.map((t, i) => t - (st.laps[i - 1] || 0));
				const best = Math.min(...times);
				const worst = Math.max(...times);
				laps.replaceChildren(st.laps.length ? Omni.forms.table(['Lap', 'Lap time', 'Total'], st.laps.map((t, i) => [`${i + 1}${times.length > 2 && times[i] === best ? ' (fastest)' : times.length > 2 && times[i] === worst ? ' (slowest)' : ''}`, fmt(times[i]), fmt(t)]).reverse(), { numeric: [1, 2] }) : Omni.forms.stateBox('empty', null, 'Press Lap while it runs to record split times.'));
			}
		}
		startBtn.onclick = toggle;
		lapBtn.onclick = lap;
		const onKey = (e) => {
			// Space on a focused button or link should press that control, not start or stop the clock.
			if (!(e.target instanceof Element) || e.target.closest('input, textarea, select, button, a, [contenteditable], .agent')) return;
			if (e.key === ' ') {
				e.preventDefault();
				toggle();
			} else if (e.key.toLowerCase() === 'l') lap();
		};
		document.addEventListener('keydown', onKey);
		root.appendChild(h('div', { class: 'io split' }, h('div', { class: 'panel stack' }, clock, h('div', { class: 'row', style: { justifyContent: 'center' } }, startBtn, lapBtn, h('button', { type: 'button', class: 'btn', onclick: reset }, 'Reset'))), h('section', { class: 'panel stack', 'aria-label': 'Laps' }, h('h2', null, 'Laps'), laps)));
		draw();
		const tick = setInterval(() => (clock.textContent = fmt(now())), 47);
		return () => {
			clearInterval(tick);
			document.removeEventListener('keydown', onKey);
		};
	},
});
