// No. 028 Random number generator: ranges, distributions, seeds, unique values and a histogram.
Omni.register({
	no: 28,
	id: 'random-number',
	name: 'Random number generator',
	category: 'generate',
	chance: true,
	keywords: ['random', 'number', 'rng', 'integer', 'seed', 'normal', 'gaussian', 'distribution'],
	description: 'Random integers or decimals from uniform, normal, exponential or Poisson distributions. Add a seed to get the same numbers again.',
	action: 'Generate',
	inputs: [
		{ name: 'distribution', label: 'Distribution', type: 'select', options: [{ value: 'uniform', label: 'Uniform (every value equally likely)' }, { value: 'normal', label: 'Normal (bell curve)' }, { value: 'exponential', label: 'Exponential' }, { value: 'poisson', label: 'Poisson (counts)' }], default: 'uniform' },
		{ name: 'min', label: 'Minimum', type: 'number', default: 1, when: (v) => v.distribution === 'uniform' },
		{ name: 'max', label: 'Maximum', type: 'number', default: 100, when: (v) => v.distribution === 'uniform' },
		{ name: 'mean', label: 'Mean', type: 'number', default: 50, when: (v) => v.distribution === 'normal' },
		{ name: 'sd', label: 'Standard deviation', type: 'number', default: 10, min: 0, when: (v) => v.distribution === 'normal' },
		{ name: 'rate', label: 'Rate (events per unit)', type: 'number', default: 1, min: 0, step: 'any', when: (v) => v.distribution === 'exponential' },
		{ name: 'lambda', label: 'Average count (lambda)', type: 'number', default: 4, min: 0, step: 'any', when: (v) => v.distribution === 'poisson' },
		{ name: 'count', label: 'How many', type: 'number', min: 1, max: 100000, default: 10 },
		{ name: 'decimals', label: 'Decimal places', type: 'number', min: 0, max: 10, default: 0, when: (v) => v.distribution !== 'poisson' },
		{ name: 'unique', label: 'No repeats', type: 'checkbox', when: (v) => v.distribution === 'uniform' },
		{ name: 'sort', label: 'Sort the results', type: 'checkbox' },
		{ name: 'seed', label: 'Seed (optional)', type: 'text', placeholder: 'Same seed, same numbers', hint: 'Blank uses the browser\'s cryptographic generator.' },
	],
	run(a) {
		const R = Omni.random;
		const rand = R.source(a.seed);
		const count = Math.max(1, Math.min(100000, Math.floor(a.count || 1)));
		const dec = a.distribution === 'poisson' ? 0 : Math.max(0, Math.min(10, a.decimals || 0));
		const round = (x) => (dec ? Number(x.toFixed(dec)) : Math.round(x));
		let nums = [];
		if (a.distribution === 'uniform') {
			const min = a.min ?? 1;
			const max = a.max ?? 100;
			if (max < min) throw new Error('Maximum must be at least the minimum.');
			const step = 10 ** -dec;
			const slots = Math.floor((max - min) / step + 1e-9) + 1;
			if (a.unique && count > slots) throw new Error(`Only ${slots} different values exist between ${min} and ${max} at ${dec} decimals.`);
			const seen = new Set();
			while (nums.length < count) {
				const x = Number((min + R.int(rand, 0, slots - 1) * step).toFixed(dec));
				if (a.unique) {
					if (seen.has(x)) continue;
					seen.add(x);
				}
				nums.push(x);
			}
		} else if (a.distribution === 'normal') nums = Array.from({ length: count }, () => round(R.normal(rand, a.mean ?? 0, a.sd ?? 1)));
		else if (a.distribution === 'exponential') {
			if (!(a.rate > 0)) throw new Error('Rate must be above 0.');
			nums = Array.from({ length: count }, () => round(R.exponential(rand, a.rate)));
		} else nums = Array.from({ length: count }, () => R.poisson(rand, Math.max(0, a.lambda ?? 1)));
		if (a.sort) nums.sort((x, y) => x - y);
		const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
		const blocks = [{ type: 'text', label: count === 1 ? 'Number' : 'Numbers', value: nums.join(count > 30 ? '\n' : ', '), big: count === 1 }];
		if (count > 1) {
			blocks.push({ type: 'readings', items: [{ label: 'Lowest', value: Math.min(...nums), copy: false }, { label: 'Highest', value: Math.max(...nums), copy: false }, { label: 'Mean of these', value: Number(mean.toFixed(4)), copy: false }, { label: 'Seed', value: a.seed || 'none (crypto)', copy: false }] });
			if (count >= 20) blocks.push({ type: 'node', node: Omni.histogram(nums, 'Distribution of these numbers') });
		}
		return { blocks };
	},
});

/** A small bar histogram on canvas, used by the number tools. */
Omni.histogram = function histogram(values, label) {
	const { h } = Omni;
	const bins = Math.min(24, Math.max(5, Math.round(Math.sqrt(values.length))));
	const min = Math.min(...values);
	const max = Math.max(...values);
	const width = (max - min) / bins || 1;
	const counts = new Array(bins).fill(0);
	values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v - min) / width))]++);
	const canvas = h('canvas', { class: 'plot', width: 640, height: 180, role: 'img', 'aria-label': `${label}: ${bins} bins from ${min} to ${max}` });
	const draw = () => {
		const ctx = canvas.getContext('2d');
		const css = getComputedStyle(document.documentElement);
		const ink = css.getPropertyValue('--ink').trim();
		const muted = css.getPropertyValue('--muted').trim();
		ctx.clearRect(0, 0, 640, 180);
		const top = Math.max(...counts);
		const bw = 600 / bins;
		counts.forEach((c, i) => {
			const bh = (c / top) * 140;
			ctx.fillStyle = ink;
			ctx.fillRect(20 + i * bw + 2, 160 - bh, bw - 4, bh);
		});
		ctx.fillStyle = muted;
		ctx.font = '11px "Martian Mono", monospace';
		ctx.fillText(String(Number(min.toFixed(3))), 20, 176);
		const maxText = String(Number(max.toFixed(3)));
		ctx.fillText(maxText, 620 - ctx.measureText(maxText).width, 176);
	};
	requestAnimationFrame(draw);
	return Omni.forms.block(label, canvas);
};
