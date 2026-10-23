// No. 079 Fraction calculator: exact rational arithmetic (BigInt) on expressions like 1/2 + 3/4 * 2/3.
(function () {
	'use strict';
	const gcd = (a, b) => {
		a = a < 0n ? -a : a;
		b = b < 0n ? -b : b;
		while (b) [a, b] = [b, a % b];
		return a || 1n;
	};
	const R = (n, d = 1n) => {
		if (d === 0n) throw new Error('Division by zero.');
		if (d < 0n) {
			n = -n;
			d = -d;
		}
		const g = gcd(n, d);
		return { n: n / g, d: d / g };
	};
	// Decimal literals are converted from their shortest printed form, so 0.1 is exactly 1/10.
	const fromNumber = (x) => {
		const s = String(x);
		if (/e/i.test(s)) throw new Error('Use plain decimals, not scientific notation, in fractions.');
		const [i, f = ''] = s.split('.');
		return R(BigInt(i + f), 10n ** BigInt(f.length));
	};

	function evalRational(node) {
		switch (node.type) {
			case 'num':
				return fromNumber(node.value);
			case 'neg': {
				const a = evalRational(node.arg);
				return R(-a.n, a.d);
			}
			case 'bin': {
				const a = evalRational(node.left);
				const b = evalRational(node.right);
				if (node.op === '+') return R(a.n * b.d + b.n * a.d, a.d * b.d);
				if (node.op === '-') return R(a.n * b.d - b.n * a.d, a.d * b.d);
				if (node.op === '*') return R(a.n * b.n, a.d * b.d);
				if (node.op === '/') return R(a.n * b.d, a.d * b.n);
				if (node.op === '^') {
					if (b.d !== 1n) throw new Error('Exact fractions only allow whole-number powers.');
					const e = b.n < 0n ? -b.n : b.n;
					const p = R(a.n ** e, a.d ** e);
					return b.n < 0n ? R(p.d, p.n) : p;
				}
				throw new Error(`"${node.op}" is not supported in fractions.`);
			}
			default:
				throw new Error('Fractions support numbers, + - * / ^ and parentheses.');
		}
	}

	Omni.register({
		no: 79,
		id: 'fractions',
		name: 'Fraction calculator',
		category: 'math',
		keywords: ['fraction', 'rational', 'mixed number', 'simplify', 'exact'],
		description: 'Exact fraction arithmetic: type 1/2 + 3/4 * 2/3 or (5/6)^2 and get the simplified fraction, mixed number and decimal.',
		live: true,
		inputs: [{ name: 'expr', label: 'Expression', type: 'text', mono: true, default: '1/2 + 3/4 * 2/3 - 0.125', hint: 'Mixed numbers: write 1 + 1/2 for one and a half.' }],
		run({ expr }) {
			if (!expr.trim()) return { note: 'Type an expression.' };
			const r = evalRational(Omni.math.parse(expr));
			const whole = r.n / r.d;
			const rem = r.n % r.d;
			const mixed = rem === 0n ? whole.toString() : whole === 0n ? `${r.n}/${r.d}` : `${whole} ${rem < 0n ? -rem : rem}/${r.d}`;
			const dec = Number(r.n) / Number(r.d);
			return { text: r.d === 1n ? r.n.toString() : `${r.n}/${r.d}`, big: true, label: 'Simplified', readings: [{ label: 'Mixed number', value: mixed }, { label: 'Decimal', value: Omni.math.format(dec, 15) }, { label: 'Percent', value: Omni.math.format(dec * 100, 10) + '%' }] };
		},
	});
})();
