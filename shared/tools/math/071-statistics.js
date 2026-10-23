// No. 071 Statistics calculator: descriptive statistics and a histogram for a list of numbers.
Omni.register({
	no: 71,
	id: 'statistics',
	name: 'Statistics calculator',
	category: 'math',
	keywords: ['statistics', 'mean', 'median', 'mode', 'standard deviation', 'variance', 'quartile', 'average'],
	description: 'Mean, median, mode, spread, quartiles, skewness and a histogram for numbers separated by spaces, commas or lines.',
	live: true,
	inputs: [
		{ name: 'data', label: 'Numbers', type: 'textarea', rows: 6, mono: true, default: '12, 15, 15, 18, 21, 22, 22, 22, 25, 29, 31, 34, 40, 41, 58' },
		{ name: 'sample', label: 'Data is a sample (n - 1 in variance)', type: 'checkbox', default: true },
	],
	run({ data, sample }) {
		const xs = data.split(/[\s,;]+/).filter(Boolean).map((v) => {
			const n = Number(v);
			if (!Number.isFinite(n)) throw new Error(`"${v}" is not a number.`);
			return n;
		});
		if (!xs.length) return { note: 'Type some numbers.' };
		const n = xs.length;
		const s = xs.slice().sort((a, b) => a - b);
		const sum = xs.reduce((a, b) => a + b, 0);
		const mean = sum / n;
		// Quantiles by linear interpolation between closest ranks (the method spreadsheets use for QUARTILE.INC).
		const q = (p) => {
			const i = (n - 1) * p;
			const lo = Math.floor(i);
			return s[lo] + (s[Math.min(n - 1, lo + 1)] - s[lo]) * (i - lo);
		};
		const counts = new Map();
		xs.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
		const top = Math.max(...counts.values());
		const modes = top > 1 ? [...counts].filter(([, c]) => c === top).map(([v]) => v) : [];
		const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
		const variance = n > (sample ? 1 : 0) ? ss / (sample ? n - 1 : n) : 0;
		const sd = Math.sqrt(variance);
		const skew = sd ? xs.reduce((a, x) => a + ((x - mean) / sd) ** 3, 0) / n : 0;
		const f = (v) => Omni.math.format(v, 8);
		return {
			readings: [
				{ label: 'Count', value: n }, { label: 'Sum', value: f(sum) }, { label: 'Mean', value: f(mean) }, { label: 'Median', value: f(q(0.5)) },
				{ label: 'Mode', value: modes.length ? modes.map(f).join(', ') + ` (${top} times)` : 'none (no repeats)' },
				{ label: 'Minimum', value: f(s[0]) }, { label: 'Maximum', value: f(s[n - 1]) }, { label: 'Range', value: f(s[n - 1] - s[0]) },
				{ label: sample ? 'Sample variance' : 'Population variance', value: f(variance) }, { label: 'Standard deviation', value: f(sd) },
				{ label: 'Q1 (25%)', value: f(q(0.25)) }, { label: 'Q3 (75%)', value: f(q(0.75)) }, { label: 'Interquartile range', value: f(q(0.75) - q(0.25)) },
				{ label: 'Skewness', value: f(skew) }, { label: 'Standard error', value: f(sd / Math.sqrt(n)) },
			],
			blocks: n >= 5 ? [{ type: 'node', node: Omni.histogram(xs, 'Histogram') }] : [],
		};
	},
});
