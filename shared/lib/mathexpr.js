// Safe math expressions (no eval): parse to a tree, then evaluate or compile. Used by the calculators, graphing and the agent.
(function () {
	'use strict';

	const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2, inf: Infinity };

	function factorial(n) {
		if (n < 0 || !Number.isFinite(n)) return NaN;
		if (Number.isInteger(n)) {
			if (n > 170) return Infinity;
			let r = 1;
			for (let i = 2; i <= n; i++) r *= i;
			return r;
		}
		return gamma(n + 1);
	}
	// Lanczos approximation, for factorials of non-integers.
	function gamma(z) {
		if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
		const g = 7;
		const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
		z -= 1;
		let x = c[0];
		for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
		const t = z + g + 0.5;
		return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
	}
	const gcd2 = (a, b) => {
		a = Math.abs(Math.round(a));
		b = Math.abs(Math.round(b));
		while (b) [a, b] = [b, a % b];
		return a;
	};
	const choose = (n, k) => {
		if (k < 0 || k > n) return 0;
		k = Math.min(k, n - k);
		let r = 1;
		for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
		return Math.round(r);
	};

	function makeFunctions(deg) {
		const toRad = deg ? (x) => (x * Math.PI) / 180 : (x) => x;
		const fromRad = deg ? (x) => (x * 180) / Math.PI : (x) => x;
		return {
			sin: (x) => Math.sin(toRad(x)),
			cos: (x) => Math.cos(toRad(x)),
			tan: (x) => Math.tan(toRad(x)),
			asin: (x) => fromRad(Math.asin(x)),
			acos: (x) => fromRad(Math.acos(x)),
			atan: (x) => fromRad(Math.atan(x)),
			atan2: (y, x) => fromRad(Math.atan2(y, x)),
			sinh: Math.sinh,
			cosh: Math.cosh,
			tanh: Math.tanh,
			asinh: Math.asinh,
			acosh: Math.acosh,
			atanh: Math.atanh,
			sqrt: Math.sqrt,
			cbrt: Math.cbrt,
			abs: Math.abs,
			ln: Math.log,
			log: (x, b) => (b == null ? Math.log10(x) : Math.log(x) / Math.log(b)),
			log2: Math.log2,
			log10: Math.log10,
			exp: Math.exp,
			floor: Math.floor,
			ceil: Math.ceil,
			round: (x, d) => (d == null ? Math.round(x) : Math.round(x * 10 ** d) / 10 ** d),
			trunc: Math.trunc,
			sign: Math.sign,
			min: Math.min,
			max: Math.max,
			pow: Math.pow,
			hypot: Math.hypot,
			fact: factorial,
			gamma,
			gcd: (...a) => a.reduce(gcd2),
			lcm: (...a) => a.reduce((x, y) => Math.abs(x * y) / gcd2(x, y)),
			ncr: choose,
			npr: (n, k) => (k < 0 || k > n ? 0 : Math.round(factorial(n) / factorial(n - k))),
			mod: (a, b) => ((a % b) + b) % b,
			deg: (x) => (x * 180) / Math.PI,
			rad: (x) => (x * Math.PI) / 180,
		};
	}

	/* ---------- Tokenizer ---------- */

	function tokenize(src) {
		const tokens = [];
		let i = 0;
		while (i < src.length) {
			const c = src[i];
			if (/\s/.test(c)) {
				i++;
				continue;
			}
			const numMatch = src.slice(i).match(/^(0x[0-9a-f]+|0b[01]+|0o[0-7]+|(\d[\d_]*\.?\d*|\.\d+)(e[+-]?\d+)?)/i);
			if (numMatch && /[\d.]/.test(c)) {
				const raw = numMatch[0].replace(/_/g, '');
				const value = /^0[xbo]/i.test(raw) ? Number(raw.toLowerCase()) : parseFloat(raw);
				tokens.push({ type: 'num', value, pos: i });
				i += numMatch[0].length;
				continue;
			}
			const id = src.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
			if (id) {
				tokens.push({ type: 'id', value: id[0], pos: i });
				i += id[0].length;
				continue;
			}
			if ('+-*/^%(),!='.includes(c)) {
				tokens.push({ type: 'op', value: c, pos: i });
				i++;
				continue;
			}
			if (c === '×' || c === '·') {
				tokens.push({ type: 'op', value: '*', pos: i });
				i++;
				continue;
			}
			if (c === '÷') {
				tokens.push({ type: 'op', value: '/', pos: i });
				i++;
				continue;
			}
			if (c === '−') {
				tokens.push({ type: 'op', value: '-', pos: i });
				i++;
				continue;
			}
			if (c === 'π') {
				tokens.push({ type: 'id', value: 'pi', pos: i });
				i++;
				continue;
			}
			if (c === '√') {
				tokens.push({ type: 'id', value: 'sqrt', pos: i });
				i++;
				continue;
			}
			throw new SyntaxError(`Unexpected "${c}" at position ${i + 1}`);
		}
		return tokens;
	}

	/* ---------- Parser (precedence climbing) ---------- */

	function parse(src) {
		const tokens = tokenize(src);
		let p = 0;
		const peek = () => tokens[p];
		const isOp = (v) => peek() && peek().type === 'op' && peek().value === v;
		const expect = (v) => {
			if (!isOp(v)) throw new SyntaxError(peek() ? `Expected "${v}" at position ${peek().pos + 1}` : `Expected "${v}" at the end`);
			p++;
		};

		function expression() {
			let left = term();
			while (isOp('+') || isOp('-')) {
				const op = tokens[p++].value;
				left = { type: 'bin', op, left, right: term() };
			}
			return left;
		}
		// Implicit multiplication: 2pi, 3(4), (1)(2), 2x.
		function startsFactor() {
			const t = peek();
			return t && (t.type === 'num' || t.type === 'id' || (t.type === 'op' && t.value === '('));
		}
		function term() {
			let left = unary();
			for (;;) {
				if (isOp('*') || isOp('/') || isOp('%')) {
					const op = tokens[p++].value;
					left = { type: 'bin', op, left, right: unary() };
				} else if (peek() && peek().type === 'id' && peek().value === 'mod') {
					p++;
					left = { type: 'bin', op: '%', left, right: unary() };
				} else if (startsFactor()) {
					left = { type: 'bin', op: '*', left, right: unary() };
				} else return left;
			}
		}
		function unary() {
			if (isOp('-')) {
				p++;
				return { type: 'neg', arg: unary() };
			}
			if (isOp('+')) {
				p++;
				return unary();
			}
			return power();
		}
		function power() {
			const base = postfix();
			if (isOp('^')) {
				p++;
				return { type: 'bin', op: '^', left: base, right: unary() };
			}
			return base;
		}
		function postfix() {
			let node = primary();
			while (isOp('!')) {
				p++;
				node = { type: 'call', name: 'fact', args: [node] };
			}
			return node;
		}
		function primary() {
			const t = peek();
			if (!t) throw new SyntaxError('The expression ends too early');
			if (t.type === 'num') {
				p++;
				return { type: 'num', value: t.value };
			}
			if (t.type === 'id') {
				p++;
				const name = t.value;
				if (isOp('(')) {
					p++;
					const args = [];
					if (!isOp(')')) {
						args.push(expression());
						while (isOp(',')) {
							p++;
							args.push(expression());
						}
					}
					expect(')');
					return { type: 'call', name: name.toLowerCase(), args };
				}
				return { type: 'var', name };
			}
			if (t.type === 'op' && t.value === '(') {
				p++;
				const e = expression();
				expect(')');
				return e;
			}
			throw new SyntaxError(`Unexpected "${t.value}" at position ${t.pos + 1}`);
		}

		if (!tokens.length) throw new SyntaxError('Empty expression');
		const ast = expression();
		if (p < tokens.length) throw new SyntaxError(`Unexpected "${tokens[p].value}" at position ${tokens[p].pos + 1}`);
		return ast;
	}

	/* ---------- Evaluation ---------- */

	function compile(ast, opts) {
		const fns = makeFunctions(opts && opts.degrees);
		const build = (n) => {
			switch (n.type) {
				case 'num': {
					const v = n.value;
					return () => v;
				}
				case 'var': {
					const name = n.name;
					const lower = name.toLowerCase();
					return (vars) => {
						if (vars && name in vars) return vars[name];
						if (lower in CONSTANTS) return CONSTANTS[lower];
						throw new ReferenceError(`Unknown name "${name}"`);
					};
				}
				case 'neg': {
					const a = build(n.arg);
					return (v) => -a(v);
				}
				case 'bin': {
					const l = build(n.left);
					const r = build(n.right);
					switch (n.op) {
						case '+':
							return (v) => l(v) + r(v);
						case '-':
							return (v) => l(v) - r(v);
						case '*':
							return (v) => l(v) * r(v);
						case '/':
							return (v) => l(v) / r(v);
						case '%':
							return (v) => l(v) % r(v);
						case '^':
							return (v) => Math.pow(l(v), r(v));
					}
					break;
				}
				case 'call': {
					const fn = fns[n.name];
					if (!fn) throw new ReferenceError(`Unknown function "${n.name}"`);
					const args = n.args.map(build);
					return (v) => fn(...args.map((a) => a(v)));
				}
			}
			throw new Error('Bad expression tree');
		};
		return build(ast);
	}

	function evaluate(src, vars, opts) {
		return compile(parse(src), opts)(vars || {});
	}

	/** Names used as variables (not constants or functions), e.g. ["x"] for "2x + sin(x)". */
	function variables(ast) {
		const out = new Set();
		const walk = (n) => {
			if (n.type === 'var' && !(n.name.toLowerCase() in CONSTANTS)) out.add(n.name);
			if (n.left) walk(n.left);
			if (n.right) walk(n.right);
			if (n.arg) walk(n.arg);
			if (n.args) n.args.forEach(walk);
		};
		walk(ast);
		return [...out];
	}

	/** Formats a result: integers exact, others to 12 significant digits, tiny noise like 1e-17 as 0. */
	function format(x, digits) {
		if (typeof x !== 'number') return String(x);
		if (Number.isNaN(x)) return 'Not a number';
		if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity';
		if (Math.abs(x) < 1e-15) return '0';
		if (Number.isInteger(x) && Math.abs(x) < 1e21) return String(x);
		const s = Number(x.toPrecision(digits || 12));
		return Math.abs(s) >= 1e21 || Math.abs(s) < 1e-7 ? s.toExponential() : String(s);
	}

	Omni.math = { parse, compile, evaluate, variables, format, factorial, gamma, choose, gcd: gcd2, CONSTANTS, FUNCTIONS: Object.keys(makeFunctions(false)) };
})();
