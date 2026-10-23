// No. 117 Port checker (desktop): tries TCP connections to a host and reports which ports accept them.
Omni.register({
	no: 117,
	id: 'port-checker',
	name: 'Port checker',
	category: 'system',
	editions: ['desktop'],
	keywords: ['port', 'tcp', 'open', 'scan', 'firewall', 'listening', 'service'],
	description: 'Tests whether TCP ports on a host accept connections (up to 64 ports per check). Use it on machines you run or are allowed to test.',
	action: 'Check ports',
	inputs: [
		{ name: 'host', label: 'Host', type: 'text', default: 'localhost' },
		{ name: 'ports', label: 'Ports', type: 'text', mono: true, default: '22, 80, 443, 3000, 5432, 8080', hint: 'Commas and ranges, for example 80, 443, 8000-8010' },
		{ name: 'timeout', label: 'Timeout per port (ms)', type: 'number', min: 100, max: 10000, default: 1500 },
	],
	async run({ host, ports, timeout }) {
		const list = [];
		for (const part of String(ports).split(/[\s,]+/).filter(Boolean)) {
			const m = part.match(/^(\d+)(?:-(\d+))?$/);
			if (!m) throw new Error(`"${part}" is not a port or range.`);
			const a = Number(m[1]);
			const b = Number(m[2] || m[1]);
			if (a < 1 || b > 65535 || b < a) throw new Error(`"${part}" is outside 1 to 65535.`);
			for (let p = a; p <= b; p++) list.push(p);
		}
		if (!list.length) return { note: 'Enter some ports.' };
		if (list.length > 64) throw new Error('Check at most 64 ports at a time.');
		const names = { 21: 'FTP', 22: 'SSH', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB', 1433: 'SQL Server', 3000: 'dev server', 3306: 'MySQL', 3389: 'Remote Desktop', 5173: 'Vite', 5432: 'PostgreSQL', 6379: 'Redis', 8080: 'HTTP alt', 27017: 'MongoDB' };
		const results = await Omni.native.net.ports(String(host).trim(), list, timeout || 1500);
		const open = results.filter((r) => r.open).length;
		return { readings: [{ label: 'Open', value: open, copy: false }, { label: 'Closed or filtered', value: results.length - open, copy: false }], table: { columns: ['Port', 'Usually', 'State', 'Time'], rows: results.map((r) => [r.port, names[r.port] || '', r.open ? 'open' : r.error, `${r.ms} ms`]), numeric: [0, 3] } };
	},
});
