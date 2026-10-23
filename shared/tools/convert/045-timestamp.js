// No. 045 Timestamp converter: Unix seconds or milliseconds to dates, and dates back to timestamps.
Omni.register({
	no: 45,
	id: 'timestamp',
	name: 'Timestamp converter',
	category: 'convert',
	keywords: ['timestamp', 'unix', 'epoch', 'date', 'iso', 'time', 'utc'],
	description: 'Converts Unix timestamps (seconds or milliseconds) to ISO, local and relative time, and dates back to timestamps. "now" works too.',
	live: true,
	inputs: [{ name: 'input', label: 'Timestamp or date', type: 'text', mono: true, default: 'now', hint: 'For example 1767225600, 1767225600000, 2026-10-21T18:00:00Z, or now' }],
	run({ input }) {
		const raw = String(input).trim();
		let d;
		let unit = '';
		if (!raw || raw.toLowerCase() === 'now') d = new Date();
		else if (/^-?\d+(\.\d+)?$/.test(raw)) {
			const n = Number(raw);
			// 12+ digits is milliseconds (anything after 1973 in ms); fewer is seconds.
			unit = Math.abs(n) >= 1e11 ? 'milliseconds' : 'seconds';
			d = new Date(unit === 'seconds' ? n * 1000 : n);
		} else d = new Date(raw);
		if (Number.isNaN(d.getTime())) throw new Error('Not a timestamp or a date this converter understands. Try ISO format: 2026-10-21T18:00:00Z');
		const ms = d.getTime();
		const diff = ms - Date.now();
		const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
		const steps = [['year', 31557600000], ['month', 2629800000], ['week', 604800000], ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000]];
		const [u, size] = steps.find(([, s]) => Math.abs(diff) >= s) || ['second', 1000];
		return {
			readings: [
				{ label: 'Unix seconds', value: Math.floor(ms / 1000) },
				{ label: 'Unix milliseconds', value: ms },
				{ label: 'ISO 8601 (UTC)', value: d.toISOString() },
				{ label: 'Local time', value: d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }) },
				{ label: 'RFC 2822', value: d.toUTCString() },
				{ label: 'Relative', value: rtf.format(Math.round(diff / size), u), copy: false },
				{ label: 'Day of year', value: Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000), copy: false },
				{ label: 'ISO week', value: (() => {
					const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
					t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
					return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
				})(), copy: false },
			],
			note: unit ? `Read the input as ${unit}.` : null,
		};
	},
});
