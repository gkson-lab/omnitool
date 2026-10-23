// Randomness: crypto-strong by default, or a seeded generator when the user wants repeatable results.
(function () {
	'use strict';

	/** A function returning floats in [0, 1): crypto.getRandomValues, or sfc32 seeded from a string. */
	function source(seed) {
		if (seed == null || seed === '') {
			const buf = new Uint32Array(1);
			return () => {
				crypto.getRandomValues(buf);
				return buf[0] / 4294967296;
			};
		}
		// xmur3 turns the seed string into four 32-bit states for sfc32.
		let h = 1779033703 ^ String(seed).length;
		for (let i = 0; i < String(seed).length; i++) {
			h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
			h = (h << 13) | (h >>> 19);
		}
		const next = () => {
			h = Math.imul(h ^ (h >>> 16), 2246822507);
			h = Math.imul(h ^ (h >>> 13), 3266489909);
			return (h ^= h >>> 16) >>> 0;
		};
		let a = next();
		let b = next();
		let c = next();
		let d = next();
		return () => {
			a >>>= 0;
			b >>>= 0;
			c >>>= 0;
			d >>>= 0;
			let t = (a + b) | 0;
			a = b ^ (b >>> 9);
			b = (c + (c << 3)) | 0;
			c = (c << 21) | (c >>> 11);
			d = (d + 1) | 0;
			t = (t + d) | 0;
			c = (c + t) | 0;
			return (t >>> 0) / 4294967296;
		};
	}

	/** Unbiased integer in [min, max] (rejection sampling avoids modulo bias). */
	function int(rand, min, max) {
		const span = max - min + 1;
		if (span <= 0) throw new Error('The maximum must be at least the minimum');
		if (span > 2 ** 32) return Math.floor(rand() * span) + min;
		const limit = Math.floor(4294967296 / span) * span;
		for (;;) {
			const x = Math.floor(rand() * 4294967296);
			if (x < limit) return min + (x % span);
		}
	}

	function normal(rand, mean, sd) {
		let u = 0;
		while (u === 0) u = rand();
		const v = rand();
		return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	}

	function exponential(rand, rate) {
		return -Math.log(1 - rand()) / rate;
	}

	function poisson(rand, lambda) {
		if (lambda > 60) return Math.max(0, Math.round(normal(rand, lambda, Math.sqrt(lambda))));
		const L = Math.exp(-lambda);
		let k = 0;
		let p = 1;
		do {
			k++;
			p *= rand();
		} while (p > L);
		return k - 1;
	}

	function shuffle(rand, arr) {
		const a = arr.slice();
		for (let i = a.length - 1; i > 0; i--) {
			const j = int(rand, 0, i);
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	function pick(rand, arr) {
		return arr[int(rand, 0, arr.length - 1)];
	}

	function bytes(n) {
		return crypto.getRandomValues(new Uint8Array(n));
	}

	Omni.random = { source, int, normal, exponential, poisson, shuffle, pick, bytes };
})();
