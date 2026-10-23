// No. 118 Disk usage (desktop): free and total space of each drive, on the gklabs scale.
Omni.register({
	no: 118,
	id: 'disk-usage',
	name: 'Disk usage',
	category: 'system',
	editions: ['desktop'],
	keywords: ['disk', 'drive', 'storage', 'free space', 'ssd', 'capacity'],
	description: 'Free, used and total space for every drive on this PC.',
	async run() {
		const drives = await Omni.native.sys.disks();
		if (!drives.length) return { note: 'No drives were readable.' };
		const f = Omni.util.fmt.bytes;
		return { blocks: [...drives.map((d) => ({ type: 'meter', value: d.total ? (d.total - d.free) / d.total : 0, label: `${d.mount} used`, text: `${f(d.total - d.free)} of ${f(d.total)}, ${f(d.free)} free` })), { type: 'table', label: 'Drives', columns: ['Drive', 'Total', 'Used', 'Free', 'Used %'], rows: drives.map((d) => [d.mount, f(d.total), f(d.total - d.free), f(d.free), d.total ? `${Math.round(((d.total - d.free) / d.total) * 100)}%` : '-']), numeric: [1, 2, 3, 4] }] };
	},
	mount(root) {
		const { h } = Omni;
		const out = h('div', { class: 'stack', 'aria-live': 'polite' });
		const load = async () => {
			try {
				Omni.forms.renderOutput(await Omni.byId['disk-usage'].run({}), out);
			} catch (err) {
				out.replaceChildren(Omni.forms.stateBox('error', 'Could not read the drives.', err.message));
			}
		};
		root.appendChild(h('div', { class: 'panel stack' }, h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn btn-small', onclick: load }, 'Refresh')), out));
		load();
	},
});
