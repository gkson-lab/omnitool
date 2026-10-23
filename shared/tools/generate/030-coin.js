// No. 030 Coin flipper: one or many flips with counts and the longest streak.
Omni.register({
	no: 30,
	id: 'coin',
	name: 'Coin flipper',
	category: 'generate',
	keywords: ['coin', 'flip', 'heads', 'tails', 'toss', 'random'],
	description: 'Flips one coin or thousands, with heads and tails counts and the longest streak.',
	action: 'Flip',
	inputs: [{ name: 'count', label: 'Coins', type: 'number', min: 1, max: 100000, default: 1 }],
	run({ count }) {
		const n = Math.max(1, Math.min(100000, Math.floor(count || 1)));
		const rand = Omni.random.source();
		const flips = Array.from({ length: n }, () => (Omni.random.int(rand, 0, 1) ? 'H' : 'T'));
		const heads = flips.filter((f) => f === 'H').length;
		let best = 1;
		let run = 1;
		let bestSide = flips[0];
		for (let i = 1; i < n; i++) {
			run = flips[i] === flips[i - 1] ? run + 1 : 1;
			if (run > best) {
				best = run;
				bestSide = flips[i];
			}
		}
		if (n === 1) return { text: heads ? 'Heads' : 'Tails', big: true, label: 'Result' };
		return {
			meter: { value: heads / n, label: 'Share of heads', text: `${((heads / n) * 100).toFixed(1)}%` },
			readings: [{ label: 'Heads', value: heads, copy: false }, { label: 'Tails', value: n - heads, copy: false }, { label: 'Longest streak', value: `${best} ${bestSide === 'H' ? 'heads' : 'tails'}`, copy: false }],
			text: n <= 2000 ? flips.join('') : flips.slice(0, 2000).join('') + ` ... (${n - 2000} more)`,
			label: 'Sequence (H = heads, T = tails)',
		};
	},
});
