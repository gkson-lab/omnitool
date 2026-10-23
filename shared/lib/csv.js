// CSV parsing and writing (RFC 4180 quotes, any delimiter, newlines inside quotes).
(function () {
	'use strict';

	/** Guesses the delimiter from the first line: the candidate that appears most outside quotes. */
	function sniff(text) {
		const first = text.split(/\r?\n/, 1)[0] || '';
		let best = ',';
		let bestCount = 0;
		for (const d of [',', ';', '\t', '|']) {
			let count = 0;
			let quoted = false;
			for (const c of first) {
				if (c === '"') quoted = !quoted;
				else if (c === d && !quoted) count++;
			}
			if (count > bestCount) {
				best = d;
				bestCount = count;
			}
		}
		return best;
	}

	function parse(text, delimiter) {
		const d = delimiter || sniff(text);
		const rows = [];
		let row = [];
		let cell = '';
		let quoted = false;
		for (let i = 0; i < text.length; i++) {
			const c = text[i];
			if (quoted) {
				if (c === '"') {
					if (text[i + 1] === '"') {
						cell += '"';
						i++;
					} else quoted = false;
				} else cell += c;
			} else if (c === '"' && cell === '') quoted = true;
			else if (c === d) {
				row.push(cell);
				cell = '';
			} else if (c === '\n' || c === '\r') {
				if (c === '\r' && text[i + 1] === '\n') i++;
				row.push(cell);
				rows.push(row);
				row = [];
				cell = '';
			} else cell += c;
		}
		if (quoted) throw new Error('A quoted field is never closed');
		if (cell !== '' || row.length) {
			row.push(cell);
			rows.push(row);
		}
		return { rows: rows.filter((r) => !(r.length === 1 && r[0] === '')), delimiter: d };
	}

	function stringify(rows, delimiter) {
		const d = delimiter || ',';
		const cell = (v) => {
			const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
			return s.includes(d) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};
		return rows.map((r) => r.map(cell).join(d)).join('\n');
	}

	/** Converts "42", "true" and "" to numbers, booleans and null when asked. */
	function typed(v) {
		if (v === '') return null;
		if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return Number(v);
		if (v === 'true' || v === 'false') return v === 'true';
		return v;
	}

	Omni.csv = { parse, stringify, sniff, typed };
})();
