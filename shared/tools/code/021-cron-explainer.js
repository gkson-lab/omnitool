// No. 021 Cron explainer: describes a 5-field cron expression and lists its next run times in local time.
(function () {
	'use strict';
	const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
	const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const MACROS = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
	const FIELDS = [
		{ name: 'minute', min: 0, max: 59 },
		{ name: 'hour', min: 0, max: 23 },
		{ name: 'day of month', min: 1, max: 31 },
		{ name: 'month', min: 1, max: 12, names: MONTHS, offset: 1 },
		{ name: 'day of week', min: 0, max: 7, names: DAYS, offset: 0 },
	];

	function parseField(raw, f) {
		const set = new Set();
		for (const part of raw.toLowerCase().split(',')) {
			const m = part.match(/^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/);
			if (!m) throw new Error(`"${part}" is not valid in the ${f.name} field`);
			const step = m[2] ? Number(m[2]) : 1;
			if (step < 1) throw new Error(`Step must be at least 1 in the ${f.name} field`);
			const val = (s) => {
				if (f.names && f.names.includes(s)) return f.names.indexOf(s) + f.offset;
				const n = Number(s);
				if (!Number.isInteger(n) || n < f.min || n > f.max) throw new Error(`${s} is out of range for ${f.name} (${f.min} to ${f.max})`);
				return n;
			};
			let lo = f.min;
			let hi = f.max;
			if (m[1] !== '*') {
				const [a, b] = m[1].split('-');
				lo = val(a);
				hi = b !== undefined ? val(b) : m[2] ? f.max : lo;
			}
			for (let v = lo; v <= hi; v += step) set.add(f.name === 'day of week' && v === 7 ? 0 : v);
		}
		return set;
	}

	function parse(expr) {
		const src = MACROS[expr.trim().toLowerCase()] || expr.trim();
		const parts = src.split(/\s+/);
		if (parts.length !== 5) throw new Error(`Cron needs 5 fields (minute hour day month weekday); this has ${parts.length}`);
		return { raw: parts, sets: parts.map((p, i) => parseField(p, FIELDS[i])) };
	}

	function list(set, fmt) {
		const v = [...set].sort((a, b) => a - b);
		return v.length > 6 ? `${v.slice(0, 5).map(fmt).join(', ')} and ${v.length - 5} more` : v.map(fmt).join(', ').replace(/, ([^,]*)$/, ' and $1');
	}

	function describe({ raw, sets }) {
		const [mi, hr, dom, mon, dow] = raw;
		const pad = (n) => String(n).padStart(2, '0');
		let time;
		if (mi === '*' && hr === '*') time = 'every minute';
		else if (/^\*\/\d+$/.test(mi) && hr === '*') time = `every ${mi.slice(2)} minutes`;
		else if (hr === '*') time = `at minute ${list(sets[0], String)} of every hour`;
		else if (sets[0].size === 1 && sets[1].size <= 6) time = `at ${list(sets[1], (h) => `${pad(h)}:${pad([...sets[0]][0])}`)}`;
		else time = `at minute ${list(sets[0], String)} past hour ${list(sets[1], String)}`;
		const days = [];
		if (dom !== '*') days.push(`on day ${list(sets[2], String)} of the month`);
		if (dow !== '*') days.push(`on ${list(sets[4], (d) => DAY_NAMES[d])}`);
		const dayText = days.length === 2 ? `${days[0]} or ${days[1]}` : days[0] || 'every day';
		const monthText = mon === '*' ? '' : ` in ${list(sets[3], (m) => MONTH_NAMES[m - 1])}`;
		const s = `${time}, ${dayText}${monthText}.`;
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	/** Next run times. Standard cron: if both day fields are restricted, either one matching is enough. */
	function next(parsed, count, from) {
		const [mi, hr, dom, mon, dow] = parsed.sets;
		const domAny = parsed.raw[2] === '*';
		const dowAny = parsed.raw[4] === '*';
		const out = [];
		const d = new Date(from.getTime());
		d.setSeconds(0, 0);
		d.setMinutes(d.getMinutes() + 1);
		const limit = from.getTime() + 5 * 366 * 86400000;
		while (out.length < count && d.getTime() < limit) {
			if (!mon.has(d.getMonth() + 1)) {
				d.setMonth(d.getMonth() + 1, 1);
				d.setHours(0, 0);
				continue;
			}
			const dayOk = domAny && dowAny ? true : domAny ? dow.has(d.getDay()) : dowAny ? dom.has(d.getDate()) : dom.has(d.getDate()) || dow.has(d.getDay());
			if (!dayOk) {
				d.setDate(d.getDate() + 1);
				d.setHours(0, 0);
				continue;
			}
			if (!hr.has(d.getHours())) {
				d.setHours(d.getHours() + 1, 0);
				continue;
			}
			if (!mi.has(d.getMinutes())) {
				d.setMinutes(d.getMinutes() + 1);
				continue;
			}
			out.push(new Date(d.getTime()));
			d.setMinutes(d.getMinutes() + 1);
		}
		return out;
	}

	Omni.register({
		no: 21,
		id: 'cron-explainer',
		name: 'Cron explainer',
		category: 'code',
		keywords: ['cron', 'crontab', 'schedule', 'next run'],
		description: 'Explains a cron expression in plain English and lists the next times it runs, in your time zone.',
		live: true,
		inputs: [
			{ name: 'expr', label: 'Cron expression', type: 'text', mono: true, default: '*/15 9-17 * * mon-fri', hint: 'minute hour day-of-month month day-of-week, or @daily, @hourly, @weekly' },
			{ name: 'count', label: 'Next runs to list', type: 'number', min: 1, max: 50, default: 8 },
		],
		run({ expr, count }) {
			const parsed = parse(expr);
			const runs = next(parsed, Math.min(50, count || 8), new Date());
			return {
				text: describe(parsed),
				label: 'In plain English',
				table: { label: `Next ${runs.length} runs (${Intl.DateTimeFormat().resolvedOptions().timeZone})`, columns: ['#', 'When'], rows: runs.map((r, i) => [i + 1, r.toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })]) },
			};
		},
	});
})();
