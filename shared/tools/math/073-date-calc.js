// No. 073 Date calculator: the gap between two dates (including business days) and date arithmetic.
Omni.register({
	no: 73,
	id: 'date-calc',
	name: 'Date calculator',
	category: 'math',
	keywords: ['date', 'days between', 'business days', 'add days', 'deadline', 'age', 'calendar'],
	description: 'Days, weeks and months between two dates (including business days), or a date plus or minus days, weeks, months or business days.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Calculate', type: 'seg', options: [{ value: 'diff', label: 'Time between dates' }, { value: 'add', label: 'Add or subtract' }], default: 'diff' },
		{ name: 'start', label: 'Start date', type: 'date', default: () => new Date().toISOString().slice(0, 10) },
		{ name: 'end', label: 'End date', type: 'date', default: () => new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), when: (v) => v.mode === 'diff' },
		{ name: 'amount', label: 'Amount (negative subtracts)', type: 'number', default: 30, when: (v) => v.mode === 'add' },
		{ name: 'unit', label: 'Unit', type: 'select', options: [{ value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }, { value: 'months', label: 'Months' }, { value: 'years', label: 'Years' }, { value: 'business', label: 'Business days (Mon to Fri)' }], default: 'days', when: (v) => v.mode === 'add' },
	],
	run({ mode, start, end, amount, unit }) {
		const parse = (s) => {
			const [y, m, d] = String(s).split('-').map(Number);
			if (!y || !m || !d) throw new Error('Pick a date.');
			return new Date(Date.UTC(y, m - 1, d));
		};
		const iso = (d) => d.toISOString().slice(0, 10);
		const long = (d) => d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
		const a = parse(start);
		if (mode === 'diff') {
			const b = parse(end);
			const [lo, hi] = a <= b ? [a, b] : [b, a];
			const days = Math.round((hi - lo) / 86400000);
			let y = hi.getUTCFullYear() - lo.getUTCFullYear();
			let mo = hi.getUTCMonth() - lo.getUTCMonth();
			let d = hi.getUTCDate() - lo.getUTCDate();
			if (d < 0) {
				mo--;
				d += new Date(Date.UTC(hi.getUTCFullYear(), hi.getUTCMonth(), 0)).getUTCDate();
			}
			if (mo < 0) {
				y--;
				mo += 12;
			}
			let business = 0;
			for (let t = lo.getTime(); t < hi.getTime(); t += 86400000) {
				const wd = new Date(t).getUTCDay();
				if (wd !== 0 && wd !== 6) business++;
			}
			return {
				text: `${Omni.util.fmt.plural(days, 'day')}${a > b ? ' (end is before start)' : ''}`,
				big: true,
				label: `${long(a)} to ${long(b)}`,
				readings: [{ label: 'Years, months, days', value: `${y} y, ${mo} m, ${d} d`, copy: false }, { label: 'Weeks', value: `${Math.floor(days / 7)} weeks and ${days % 7} days`, copy: false }, { label: 'Business days (Mon to Fri, end excluded)', value: business }, { label: 'Hours', value: (days * 24).toLocaleString() }],
			};
		}
		const n = Math.trunc(amount || 0);
		const r = new Date(a.getTime());
		if (unit === 'days') r.setUTCDate(r.getUTCDate() + n);
		else if (unit === 'weeks') r.setUTCDate(r.getUTCDate() + n * 7);
		else if (unit === 'months' || unit === 'years') {
			const day = r.getUTCDate();
			r.setUTCDate(1);
			r.setUTCMonth(r.getUTCMonth() + (unit === 'years' ? n * 12 : n));
			// Jan 31 plus one month is Feb 28/29, not March 3.
			r.setUTCDate(Math.min(day, new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate()));
		} else {
			let left = Math.abs(n);
			while (left > 0) {
				r.setUTCDate(r.getUTCDate() + Math.sign(n));
				const wd = r.getUTCDay();
				if (wd !== 0 && wd !== 6) left--;
			}
		}
		return { text: iso(r), big: true, label: long(r) };
	},
});
