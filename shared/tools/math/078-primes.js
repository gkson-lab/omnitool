// No. 078 Prime factors, GCD and LCM: exact BigInt arithmetic with Miller-Rabin and Pollard's rho.
(function () {
	'use strict';

	function modpow(b, e, m) {
		let r = 1n;
		b %= m;
		while (e > 0n) {
			if (e & 1n) r = (r * b) % m;
			b = (b * b) % m;
			e >>= 1n;
		}
		return r;
	}
	/** Deterministic Miller-Rabin for n below 3.3e24 using the first twelve primes as witnesses. */
	function isPrime(n) {
		if (n < 2n) return false;
		for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) if (n % p === 0n) return n === p;
		let d = n - 1n;
		let s = 0;
		while (!(d & 1n)) {
			d >>= 1n;
			s++;
		}
		for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
			let x = modpow(a, d, n);
			if (x === 1n || x === n - 1n) continue;
			let comp = true;
			for (let i = 1; i < s; i++) {
				x = (x * x) % n;
				if (x === n - 1n) {
					comp = false;
					break;
				}
			}
			if (comp) return false;
		}
		return true;
	}
	const gcd = (a, b) => {
		a = a < 0n ? -a : a;
		b = b < 0n ? -b : b;
		while (b) [a, b] = [b, a % b];
		return a;
	};
	function rho(n) {
		if (n % 2n === 0n) return 2n;
		for (let c = 1n; c < 50n; c++) {
			let x = 2n;
			let y = 2n;
			let d = 1n;
			const f = (v) => (v * v + c) % n;
			for (let i = 0; i < 2000000 && d === 1n; i++) {
				x = f(x);
				y = f(f(y));
				d = gcd(x - y, n);
			}
			if (d !== n && d !== 1n) return d;
		}
		throw new Error('Could not split this number in reasonable time.');
	}
	function factor(n, out = []) {
		if (n === 1n) return out;
		for (const p of [2n, 3n, 5n, 7n, 11n, 13n]) while (n % p === 0n) {
			out.push(p);
			n /= p;
		}
		if (n === 1n) return out;
		if (isPrime(n)) {
			out.push(n);
			return out;
		}
		const d = rho(n);
		factor(d, out);
		factor(n / d, out);
		return out;
	}

	Omni.register({
		no: 78,
		id: 'primes',
		name: 'Prime factors, GCD and LCM',
		category: 'math',
		keywords: ['prime', 'factor', 'factorization', 'gcd', 'lcm', 'divisor', 'number theory'],
		description: 'Prime factorization and primality of each number (exact, any size up to about 25 digits), plus the GCD and LCM of all of them.',
		live: true,
		inputs: [{ name: 'numbers', label: 'Whole numbers', type: 'text', mono: true, default: '360, 1001, 9007199254740993' }],
		run({ numbers }) {
			const list = numbers.split(/[\s,;]+/).filter(Boolean).map((v) => {
				if (!/^\d+$/.test(v)) throw new Error(`"${v}" is not a positive whole number.`);
				return BigInt(v);
			});
			if (!list.length) return { note: 'Type some numbers.' };
			if (list.some((n) => n > 10n ** 25n)) throw new Error('Numbers up to 25 digits are supported.');
			const rows = list.map((n) => {
				if (n < 2n) return [n.toString(), n === 0n ? 'zero' : 'one', '-'];
				const fs = factor(n).sort((a, b) => (a < b ? -1 : 1));
				const grouped = [];
				fs.forEach((p) => (grouped.length && grouped[grouped.length - 1][0] === p ? grouped[grouped.length - 1][1]++ : grouped.push([p, 1])));
				const divisors = grouped.reduce((d, [, e]) => d * (e + 1), 1);
				return [n.toString(), fs.length === 1 ? 'prime' : `composite, ${divisors} divisors`, grouped.map(([p, e]) => (e > 1 ? `${p}^${e}` : p.toString())).join(' x ')];
			});
			const g = list.reduce(gcd);
			const l = list.reduce((a, b) => (a && b ? (a / gcd(a, b)) * b : 0n));
			return { readings: [{ label: 'GCD', value: g.toString() }, { label: 'LCM', value: l.toString() }], table: { columns: ['Number', 'Kind', 'Prime factors'], rows } };
		},
	});
})();
