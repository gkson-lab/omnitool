// No. 033 Passphrase generator: random common words, easier to type and remember than a password.
Omni.register({
	no: 33,
	id: 'passphrase',
	name: 'Passphrase generator',
	category: 'generate',
	keywords: ['passphrase', 'diceware', 'words', 'password', 'memorable'],
	description: 'Passphrases made of random common English words, with separator, capitals and digit options.',
	action: 'Generate',
	inputs: [
		{ name: 'words', label: 'Words', type: 'number', min: 3, max: 12, default: 5 },
		{ name: 'count', label: 'How many', type: 'number', min: 1, max: 50, default: 5 },
		{ name: 'separator', label: 'Separator', type: 'select', options: [{ value: '-', label: 'Hyphen' }, { value: ' ', label: 'Space' }, { value: '.', label: 'Dot' }, { value: '_', label: 'Underscore' }, { value: '', label: 'None' }], default: '-' },
		{ name: 'capitalize', label: 'Capitalize each word', type: 'checkbox', default: false },
		{ name: 'digit', label: 'Add a digit', type: 'checkbox', default: false },
	],
	run({ words, count, separator, capitalize, digit }) {
		const list = Omni.words.common;
		const rand = Omni.random.source();
		const n = Math.max(3, Math.min(12, Math.floor(words || 5)));
		const make = () => {
			const ws = Array.from({ length: n }, () => Omni.random.pick(rand, list)).map((w) => (capitalize ? w[0].toUpperCase() + w.slice(1) : w));
			if (digit) {
				const i = Omni.random.int(rand, 0, ws.length - 1);
				ws[i] += Omni.random.int(rand, 0, 9);
			}
			return ws.join(separator);
		};
		const out = Array.from({ length: Math.max(1, Math.min(50, count || 1)) }, make);
		const bits = n * Math.log2(list.length) + (digit ? Math.log2(10 * n) : 0);
		return {
			text: out.join('\n'),
			label: out.length === 1 ? 'Passphrase' : 'Passphrases',
			meter: { value: Math.min(1, bits / 128), label: 'Entropy (128 bits fills the scale)', text: `${Math.round(bits)} bits` },
			note: `Chosen from ${list.length} words, so each word adds ${Math.log2(list.length).toFixed(1)} bits.`,
		};
	},
});
