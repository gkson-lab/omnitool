// No. 103 Clipboard history (desktop): text you copy anywhere on the PC, searchable, with pins.
Omni.register({
	no: 103,
	id: 'clipboard-history',
	name: 'Clipboard history',
	category: 'productivity',
	editions: ['desktop'],
	keywords: ['clipboard', 'history', 'copy', 'paste', 'pin'],
	description: 'Keeps the last 200 pieces of text you copied anywhere on this PC. Search, pin and copy them back. Copies that password managers mark as private are skipped.',
	ai: false,
	mount(root) {
		const { h, icon } = Omni;
		const cb = Omni.native.clipboard;
		const search = h('input', { type: 'search', placeholder: 'Search the history', 'aria-label': 'Search clipboard history' });
		const rec = h('input', { type: 'checkbox', id: 'clip-on', checked: cb.isRecording(), onchange: () => {
			cb.setRecording(rec.checked);
			draw();
		} });
		const list = h('ul', { class: 'list', 'aria-label': 'Clipboard history' });
		let items = [];
		const draw = async () => {
			items = await cb.history();
			const q = search.value.trim().toLowerCase();
			const shown = items.filter((x) => !q || x.text.toLowerCase().includes(q)).sort((a, b) => (b.pinned - a.pinned) || b.at - a.at);
			list.replaceChildren(...(shown.length ? shown.map((x) => h('li', null,
				h('div', { class: 'grow' }, h('div', { class: 'mono', style: { fontSize: '0.82rem', whiteSpace: 'pre-wrap', maxHeight: '6.5em', overflow: 'hidden' } }, x.text.length > 600 ? x.text.slice(0, 600) + '...' : x.text), h('span', { class: 'muted', style: { fontSize: '0.76rem' } }, `${new Date(x.at).toLocaleString()} · ${x.text.length} characters${x.pinned ? ' · pinned' : ''}`)),
				h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.util.copy(x.text) }, icon('copy'), 'Copy'),
				h('button', { type: 'button', class: 'icon-btn', 'aria-label': x.pinned ? 'Unpin' : 'Pin', 'aria-pressed': String(!!x.pinned), onclick: async () => ((await cb.pin(x.id, !x.pinned)), draw()) }, icon(x.pinned ? 'pinned' : 'pin')),
				h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Delete this entry', onclick: async () => ((await cb.remove(x.id)), draw()) }, icon('trash')),
			)) : [h('li', null, h('span', { class: 'muted' }, items.length ? 'Nothing matches.' : cb.isRecording() ? 'Copy some text anywhere and it appears here.' : 'Recording is off. Turn it on to keep a history.'))]));
		};
		search.addEventListener('input', draw);
		root.appendChild(h('div', { class: 'panel stack' },
			h('div', { class: 'row between' }, h('div', { class: 'field check' }, rec, h('label', { for: 'clip-on' }, 'Record clipboard history')), h('button', { type: 'button', class: 'btn btn-small', onclick: async () => {
				if (await Omni.ui.confirm({ title: 'Clear the clipboard history?', body: 'Unpinned entries are deleted. Pinned ones stay.', confirmLabel: 'Clear history' })) {
					await cb.clear();
					draw();
				}
			} }, 'Clear unpinned')),
			search,
			list,
			h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Stored in desktop\\data\\clipboard.json on this PC only. Text only; images are not kept.'),
		));
		draw();
		return cb.onChange(draw);
	},
});
