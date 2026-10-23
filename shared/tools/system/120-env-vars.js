// No. 120 Environment variables (desktop): the variables OmniTool sees, with PATH split into entries.
Omni.register({
	no: 120,
	id: 'env-vars',
	name: 'Environment variables',
	category: 'system',
	editions: ['desktop'],
	keywords: ['environment', 'variables', 'env', 'path', 'system variables'],
	description: 'Searchable list of the environment variables OmniTool started with, and PATH split into its folders with missing ones marked.',
	ai: false,
	mount(root) {
		const { h } = Omni;
		const search = h('input', { type: 'search', placeholder: 'Search names and values', 'aria-label': 'Search variables' });
		const out = h('div', { class: 'stack' });
		let env = null;
		const draw = () => {
			const q = search.value.trim().toLowerCase();
			const rows = Object.entries(env.vars).filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q)).sort((a, b) => a[0].localeCompare(b[0]));
			out.replaceChildren(
				Omni.forms.block(`${rows.length} variables`, Omni.forms.table(['Name', 'Value'], rows)),
				Omni.forms.block('PATH entries in search order', Omni.forms.table(['#', 'Folder', 'Exists'], env.path.map((p, i) => [i + 1, p.dir, p.exists ? 'yes' : 'missing']), { numeric: [0] })),
			);
		};
		search.addEventListener('input', () => env && draw());
		root.appendChild(h('div', { class: 'panel stack' }, search, out, h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Values are read when OmniTool starts. Change them in Windows Settings, then restart OmniTool.')));
		Omni.native.sys.env().then((e) => {
			env = e;
			draw();
		}).catch((err) => out.replaceChildren(Omni.forms.stateBox('error', 'Could not read the environment.', err.message)));
	},
});
