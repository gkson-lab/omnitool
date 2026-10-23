// No. 069 Matrix calculator: add, subtract, multiply, transpose, determinant, inverse, power, rank and row reduction.
(function () {
	'use strict';
	const EPS = 1e-10;

	function parse(text, name) {
		const rows = text.trim().split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/[[\]]/g, '').split(/[\s,;]+/).filter(Boolean).map((v) => {
			const n = Omni.math.evaluate(v);
			if (!Number.isFinite(n)) throw new Error(`"${v}" in ${name} is not a number.`);
			return n;
		}));
		if (!rows.length) throw new Error(`${name} is empty.`);
		if (rows.some((r) => r.length !== rows[0].length)) throw new Error(`Every row of ${name} needs the same number of values.`);
		return rows;
	}
	const dims = (m) => `${m.length}x${m[0].length}`;
	const transpose = (m) => m[0].map((_, j) => m.map((r) => r[j]));
	function mul(a, b) {
		if (a[0].length !== b.length) throw new Error(`Cannot multiply ${dims(a)} by ${dims(b)}: columns of A must equal rows of B.`);
		return a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
	}
	/** Row reduction with partial pivoting; returns { m, rank, det, swaps }. */
	function rref(input) {
		const m = input.map((r) => r.slice());
		const rows = m.length;
		const cols = m[0].length;
		let lead = 0;
		let det = 1;
		let rank = 0;
		for (let r = 0; r < rows && lead < cols; r++, lead++) {
			let p = r;
			for (let i = r + 1; i < rows; i++) if (Math.abs(m[i][lead]) > Math.abs(m[p][lead])) p = i;
			if (Math.abs(m[p][lead]) < EPS) {
				det = 0;
				r--;
				continue;
			}
			if (p !== r) {
				[m[p], m[r]] = [m[r], m[p]];
				det = -det;
			}
			const pv = m[r][lead];
			det *= pv;
			for (let j = 0; j < cols; j++) m[r][j] /= pv;
			for (let i = 0; i < rows; i++) if (i !== r) {
				const f = m[i][lead];
				for (let j = 0; j < cols; j++) m[i][j] -= f * m[r][j];
			}
			rank++;
		}
		return { m, rank, det: rank < Math.min(rows, cols) ? 0 : det };
	}
	function det(a) {
		if (a.length !== a[0].length) throw new Error(`The determinant needs a square matrix; A is ${dims(a)}.`);
		return rref(a).det;
	}
	function inverse(a) {
		const n = a.length;
		if (n !== a[0].length) throw new Error(`Only square matrices have an inverse; A is ${dims(a)}.`);
		const aug = a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
		const res = rref(aug);
		if (res.m.some((r, i) => Math.abs(r[i] - 1) > 1e-8)) throw new Error('A is singular (its determinant is 0), so it has no inverse.');
		return res.m.map((r) => r.slice(n));
	}
	const fmtM = (m) => {
		const cells = m.map((r) => r.map((v) => Omni.math.format(Math.abs(v) < EPS ? 0 : v, 8)));
		const w = Math.max(...cells.flat().map((c) => c.length));
		return cells.map((r) => '[ ' + r.map((c) => c.padStart(w)).join('  ') + ' ]').join('\n');
	};

	Omni.register({
		no: 69,
		id: 'matrix',
		name: 'Matrix calculator',
		category: 'math',
		keywords: ['matrix', 'determinant', 'inverse', 'transpose', 'linear algebra', 'rref', 'multiply'],
		description: 'Adds, subtracts and multiplies matrices; finds transpose, determinant, inverse, powers, rank and reduced row echelon form.',
		action: 'Calculate',
		layout: 'split',
		inputs: [
			{ name: 'op', label: 'Operation', type: 'select', options: [{ value: 'mul', label: 'A x B' }, { value: 'add', label: 'A + B' }, { value: 'sub', label: 'A - B' }, { value: 'det', label: 'Determinant of A' }, { value: 'inv', label: 'Inverse of A' }, { value: 'tr', label: 'Transpose of A' }, { value: 'pow', label: 'A to a power' }, { value: 'rref', label: 'Row reduce A (RREF) and rank' }, { value: 'scale', label: 'A times a number' }], default: 'mul' },
			{ name: 'a', label: 'Matrix A (one row per line)', type: 'textarea', mono: true, rows: 4, default: '2 1 0\n1 3 1\n0 1 4' },
			{ name: 'b', label: 'Matrix B', type: 'textarea', mono: true, rows: 4, default: '1 0\n0 1\n2 -1', when: (v) => ['mul', 'add', 'sub'].includes(v.op) },
			{ name: 'k', label: 'Number or power', type: 'number', step: 'any', default: 2, when: (v) => ['pow', 'scale'].includes(v.op) },
		],
		run({ op, a, b, k }) {
			const A = parse(a, 'A');
			let out;
			let extra = [];
			if (['add', 'sub', 'mul'].includes(op)) {
				const B = parse(b, 'B');
				if (op === 'mul') out = mul(A, B);
				else {
					if (dims(A) !== dims(B)) throw new Error(`A is ${dims(A)} and B is ${dims(B)}; addition needs equal sizes.`);
					out = A.map((r, i) => r.map((v, j) => (op === 'add' ? v + B[i][j] : v - B[i][j])));
				}
			} else if (op === 'det') return { text: Omni.math.format(det(A), 10), big: true, label: `det(A), A is ${dims(A)}` };
			else if (op === 'inv') {
				out = inverse(A);
				extra = [{ label: 'det(A)', value: Omni.math.format(det(A), 10) }];
			} else if (op === 'tr') out = transpose(A);
			else if (op === 'scale') out = A.map((r) => r.map((v) => v * (k ?? 1)));
			else if (op === 'pow') {
				if (A.length !== A[0].length) throw new Error('Only square matrices can be raised to a power.');
				const p = Math.round(k ?? 2);
				if (p < 0) out = inverse(A);
				let base = p < 0 ? out : A;
				out = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
				for (let e = Math.abs(p); e > 0; e >>= 1) {
					if (e & 1) out = mul(out, base);
					base = mul(base, base);
				}
			} else if (op === 'rref') {
				const r = rref(A);
				out = r.m;
				extra = [{ label: 'Rank', value: r.rank }];
			}
			return { text: fmtM(out), label: `Result (${dims(out)})`, readings: extra.length ? extra : null };
		},
	});
})();
