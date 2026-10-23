// Onyx's own arithmetic: reads numbers written as digits or words ("twelve times seven", "15% of 80", "what's that
// squared"), evaluates them with a small parser (never eval), and answers in a sentence. No tools, no network.
(function () {
	'use strict';

	/* ---------- Numbers written as words ---------- */

	const UNITS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
	const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
	const SCALES = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
	const NUMBER_WORD = new RegExp(`\\b(?:(?:${[...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES), 'a', 'and', 'point'].join('|')})(?:[\\s-]+|$))+`, 'gi');

	/** "two hundred and five point three" -> 205.3; returns null if the words aren't a number. */
	function wordsToNumber(text) {
		const words = text.toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean);
		let total = 0;
		let current = 0;
		let seen = false;
		let decimals = null;
		for (let i = 0; i < words.length; i++) {
			const w = words[i];
			if (decimals !== null) {
				if (!(w in UNITS)) return null;
				decimals += String(UNITS[w]);
				continue;
			}
			if (w === 'and') continue;
			if (w === 'a' && SCALES[words[i + 1]]) {
				current += 1;
				seen = true;
			} else if (w === 'point') decimals = '';
			else if (w in UNITS) {
				current += UNITS[w];
				seen = true;
			} else if (w in TENS) {
				current += TENS[w];
				seen = true;
			} else if (w === 'hundred') current = (current || 1) * 100;
			else if (w in SCALES) {
				total += (current || 1) * SCALES[w];
				current = 0;
				seen = true;
			} else return null;
		}
		if (!seen) return null;
		const n = total + current;
		return decimals ? Number(`${n}.${decimals}`) : n;
	}

	/** Replaces runs of number words with digits, leaving "a", "and" and "point" alone when they aren't part of a number. */
	function digitize(text) {
		return text.replace(NUMBER_WORD, (run) => {
			const trimmed = run.trim().replace(/\s+(and|a|point)$/i, '');
			const tail = run.slice(trimmed.length);
			const n = wordsToNumber(trimmed);
			return n == null || /^(a|and|point)$/i.test(trimmed) ? run : `${n}${tail}`;
		});
	}

	/* ---------- Turning a sentence into an expression ---------- */

	const NUM = '(-?\\d+(?:\\.\\d+)?)';

	/** "what is 5 plus 3" -> "5 + 3"; returns null when the message isn't arithmetic. */
	function toExpression(raw, last) {
		let t = digitize(' ' + raw.toLowerCase() + ' ').replace(/,(?=\d{3}\b)/g, '').replace(/[?!]+/g, ' ');
		t = t.replace(/\b(what is|whats|what's|how much is|calculate|compute|work out|solve|evaluate|tell me|can you|could you|please|equals?|the answer to|is equal to)\b/g, ' ');
		// Follow-ups lean on the last answer: "times 3", "what's that squared", "and divide it by 2".
		if (last != null) {
			t = t.replace(/\b(that|it|the answer|the result)\b/g, ` ${last} `);
			if (/^\s*(and\s+)?(plus|minus|times|multiplied by|divided by|over|squared|cubed|to the power)/.test(t)) t = ` ${last} ` + t.replace(/^\s*and\s+/, ' ');
		}
		const rules = [
			[new RegExp(`\\b(?:the )?square root of ${NUM}`, 'g'), 'sqrt($1)'],
			[new RegExp(`\\b(?:the )?cube root of ${NUM}`, 'g'), 'cbrt($1)'],
			[new RegExp(`${NUM}\\s*(?:%|percent)\\s+of\\s+${NUM}`, 'g'), '($1 / 100 * $2)'],
			[new RegExp(`\\bhalf of ${NUM}`, 'g'), '($1 / 2)'],
			[new RegExp(`\\b(?:a )?quarter of ${NUM}`, 'g'), '($1 / 4)'],
			[new RegExp(`\\bdouble ${NUM}`, 'g'), '($1 * 2)'],
			[new RegExp(`\\btriple ${NUM}`, 'g'), '($1 * 3)'],
			[new RegExp(`\\badd ${NUM} (?:to|and) ${NUM}`, 'g'), '($2 + $1)'],
			[new RegExp(`\\bsubtract ${NUM} from ${NUM}`, 'g'), '($2 - $1)'],
			[new RegExp(`\\bmultiply ${NUM} (?:by|and|with) ${NUM}`, 'g'), '($1 * $2)'],
			[new RegExp(`\\bdivide ${NUM} by ${NUM}`, 'g'), '($1 / $2)'],
			[new RegExp(`\\b(?:the )?difference between ${NUM} and ${NUM}`, 'g'), 'abs($1 - $2)'],
			[new RegExp(`${NUM} factorial|${NUM}!`, 'g'), (m, a, b) => `fact(${a || b})`],
			[/\bplus\b/g, '+'], [/\bminus\b|\btake away\b|\bless\b/g, '-'], [/\b(times|multiplied by|x)\b/g, '*'], [/\b(divided by|over|divided into)\b/g, '/'],
			[/\bsquared\b/g, '^2'], [/\bcubed\b/g, '^3'], [/\b(to the power of|to the|raised to)\b/g, '^'], [/\bmod(ulo)?\b/g, '%'],
			[/[×]/g, '*'], [/[÷]/g, '/'],
		];
		for (const [re, rep] of rules) t = t.replace(re, rep);
		t = t.replace(/\b(and|by|of|the|is|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
		if (!/\d/.test(t) || !/^[-+*/^%().\d\s\w]*$/.test(t)) return null;
		if (/[a-z]/.test(t.replace(/\b(sqrt|cbrt|abs|fact)\b/g, ''))) return null;
		if (!/[-+*/^%]|sqrt|cbrt|abs|fact/.test(t.replace(/^-/, ''))) return null;
		return t;
	}

	/* ---------- A small, safe evaluator ---------- */

	function evaluate(expr) {
		const tokens = expr.match(/\d+(?:\.\d+)?|sqrt|cbrt|abs|fact|[-+*/^%()]/g) || [];
		let i = 0;
		const peek = () => tokens[i];
		const next = () => tokens[i++];
		const expect = (t) => {
			if (next() !== t) throw new Error('Unbalanced parentheses.');
		};
		function primary() {
			const t = next();
			if (t === undefined) throw new Error('The sum ended early.');
			if (t === '(') {
				const v = sum();
				expect(')');
				return v;
			}
			if (t === '-') return -power();
			if (t === '+') return power();
			if (['sqrt', 'cbrt', 'abs', 'fact'].includes(t)) {
				const hasParen = peek() === '(';
				if (hasParen) next();
				const v = hasParen ? sum() : primary();
				if (hasParen) expect(')');
				if (t === 'sqrt') {
					if (v < 0) throw new Error('A negative number has no real square root.');
					return Math.sqrt(v);
				}
				if (t === 'cbrt') return Math.cbrt(v);
				if (t === 'abs') return Math.abs(v);
				if (!Number.isInteger(v) || v < 0 || v > 170) throw new Error('I can do factorials of whole numbers from 0 to 170.');
				let f = 1;
				for (let k = 2; k <= v; k++) f *= k;
				return f;
			}
			if (/^\d/.test(t)) return Number(t);
			throw new Error(`I don't know what "${t}" means here.`);
		}
		function power() {
			const base = primary();
			if (peek() === '^') {
				next();
				return Math.pow(base, power());
			}
			return base;
		}
		function product() {
			let v = power();
			while (['*', '/', '%'].includes(peek()) || peek() === '(' || /^(sqrt|cbrt|abs|fact)$/.test(peek() || '')) {
				const op = ['*', '/', '%'].includes(peek()) ? next() : '*';
				const r = power();
				if ((op === '/' || op === '%') && r === 0) throw new Error('Dividing by zero has no answer.');
				v = op === '*' ? v * r : op === '/' ? v / r : v % r;
			}
			return v;
		}
		function sum() {
			let v = product();
			while (peek() === '+' || peek() === '-') v = next() === '+' ? v + product() : v - product();
			return v;
		}
		const v = sum();
		if (i < tokens.length) throw new Error('I couldn\'t read the whole sum.');
		if (!Number.isFinite(v)) throw new Error('That number is too big for me.');
		return v;
	}

	/** 84, 0.333333 (rounded to 10 significant digits), 1,234,567 for big whole numbers. */
	function format(n) {
		if (Number.isInteger(n)) return Math.abs(n) >= 1e4 && Math.abs(n) < 1e21 ? n.toLocaleString('en-US') : String(n);
		return String(Number(n.toPrecision(10)));
	}
	const pretty = (expr) => expr.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/([+%^-])/g, ' $1 ').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s+/g, ' ').replace(/^ - /, '-').trim();

	/* ---------- Number facts ---------- */

	const isPrime = (n) => {
		if (n < 2 || !Number.isInteger(n)) return false;
		for (let k = 2; k * k <= n; k++) if (n % k === 0) return false;
		return true;
	};
	const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
	const listNumbers = (text) => (digitize(text).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

	/**
	 * Answers a math message, or returns null if it isn't one. `last` is the previous answer, for follow-ups.
	 * Returns { text, value } where value becomes the next `last`.
	 */
	function answer(raw, last) {
		const t = digitize(raw.toLowerCase());
		let m;
		if ((m = t.match(/\bis (-?\d+) (?:a )?prime\b/)) || (m = t.match(/\bis (-?\d+) prime\b/))) {
			const n = Number(m[1]);
			if (isPrime(n)) return { text: `Yes, ${format(n)} is prime.`, value: n };
			const f = n > 1 ? [...Array(Math.floor(Math.sqrt(n)))].map((_, k) => k + 2).find((k) => n % k === 0) : null;
			return { text: `No, ${format(n)} isn't prime${f ? `: it's ${f} × ${format(n / f)}` : ''}.`, value: n };
		}
		if ((m = t.match(/\bis (-?\d+) (?:an? )?(even|odd)\b/))) {
			const n = Number(m[1]);
			const even = n % 2 === 0;
			return { text: `${m[2] === 'even' ? (even ? 'Yes' : 'No') : even ? 'No' : 'Yes'}, ${format(n)} is ${even ? 'even' : 'odd'}.`, value: n };
		}
		if ((m = t.match(/\b(?:factors|divisors) of (\d+)\b/))) {
			const n = Number(m[1]);
			if (n > 1e7) return { text: 'That one is too big for me to factor quickly.' };
			const fs = [];
			for (let k = 1; k * k <= n; k++) if (n % k === 0) fs.push(k, n / k);
			return { text: `The factors of ${format(n)} are ${[...new Set(fs)].sort((a, b) => a - b).join(', ')}.`, value: n };
		}
		if ((m = t.match(/\b(?:gcd|greatest common divisor|highest common factor|hcf) of (\d+) and (\d+)/))) {
			const v = gcd(Number(m[1]), Number(m[2]));
			return { text: `The greatest common divisor of ${m[1]} and ${m[2]} is **${v}**.`, value: v };
		}
		if ((m = t.match(/\b(?:lcm|least common multiple|lowest common multiple) of (\d+) and (\d+)/))) {
			const a = Number(m[1]);
			const b = Number(m[2]);
			const v = (a * b) / gcd(a, b);
			return { text: `The least common multiple of ${m[1]} and ${m[2]} is **${format(v)}**.`, value: v };
		}
		if ((m = t.match(/\b(?:average|mean) of (.+)$/))) {
			const ns = listNumbers(m[1]);
			if (ns.length >= 2) {
				const v = ns.reduce((a, b) => a + b, 0) / ns.length;
				return { text: `The average of ${ns.join(', ')} is **${format(v)}**.`, value: v };
			}
		}
		if ((m = t.match(/\b(?:sum|total) of (.+)$/)) || (m = t.match(/^\s*add up (.+)$/))) {
			const ns = listNumbers(m[1]);
			if (ns.length >= 2) {
				const v = ns.reduce((a, b) => a + b, 0);
				return { text: `${ns.join(' + ')} = **${format(v)}**.`, value: v };
			}
		}
		if ((m = t.match(/\bproduct of (.+)$/))) {
			const ns = listNumbers(m[1]);
			if (ns.length >= 2) {
				const v = ns.reduce((a, b) => a * b, 1);
				return { text: `${ns.join(' × ')} = **${format(v)}**.`, value: v };
			}
		}
		if ((m = t.match(/\b(?:biggest|largest|highest|max(?:imum)?) of (.+)$/)) || (m = t.match(/\b(?:smallest|lowest|min(?:imum)?) of (.+)$/))) {
			const ns = listNumbers(m[1]);
			if (ns.length >= 2) {
				const big = /biggest|largest|highest|max/.test(t);
				const v = big ? Math.max(...ns) : Math.min(...ns);
				return { text: `The ${big ? 'largest' : 'smallest'} is **${format(v)}**.`, value: v };
			}
		}
		if ((m = t.match(/\bwhich is (?:bigger|larger|greater|more),? (-?\d+(?:\.\d+)?) or (-?\d+(?:\.\d+)?)/)) || (m = t.match(/\bis (-?\d+(?:\.\d+)?) (?:bigger|larger|greater|more) than (-?\d+(?:\.\d+)?)/))) {
			const a = Number(m[1]);
			const b = Number(m[2]);
			if (a === b) return { text: `They're equal: both ${format(a)}.`, value: a };
			if (/^which/.test(m[0])) return { text: `${format(Math.max(a, b))} is bigger.`, value: Math.max(a, b) };
			return { text: a > b ? `Yes, ${format(a)} is bigger than ${format(b)}.` : `No, ${format(a)} is smaller than ${format(b)}.`, value: a };
		}
		if ((m = t.match(/\bwhat percent(?:age)? (?:of (-?\d+(?:\.\d+)?) )?is (-?\d+(?:\.\d+)?)(?: of (-?\d+(?:\.\d+)?))?/))) {
			const part = Number(m[2]);
			const whole = Number(m[1] || m[3]);
			if (whole) {
				const v = (part / whole) * 100;
				return { text: `${format(part)} is **${format(v)}%** of ${format(whole)}.`, value: v };
			}
		}
		if ((m = t.match(/\bround (-?\d+(?:\.\d+)?)(?: to (\d+) (?:decimal places|places|decimals|dp))?/))) {
			const p = Number(m[2] || 0);
			const v = Number(Math.round(Number(m[1] + 'e' + p)) + 'e-' + p);
			return { text: `${m[1]} rounded to ${p ? `${p} decimal place${p === 1 ? '' : 's'}` : 'a whole number'} is **${format(v)}**.`, value: v };
		}
		if ((m = t.match(/\b(\d+) times table\b/)) || (m = t.match(/\btimes table (?:for|of) (\d+)\b/))) {
			const n = Number(m[1]);
			return { text: Array.from({ length: 12 }, (_, k) => `${k + 1} × ${n} = ${(k + 1) * n}`).join('\n'), value: n };
		}
		if ((m = t.match(/\bcount (?:from (\d+) )?to (\d+)\b/))) {
			const from = Number(m[1] || 1);
			const to = Number(m[2]);
			if (Math.abs(to - from) > 100) return { text: 'I\'ll count up to 100 numbers at a time.' };
			const step = to >= from ? 1 : -1;
			const out = [];
			for (let k = from; step > 0 ? k <= to : k >= to; k += step) out.push(k);
			return { text: out.join(', ') + '.', value: to };
		}
		const expr = toExpression(raw, last);
		if (!expr) return null;
		try {
			const v = evaluate(expr);
			return { text: `${pretty(expr)} = **${format(v)}**`, value: v };
		} catch (err) {
			return { text: err.message };
		}
	}

	/** Spells a whole number in English words (up to the trillions). */
	function numberToWords(n) {
		if (!Number.isInteger(n) || Math.abs(n) >= 1e15) return null;
		if (n === 0) return 'zero';
		if (n < 0) return 'minus ' + numberToWords(-n);
		const small = Object.keys(UNITS).filter((w) => w !== 'oh');
		const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
		const chunk = (x) => {
			const out = [];
			if (x >= 100) out.push(small[Math.floor(x / 100)] + ' hundred');
			const r = x % 100;
			if (r) out.push(r < 20 ? small[r] : tens[Math.floor(r / 10)] + (r % 10 ? '-' + small[r % 10] : ''));
			return out.join(' and ');
		};
		const names = ['', ' thousand', ' million', ' billion', ' trillion'];
		const parts = [];
		let k = 0;
		while (n > 0) {
			const c = n % 1000;
			if (c) parts.unshift(chunk(c) + names[k]);
			n = Math.floor(n / 1000);
			k++;
		}
		return parts.join(', ');
	}

	Omni.onyxMath = { answer, evaluate, toExpression, wordsToNumber, numberToWords, digitize, isPrime };
})();
