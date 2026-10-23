// No. 112 System information (desktop): OS, CPU, memory, uptime, network interfaces and the signed-in user.
Omni.register({
	no: 112,
	id: 'system-info',
	name: 'System information',
	category: 'system',
	editions: ['desktop'],
	keywords: ['system', 'info', 'cpu', 'memory', 'ram', 'os', 'hostname', 'uptime', 'specs'],
	description: 'Operating system, processor, memory use, uptime and network interfaces of this PC.',
	async run() {
		const s = await Omni.native.sys.info();
		const used = s.memory.total - s.memory.free;
		return {
			meter: { value: used / s.memory.total, label: 'Memory in use', text: `${Omni.util.fmt.bytes(used)} of ${Omni.util.fmt.bytes(s.memory.total)}` },
			readings: [
				{ label: 'Operating system', value: `${s.os.name} ${s.os.release} (${s.os.arch})` },
				{ label: 'Computer name', value: s.hostname },
				{ label: 'User', value: s.user },
				{ label: 'Processor', value: s.cpu.model },
				{ label: 'Logical processors', value: s.cpu.cores, copy: false },
				{ label: 'Load (1 min average, Windows reports 0)', value: s.load.map((x) => x.toFixed(2)).join(' / '), copy: false },
				{ label: 'Uptime', value: `${Math.floor(s.uptime / 86400)} d ${Math.floor((s.uptime % 86400) / 3600)} h ${Math.floor((s.uptime % 3600) / 60)} m`, copy: false },
				{ label: 'OmniTool runtime', value: `Electron ${s.versions.electron}, Node ${s.versions.node}, Chromium ${s.versions.chrome}`, copy: false },
			],
			table: { label: 'Network interfaces', columns: ['Interface', 'Address', 'Family', 'MAC', 'Internal'], rows: s.interfaces.map((i) => [i.name, i.cidr || i.address, i.family, i.mac, i.internal ? 'yes' : 'no']) },
		};
	},
	mount(root) {
		const { h } = Omni;
		const out = h('div', { 'aria-live': 'polite' });
		const load = async () => {
			try {
				Omni.forms.renderOutput(await Omni.byId['system-info'].run({}), out);
			} catch (err) {
				out.replaceChildren(Omni.forms.stateBox('error', 'Could not read system information.', err.message));
			}
		};
		root.appendChild(h('div', { class: 'panel stack' }, h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn btn-small', onclick: load }, 'Refresh')), out));
		load();
		const t = setInterval(load, 5000);
		return () => clearInterval(t);
	},
});
