// No. 046 Time zone converter: a date and time in one IANA zone shown in others.
(function () {
	'use strict';
	const zones = () => (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney']);
	const local = Intl.DateTimeFormat().resolvedOptions().timeZone;

	/** UTC milliseconds for a wall-clock time in a zone (two passes handle DST edges). */
	function zonedToUtc(dateStr, timeStr, zone) {
		const [y, mo, d] = dateStr.split('-').map(Number);
		const [hh, mm] = timeStr.split(':').map(Number);
		const target = Date.UTC(y, mo - 1, d, hh, mm);
		let guess = target;
		for (let i = 0; i < 2; i++) {
			const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
			const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
			guess += target - shown;
		}
		return guess;
	}

	function offset(ms, zone) {
		const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName');
		return name ? name.value.replace('GMT', 'UTC') : '';
	}

	Omni.tz = { zones, zonedToUtc, offset, local };

	Omni.register({
		no: 46,
		id: 'timezone',
		name: 'Time zone converter',
		category: 'convert',
		keywords: ['timezone', 'time zone', 'convert time', 'utc', 'meeting', 'world time'],
		description: 'Shows a date and time from one time zone in the others you list, with UTC offsets and daylight saving handled.',
		live: true,
		inputs: [
			{ name: 'date', label: 'Date', type: 'date', default: () => new Date().toISOString().slice(0, 10) },
			{ name: 'time', label: 'Time', type: 'time', default: '09:00' },
			{ name: 'zone', label: 'In time zone', type: 'select', options: () => zones(), default: local },
			{ name: 'targets', label: 'Show in (one zone per line)', type: 'textarea', rows: 5, mono: true, default: 'UTC\nAmerica/New_York\nEurope/London\nAsia/Tokyo\nAustralia/Sydney' },
		],
		run({ date, time, zone, targets }) {
			if (!date || !time) return { note: 'Pick a date and time.' };
			const all = zones();
			const utc = zonedToUtc(date, time, zone);
			const rows = targets.split('\n').map((z) => z.trim()).filter(Boolean).map((z) => {
				if (!all.includes(z) && z !== 'UTC') return [z, 'Unknown zone name', ''];
				const f = new Intl.DateTimeFormat(undefined, { timeZone: z, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(utc));
				return [z, f, offset(utc, z)];
			});
			return {
				readings: [{ label: `${zone} (${offset(utc, zone)})`, value: `${date} ${time}`, copy: false }, { label: 'UTC', value: new Date(utc).toISOString() }],
				table: { label: 'Same moment elsewhere', columns: ['Zone', 'Local time', 'Offset'], rows },
			};
		},
	});
})();
