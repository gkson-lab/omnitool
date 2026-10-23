// No. 080 Combinatorics calculator: exact factorials, permutations and combinations, plus binomial probability.
Omni.register({
	no: 80,
	id: 'combinatorics',
	name: 'Combinatorics calculator',
	category: 'math',
	keywords: ['factorial', 'permutation', 'combination', 'ncr', 'npr', 'binomial', 'probability', 'choose'],
	description: 'Exact n!, permutations and combinations (with and without repetition) and the binomial probability of k successes in n tries.',
	live: true,
	inputs: [
		{ name: 'n', label: 'n (items or trials)', type: 'number', min: 0, max: 5000, default: 10 },
		{ name: 'k', label: 'k (chosen or successes)', type: 'number', min: 0, max: 5000, default: 3 },
		{ name: 'p', label: 'Success probability p (0 to 1)', type: 'number', min: 0, max: 1, step: 'any', default: 0.5 },
	],
	run({ n, k, p }) {
		const N = Math.floor(n ?? 0);
		const K = Math.floor(k ?? 0);
		if (N < 0 || K < 0) throw new Error('n and k must be 0 or more.');
		if (N > 5000) throw new Error('n up to 5000 keeps the exact numbers readable.');
		const fact = (x) => {
			let r = 1n;
			for (let i = 2n; i <= BigInt(x); i++) r *= i;
			return r;
		};
		const perm = (a, b) => {
			if (b > a) return 0n;
			let r = 1n;
			for (let i = BigInt(a - b + 1); i <= BigInt(a); i++) r *= i;
			return r;
		};
		const comb = (a, b) => (b > a ? 0n : perm(a, b) / fact(b));
		const short = (big) => {
			const s = big.toString();
			return s.length > 60 ? `${s.slice(0, 20)}...${s.slice(-10)} (${s.length} digits)` : s;
		};
		const P = Math.max(0, Math.min(1, p ?? 0.5));
		// Binomial probabilities via logs so large n doesn't overflow.
		const logC = (a, b) => {
			let s = 0;
			for (let i = 1; i <= b; i++) s += Math.log(a - b + i) - Math.log(i);
			return s;
		};
		const pmf = (x) => (x > N ? 0 : P === 0 ? (x === 0 ? 1 : 0) : P === 1 ? (x === N ? 1 : 0) : Math.exp(logC(N, x) + x * Math.log(P) + (N - x) * Math.log(1 - P)));
		let cdf = 0;
		for (let i = 0; i <= Math.min(K, N); i++) cdf += pmf(i);
		return {
			readings: [
				{ label: `${N}!`, value: short(fact(N)) },
				{ label: `Permutations P(${N}, ${K})`, value: short(perm(N, K)) },
				{ label: `Combinations C(${N}, ${K})`, value: short(comb(N, K)) },
				{ label: `With repetition: ${N}^${K}`, value: short(BigInt(N) ** BigInt(K)) },
				{ label: `Multisets C(${N + K - 1}, ${K})`, value: N ? short(comb(N + K - 1, K)) : '0' },
				{ label: `P(exactly ${K} of ${N}) at p = ${P}`, value: pmf(K).toPrecision(6) },
				{ label: `P(at most ${K})`, value: Math.min(1, cdf).toPrecision(6) },
				{ label: `P(at least ${K})`, value: Math.max(0, Math.min(1, 1 - cdf + pmf(K))).toPrecision(6) },
			],
		};
	},
});
