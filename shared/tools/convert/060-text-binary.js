// No. 060 Text and binary converter: UTF-8 text to binary, hex, octal or decimal byte codes, and back.
Omni.register({
	no: 60,
	id: 'text-binary',
	name: 'Text and binary converter',
	category: 'convert',
	keywords: ['binary', 'text', 'hex', 'ascii', 'bytes', 'octal', 'decimal', 'encode'],
	description: 'Shows text as UTF-8 bytes in binary, hex, octal or decimal, and turns byte codes back into text.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Direction', type: 'seg', options: [{ value: 'encode', label: 'Text to codes' }, { value: 'decode', label: 'Codes to text' }], default: 'encode' },
		{ name: 'base', label: 'Code format', type: 'select', options: [{ value: '2', label: 'Binary' }, { value: '16', label: 'Hex' }, { value: '8', label: 'Octal' }, { value: '10', label: 'Decimal' }], default: '2' },
		{ name: 'text', label: 'Input', type: 'textarea', rows: 5, default: 'Hi!' },
	],
	run({ mode, base, text }) {
		const b = Number(base);
		const width = { 2: 8, 16: 2, 8: 3, 10: 0 }[b];
		if (mode === 'encode') {
			const bytes = Omni.bytes.utf8(text);
			return { text: Array.from(bytes, (x) => x.toString(b).padStart(width, '0')).join(' '), label: `${bytes.length} bytes` };
		}
		const tokens = text.trim().split(/[\s,]+/).filter(Boolean);
		// Binary without spaces is read 8 bits at a time.
		const parts = b === 2 && tokens.length === 1 && tokens[0].length > 8 ? tokens[0].match(/.{1,8}/g) : b === 16 && tokens.length === 1 && tokens[0].length > 2 ? tokens[0].replace(/^0x/i, '').match(/.{1,2}/g) : tokens;
		const bytes = parts.map((t) => {
			const n = parseInt(t.replace(/^0[xbo]/i, ''), b);
			if (Number.isNaN(n) || n > 255 || n < 0) throw new Error(`"${t}" is not a byte in base ${b}.`);
			return n;
		});
		return { text: Omni.bytes.fromUtf8(new Uint8Array(bytes)), label: 'Text' };
	},
});
