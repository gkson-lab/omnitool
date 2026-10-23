// No. 074 Time duration calculator: add and subtract hh:mm:ss durations line by line.
Omni.register({
	no: 74,
	id: 'duration',
	name: 'Time duration calculator',
	category: 'math',
	keywords: ['duration', 'time', 'hours', 'minutes', 'add time', 'timesheet', 'hh:mm'],
	description: 'Adds and subtracts durations like 1:45, 2h 30m or -0:15:30, one per line, and shows the total several ways.',
	live: true,
	inputs: [{ name: 'lines', label: 'Durations, one per line (start a line with - to subtract)', type: 'textarea', rows: 8, mono: true, default: '1:45\n2h 30m\n0:20:15\n-15m\n45s' }],
	run({ lines }) {
		const parseOne = (raw) => {
			const s = raw.trim();
			const neg = s.startsWith('-');
			const body = s.replace(/^[-+]\s*/, '');
			let secs;
			if (/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(body)) {
				const p = body.split(':').map(Number);
				secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 3600 + p[1] * 60;
			} else {
				const units = [...body.matchAll(/(\d+(?:\.\d+)?)\s*(d|days?|h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)\b/gi)];
				if (!units.length || units.map((u) => u[0]).join('').replace(/\s/g, '') !== body.replace(/\s/g, '')) throw new Error(`Cannot read "${s}". Use 1:30, 1:30:15 or 1h 30m 15s.`);
				secs = units.reduce((t, [, v, u]) => t + Number(v) * { d: 86400, h: 3600, m: 60, s: 1 }[u[0].toLowerCase()], 0);
			}
			return neg ? -secs : secs;
		};
		const items = lines.split('\n').map((l) => l.trim()).filter(Boolean);
		if (!items.length) return { note: 'Type some durations.' };
		const total = items.reduce((t, l) => t + parseOne(l), 0);
		const a = Math.abs(total);
		const hms = `${total < 0 ? '-' : ''}${Math.floor(a / 3600)}:${String(Math.floor((a % 3600) / 60)).padStart(2, '0')}:${String(Math.round(a % 60)).padStart(2, '0')}`;
		return {
			text: hms,
			big: true,
			label: `Total of ${items.length} durations`,
			readings: [{ label: 'Days, hours, minutes', value: `${Math.floor(a / 86400)} d ${Math.floor((a % 86400) / 3600)} h ${Math.floor((a % 3600) / 60)} m` }, { label: 'Decimal hours', value: (total / 3600).toFixed(4) }, { label: 'Minutes', value: (total / 60).toFixed(2) }, { label: 'Seconds', value: Math.round(total) }],
		};
	},
});
