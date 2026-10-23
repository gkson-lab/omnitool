// No. 113 Process viewer (desktop): running processes with memory use; ending one asks first.
Omni.register({
	no: 113,
	id: 'processes',
	name: 'Process viewer',
	category: 'system',
	editions: ['desktop'],
	keywords: ['process', 'task manager', 'kill', 'pid', 'memory', 'running', 'tasklist'],
	description: 'Lists running processes with their memory use. Filter, sort, and end a process after confirming.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const filter = h('input', { type: 'search', placeholder: 'Filter by name or PID', 'aria-label': 'Filter processes' });
		const sortSel = h('select', { 'aria-label': 'Sort by' }, h('option', { value: 'mem' }, 'Memory, highest first'), h('option', { value: 'name' }, 'Name'), h('option', { value: 'pid' }, 'PID'));
		sortSel.value = ctx.store.get('sort', 'mem');
		const auto = h('input', { type: 'checkbox', id: 'proc-auto', checked: ctx.store.get('auto', true), onchange: () => ctx.store.set('auto', auto.checked) });
		const summary = h('p', { class: 'muted', role: 'status' });
		const out = h('div');
		let procs = [];
		const draw = () => {
			ctx.store.set('sort', sortSel.value);
			const q = filter.value.trim().toLowerCase();
			const shown = procs.filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.pid) === q);
			shown.sort(sortSel.value === 'name' ? (a, b) => a.name.localeCompare(b.name) : sortSel.value === 'pid' ? (a, b) => a.pid - b.pid : (a, b) => b.mem - a.mem);
			summary.textContent = `${procs.length} processes, ${Omni.util.fmt.bytes(procs.reduce((s, p) => s + p.mem, 0))} of memory in total. Showing ${Math.min(shown.length, 300)}.`;
			out.replaceChildren(Omni.forms.table(['Name', 'PID', 'Memory', ''], shown.slice(0, 300).map((p) => [p.name, p.pid, Omni.util.fmt.bytes(p.mem), h('button', { type: 'button', class: 'btn btn-small', onclick: () => end(p) }, 'End')]), { numeric: [1, 2] }));
		};
		const load = async () => {
			try {
				procs = await Omni.native.sys.processes();
				draw();
			} catch (err) {
				out.replaceChildren(Omni.forms.stateBox('error', 'Could not list processes.', err.message));
			}
		};
		const end = async (p) => {
			const ok = await Omni.ui.confirm({ title: `End ${p.name} (PID ${p.pid})?`, body: 'Unsaved work in that program is lost. Ending system processes can make Windows unstable.', confirmLabel: 'End process', focusCancel: true });
			if (!ok) return;
			try {
				await Omni.native.sys.kill(p.pid);
				Omni.ui.toast(`Ended ${p.name}.`);
			} catch (err) {
				Omni.ui.toast(err.message, { error: true, title: `Could not end ${p.name}.` });
			}
			load();
		};
		filter.addEventListener('input', draw);
		sortSel.addEventListener('change', draw);
		root.appendChild(h('div', { class: 'panel stack' }, h('div', { class: 'row' }, filter, sortSel, h('div', { class: 'field check' }, auto, h('label', { for: 'proc-auto' }, 'Refresh every 5 s')), h('button', { type: 'button', class: 'btn btn-small', onclick: load }, 'Refresh now')), summary, out));
		out.appendChild(Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, 'Reading the process list')));
		load();
		const t = setInterval(() => auto.checked && document.visibilityState === 'visible' && load(), 5000);
		return () => clearInterval(t);
	},
});
