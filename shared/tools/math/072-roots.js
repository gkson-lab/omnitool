// No. 072 Polynomial root finder: all real and complex roots by the Durand-Kerner method.
Omni.register({
	no: 72,
	id: 'roots',
	name: 'Polynomial root finder',
	category: 'math',
	keywords: ['polynomial', 'roots', 'zeros', 'quadratic', 'cubic', 'equation', 'solve'],
	description: 'Finds every real and complex root of a polynomial from its coefficients, highest power first.',
	live: true,
	inputs: [{ name: 'coefs', label: 'Coefficients, highest power first', type: 'text', mono: true, default: '1, -6, 11, -6', hint: '1, -6, 11, -6 means x³ - 6x² + 11x - 6' }],
	run({ coefs }) {
		let c = coefs.split(/[\s,;]+/).filter(Boolean).map((v) => Omni.math.evaluate(v));
		while (c.length && c[0] === 0) c.shift();
		if (c.length < 2) throw new Error('Give at least two coefficients, for example 1, -4 for x - 4.');
		if (c.length > 21) throw new Error('Degree 20 is the limit.');
		const deg = c.length - 1;
		const a = c.map((v) => v / c[0]);
		// Complex numbers as [re, im].
		const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
		const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
		const div = (p, q) => {
			const d = q[0] * q[0] + q[1] * q[1] || 1e-300;
			return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d];
		};
		const evalAt = (z) => a.reduce((acc, k) => [acc[0] * z[0] - acc[1] * z[1] + k, acc[0] * z[1] + acc[1] * z[0]], [0, 0]);
		let roots = Array.from({ length: deg }, (_, i) => {
			const r = 0.4 + 0.9 * i;
			return [Math.cos(r) * (1 + i * 0.1), Math.sin(r) * (1 + i * 0.1)];
		});
		for (let iter = 0; iter < 2000; iter++) {
			let moved = 0;
			roots = roots.map((z, i) => {
				let den = [1, 0];
				roots.forEach((w, j) => {
					if (i !== j) den = mul(den, sub(z, w));
				});
				const next = sub(z, div(evalAt(z), den));
				moved = Math.max(moved, Math.hypot(next[0] - z[0], next[1] - z[1]));
				return next;
			});
			if (moved < 1e-14) break;
		}
		const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : v);
		const f = (v) => Omni.math.format(clean(v), 10);
		const rows = roots
			.map((z) => [clean(z[0]), clean(z[1])])
			.sort((p, q) => p[0] - q[0] || p[1] - q[1])
			.map(([re, im], i) => [i + 1, im === 0 ? f(re) : `${f(re)} ${im < 0 ? '-' : '+'} ${f(Math.abs(im))}i`, im === 0 ? 'real' : 'complex', Omni.math.format(Math.hypot(...evalAt([re, im])), 3)]);
		const terms = c.map((k, i) => {
			const p = deg - i;
			if (!k) return '';
			const coef = Math.abs(k) === 1 && p ? '' : Omni.math.format(Math.abs(k));
			return `${k < 0 ? '- ' : i ? '+ ' : ''}${coef}${p ? 'x' + (p > 1 ? '^' + p : '') : ''}`;
		}).filter(Boolean).join(' ');
		return { text: terms + ' = 0', label: `Degree ${deg}`, table: { label: 'Roots', columns: ['#', 'Root', 'Kind', '|f(root)| (should be ~0)'], rows } };
	},
});
