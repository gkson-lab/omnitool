// No. 014 Regex explainer: splits a pattern into tokens and says what each one does.
(function () {
	'use strict';

	const ESCAPES = {
		d: 'a digit (0 to 9)', D: 'any character except a digit', w: 'a word character (letter, digit or underscore)', W: 'any character except a word character',
		s: 'whitespace (space, tab, newline)', S: 'any character except whitespace', b: 'a word boundary', B: 'not a word boundary',
		n: 'a newline', r: 'a carriage return', t: 'a tab', f: 'a form feed', v: 'a vertical tab', 0: 'the NUL character',
	};

	function quantifierText(q) {
		const lazy = q.endsWith('?') && q.length > 1 ? ', as few times as possible' : '';
		const base = lazy ? q.slice(0, -1) : q;
		if (base === '*') return `zero or more times${lazy}`;
		if (base === '+') return `one or more times${lazy}`;
		if (base === '?') return 'optional (zero or one time)';
		const m = base.match(/^\{(\d+)(,(\d*))?\}$/);
		if (!m) return base;
		if (!m[2]) return `exactly ${m[1]} times`;
		if (m[3] === '') return `${m[1]} or more times${lazy}`;
		return `between ${m[1]} and ${m[3]} times${lazy}`;
	}

	function explain(src) {
		const rows = [];
		let i = 0;
		let depth = 0;
		const push = (token, text) => rows.push([token, '  '.repeat(depth) + text]);
		while (i < src.length) {
			const c = src[i];
			let token = c;
			let text;
			if (c === '\\') {
				const n = src[i + 1];
				if (n === undefined) throw new Error('The pattern ends with a lone backslash');
				if (/[1-9]/.test(n)) {
					const num = src.slice(i + 1).match(/^\d+/)[0];
					token = '\\' + num;
					text = `the same text group ${num} matched`;
				} else if (n === 'k' && src[i + 2] === '<') {
					token = src.slice(i).match(/^\\k<[^>]+>/)[0];
					text = `the same text the group named "${token.slice(3, -1)}" matched`;
				} else if (n === 'u' || n === 'x') {
					token = src.slice(i).match(n === 'u' ? /^\\u(\{[0-9a-f]+\}|[0-9a-f]{4})/i : /^\\x[0-9a-f]{2}/i)[0];
					text = `the character U+${token.replace(/^\\[ux]\{?|\}$/g, '').toUpperCase().padStart(4, '0')}`;
				} else if (n === 'p' || n === 'P') {
					token = src.slice(i).match(/^\\[pP]\{[^}]+\}/)[0];
					text = `${n === 'P' ? 'any character not in' : 'a character in'} the Unicode class ${token.slice(3, -1)}`;
				} else {
					token = '\\' + n;
					text = ESCAPES[n] || `the literal character "${n}"`;
				}
			} else if (c === '[') {
				let j = i + 1;
				if (src[j] === '^') j++;
				if (src[j] === ']') j++;
				while (j < src.length && src[j] !== ']') j += src[j] === '\\' ? 2 : 1;
				if (j >= src.length) throw new Error('A [ character set is never closed');
				token = src.slice(i, j + 1);
				const negate = token[1] === '^';
				const inner = token.slice(negate ? 2 : 1, -1);
				const parts = [];
				for (let k = 0; k < inner.length; k++) {
					let a = inner[k];
					if (a === '\\') a = inner[k] + inner[++k];
					if (inner[k + 1] === '-' && inner[k + 2] !== undefined) {
						let b = inner[k + 2];
						k += 2;
						if (b === '\\') b = b + inner[++k];
						parts.push(`${a} to ${b}`);
					} else parts.push(a.length > 1 && ESCAPES[a[1]] ? ESCAPES[a[1]] : `"${a}"`);
				}
				text = `${negate ? 'any one character except' : 'one character from'}: ${parts.join(', ')}`;
				i = j;
			} else if (c === '(') {
				const look = src.slice(i).match(/^\((\?:|\?=|\?!|\?<=|\?<!|\?<[A-Za-z_]\w*>)?/)[0];
				token = look;
				text = { '(': 'start of capture group', '(?:': 'start of group (not captured)', '(?=': 'start of lookahead: followed by', '(?!': 'start of negative lookahead: not followed by', '(?<=': 'start of lookbehind: preceded by', '(?<!': 'start of negative lookbehind: not preceded by' }[look] || `start of capture group named "${look.slice(3, -1)}"`;
				i += look.length - 1;
				push(token, text);
				depth++;
				i++;
				continue;
			} else if (c === ')') {
				depth = Math.max(0, depth - 1);
				text = 'end of group';
			} else if (c === '|') text = 'or';
			else if (c === '^') text = 'start of the string (or line with the m flag)';
			else if (c === '$') text = 'end of the string (or line with the m flag)';
			else if (c === '.') text = 'any character except a newline (any at all with the s flag)';
			else if ('*+?{'.includes(c)) {
				const q = src.slice(i).match(/^(\*|\+|\?|\{\d+(,\d*)?\})\??/);
				if (!q) {
					token = c;
					text = `the literal character "${c}"`;
				} else {
					token = q[0];
					text = `repeat the previous item ${quantifierText(q[0])}`;
					i += q[0].length - 1;
				}
			} else text = `the literal character "${c}"`;
			push(token, text);
			i++;
		}
		if (depth) throw new Error('A ( group is never closed');
		return rows;
	}

	Omni.register({
		no: 14,
		id: 'regex-explainer',
		name: 'Regex explainer',
		category: 'code',
		keywords: ['regex', 'explain', 'regular expression', 'pattern', 'meaning'],
		description: 'Breaks a regular expression into its parts and explains each one in plain English.',
		live: true,
		inputs: [{ name: 'pattern', label: 'Pattern', type: 'text', mono: true, default: '^(?<user>[\\w.+-]+)@([a-z\\d-]+\\.)+[a-z]{2,}$' }],
		run({ pattern }) {
			const src = pattern.replace(/^\/(.*)\/[a-z]*$/s, '$1');
			if (!src) return { note: 'Type a pattern.' };
			new RegExp(src);
			return { table: { label: 'Token by token', columns: ['Token', 'Meaning'], rows: explain(src) } };
		},
	});
})();
