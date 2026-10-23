// No. 044 Number base converter: any base 2 to 36, arbitrary size (BigInt), with grouping for binary and hex.
Omni.register({
	no: 44,
	id: 'base-converter',
	name: 'Number base converter',
	category: 'convert',
	keywords: ['binary', 'hex', 'hexadecimal', 'octal', 'decimal', 'base', 'radix', 'bin'],
	description: 'Converts whole numbers of any size between binary, octal, decimal, hex and any base from 2 to 36.',
	live: true,
	inputs: [
		{ name: 'value', label: 'Number', type: 'text', mono: true, default: '255' },
		{ name: 'from', label: 'From base', type: 'select', options: [{ value: '2', label: 'Binary (2)' }, { value: '8', label: 'Octal (8)' }, { value: '10', label: 'Decimal (10)' }, { value: '16', label: 'Hex (16)' }, { value: 'custom', label: 'Other' }], default: '10' },
		{ name: 'fromCustom', label: 'Other base', type: 'number', min: 2, max: 36, default: 36, when: (v) => v.from === 'custom' },
		{ name: 'to', label: 'Also show base', type: 'number', min: 2, max: 36, default: 36 },
	],
	run({ value, from, fromCustom, to }) {
		const base = from === 'custom' ? Number(fromCustom) : Number(from);
		if (!(base >= 2 && base <= 36)) throw new Error('Bases go from 2 to 36.');
		let s = String(value).trim().toLowerCase().replace(/[\s_]/g, '');
		const neg = s.startsWith('-');
		if (neg) s = s.slice(1);
		s = s.replace(base === 16 ? /^0x/ : base === 2 ? /^0b/ : base === 8 ? /^0o/ : /^$/, '');
		if (!s) return { note: 'Type a number.' };
		const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
		let n = 0n;
		for (const ch of s) {
			const d = digits.indexOf(ch);
			if (d === -1) throw new Error(`"${ch}" is not a digit in base ${base}. Valid digits: ${digits}.`);
			n = n * BigInt(base) + BigInt(d);
		}
		const sign = neg ? '-' : '';
		const group = (str, size) => str.replace(new RegExp(`\\B(?=(.{${size}})+$)`, 'g'), ' ');
		const t = Math.max(2, Math.min(36, Number(to) || 36));
		const bin = n.toString(2);
		return {
			readings: [
				{ label: 'Decimal', value: sign + n.toString(10) },
				{ label: 'Hex', value: sign + n.toString(16).toUpperCase() },
				{ label: 'Octal', value: sign + n.toString(8) },
				{ label: 'Binary', value: sign + bin },
				{ label: `Base ${t}`, value: sign + n.toString(t) },
				{ label: 'Bits needed', value: n === 0n ? 1 : bin.length, copy: false },
			],
			text: `${sign}${group(bin.padStart(Math.ceil(bin.length / 4) * 4, '0'), 4)}`,
			label: 'Binary in nibbles',
		};
	},
});
