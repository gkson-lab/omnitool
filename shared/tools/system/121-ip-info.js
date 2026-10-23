// No. 121 IP and connection info: public IP (from ipify, on request), connection type and online state.
Omni.register({
	no: 121,
	id: 'ip-info',
	name: 'IP and connection info',
	category: 'system',
	keywords: ['ip', 'public ip', 'my ip', 'network', 'connection', 'online', 'bandwidth'],
	description: 'Shows your public IP address (fetched from api.ipify.org when you ask), your local addresses on desktop, and the browser\'s connection estimates.',
	action: 'Get my IP',
	inputs: [],
	async run() {
		const readings = [];
		try {
			const [v4, v6] = await Promise.allSettled([fetch('https://api.ipify.org?format=json').then((r) => r.json()), fetch('https://api64.ipify.org?format=json').then((r) => r.json())]);
			readings.push({ label: 'Public IPv4', value: v4.status === 'fulfilled' ? v4.value.ip : 'not available' });
			readings.push({ label: 'Public IP (IPv6 if you have it)', value: v6.status === 'fulfilled' ? v6.value.ip : 'not available' });
		} catch {
			readings.push({ label: 'Public IP', value: 'could not reach api.ipify.org', copy: false });
		}
		const c = navigator.connection || {};
		readings.push(
			{ label: 'Online', value: navigator.onLine ? 'yes' : 'no', copy: false },
			{ label: 'Connection type (browser estimate)', value: c.effectiveType || 'not reported', copy: false },
			{ label: 'Downlink estimate', value: c.downlink ? `${c.downlink} Mbit/s` : 'not reported', copy: false },
			{ label: 'Round-trip estimate', value: c.rtt != null ? `${c.rtt} ms` : 'not reported', copy: false },
			{ label: 'Data saver', value: c.saveData ? 'on' : 'off', copy: false },
		);
		const blocks = [];
		if (Omni.native) {
			const s = await Omni.native.sys.info();
			blocks.push({ type: 'table', label: 'Local addresses on this PC', columns: ['Interface', 'Address', 'Family'], rows: s.interfaces.filter((i) => !i.internal).map((i) => [i.name, i.address, i.family]) });
		}
		return { readings, blocks, note: 'The public IP comes from api.ipify.org, which sees your address when it answers. Nothing else is sent.' };
	},
});
