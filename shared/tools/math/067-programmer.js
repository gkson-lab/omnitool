// No. 067 Programmer calculator: bitwise operations in 8 to 64 bits, signed or unsigned, with a clickable bit grid.
(function () {
	'use strict';

	function parseIn(s) {
		const t = String(s).trim().toLowerCase().replace(/[_\s]/g, '');
		if (!t) return 0n;
		const neg = t.startsWith('-');
		const b = neg ? t.slice(1) : t;
		let v;
		if (/^0x[0-9a-f]+$/.test(b)) v = BigInt(b);
		else if (/^0b[01]+$/.test(b)) v = BigInt(b);
		else if (/^0o[0-7]+$/.test(b)) v = BigInt(b);
		else if (/^\d+$/.test(b)) v = BigInt(b);
		else throw new Error(`"${s}" is not a number. Use decimal, 0x hex, 0b binary or 0o octal.`);
		return neg ? -v : v;
	}

	function compute({ a, op, b, bits, signed }) {
		const w = BigInt(bits);
		const mask = (1n << w) - 1n;
		const x = parseIn(a) & mask;
		const y = parseIn(b) & mask;
		const r = {
			and: x & y, or: x | y, xor: x ^ y, not: ~x, nand: ~(x & y), nor: ~(x | y),
			shl: x << (y % w), shr: x >> (y % w), sar: (BigInt.asIntN(Number(w), x) >> (y % w)),
			rol: (x << (y % w)) | (x >> ((w - (y % w)) % w)), ror: (x >> (y % w)) | (x << ((w - (y % w)) % w)),
			add: x + y, sub: x - y, mul: x * y, div: y === 0n ? null : (signed ? BigInt.asIntN(Number(w), x) / BigInt.asIntN(Number(w), y) : x / y), mod: y === 0n ? null : x % y,
		}[op];
		if (r === null) throw new Error('Division by zero.');
		const u = r & mask;
		const s = BigInt.asIntN(Number(w), u);
		return { unsigned: u, signed: s, value: signed ? s : u, bits: Number(w) };
	}

	Omni.programmer = { compute, parseIn };
	const OPS = [['and', 'a AND b'], ['or', 'a OR b'], ['xor', 'a XOR b'], ['not', 'NOT a'], ['nand', 'a NAND b'], ['nor', 'a NOR b'], ['shl', 'a << b'], ['shr', 'a >> b (logical)'], ['sar', 'a >> b (arithmetic)'], ['rol', 'rotate a left by b'], ['ror', 'rotate a right by b'], ['add', 'a + b'], ['sub', 'a - b'], ['mul', 'a * b'], ['div', 'a / b'], ['mod', 'a mod b']];

	Omni.register({
		no: 67,
		id: 'programmer',
		name: 'Programmer calculator',
		category: 'math',
		keywords: ['programmer', 'bitwise', 'and', 'or', 'xor', 'shift', 'hex', 'binary', 'two\'s complement', 'bits'],
		description: 'Bitwise and integer math at 8, 16, 32 or 64 bits, signed or unsigned, shown in hex, decimal, octal and binary with a clickable bit grid.',
		inputs: [
			{ name: 'a', label: 'a', type: 'text', mono: true, default: '0xF0' },
			{ name: 'op', label: 'Operation', type: 'select', options: OPS.map(([value, label]) => ({ value, label })), default: 'xor' },
			{ name: 'b', label: 'b', type: 'text', mono: true, default: '0b10101010', when: (v) => v.op !== 'not' },
			{ name: 'bits', label: 'Word size', type: 'select', options: ['8', '16', '32', '64'], default: '32' },
			{ name: 'signed', label: 'Signed (two\'s complement)', type: 'checkbox', default: true },
		],
		live: true,
		run(args) {
			const r = compute(args);
			const { h } = Omni;
			const bin = r.unsigned.toString(2).padStart(r.bits, '0');
			const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: '4px' } },
				bin.split('').map((bit, i) => {
					const pos = r.bits - 1 - i;
					return h('button', { type: 'button', class: 'btn btn-small', title: `bit ${pos}`, 'aria-label': `Bit ${pos} is ${bit}. Toggle and use as a.`, 'aria-pressed': String(bit === '1'), style: { padding: 0, fontFamily: 'var(--font-mono)', background: bit === '1' ? 'var(--ink)' : '', color: bit === '1' ? 'var(--paper)' : '' }, onclick: () => {
						Omni.open('programmer', { ...args, a: '0x' + (r.unsigned ^ (1n << BigInt(pos))).toString(16), op: 'or', b: '0' });
					} }, bit);
				}));
			return {
				readings: [
					{ label: 'Hex', value: '0x' + r.unsigned.toString(16).toUpperCase().padStart(r.bits / 4, '0') },
					{ label: 'Decimal', value: r.value.toString() },
					{ label: args.signed ? 'Unsigned' : 'Signed', value: (args.signed ? r.unsigned : r.signed).toString() },
					{ label: 'Octal', value: '0o' + r.unsigned.toString(8) },
					{ label: 'Binary', value: bin.replace(/(.{4})(?=.)/g, '$1 ') },
					{ label: 'Bits set', value: bin.split('').filter((c) => c === '1').length, copy: false },
				],
				blocks: [{ type: 'node', node: Omni.forms.block('Bits (click one to flip it into a)', grid) }],
			};
		},
	});
})();
