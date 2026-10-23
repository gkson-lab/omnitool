// No. 032 Password generator: character-set passwords with entropy shown on the gklabs scale.
Omni.register({
	no: 32,
	id: 'password',
	name: 'Password generator',
	category: 'generate',
	keywords: ['password', 'generate', 'secure', 'random', 'strong'],
	description: 'Random passwords from the character sets you choose, with their entropy. Generated on this device only.',
	action: 'Generate',
	remember: true,
	inputs: [
		{ name: 'length', label: 'Length', type: 'number', min: 4, max: 256, default: 20 },
		{ name: 'count', label: 'How many', type: 'number', min: 1, max: 100, default: 5 },
		{ name: 'lower', label: 'Lowercase a-z', type: 'checkbox', default: true },
		{ name: 'upper', label: 'Uppercase A-Z', type: 'checkbox', default: true },
		{ name: 'digits', label: 'Digits 0-9', type: 'checkbox', default: true },
		{ name: 'symbols', label: 'Symbols !@#...', type: 'checkbox', default: true },
		{ name: 'noAmbiguous', label: 'Skip look-alikes (Il1O0)', type: 'checkbox', default: false },
	],
	run({ length, count, lower, upper, digits, symbols, noAmbiguous }) {
		const sets = [lower && 'abcdefghijklmnopqrstuvwxyz', upper && 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits && '0123456789', symbols && '!@#$%^&*()-_=+[]{};:,.?/~'].filter(Boolean).map((s) => (noAmbiguous ? s.replace(/[Il1O0o]/g, '') : s));
		if (!sets.length) throw new Error('Tick at least one character set.');
		const len = Math.max(4, Math.min(256, Math.floor(length || 20)));
		if (len < sets.length) throw new Error(`Length must be at least ${sets.length} to include every chosen set.`);
		const all = sets.join('');
		const rand = Omni.random.source();
		const one = () => {
			// One character from each chosen set, the rest from all of them, then shuffled.
			const chars = sets.map((s) => s[Omni.random.int(rand, 0, s.length - 1)]);
			while (chars.length < len) chars.push(all[Omni.random.int(rand, 0, all.length - 1)]);
			return Omni.random.shuffle(rand, chars).join('');
		};
		const list = Array.from({ length: Math.max(1, Math.min(100, count || 1)) }, one);
		const bits = len * Math.log2(all.length);
		return {
			text: list.join('\n'),
			label: list.length === 1 ? 'Password' : 'Passwords',
			meter: { value: Math.min(1, bits / 128), label: 'Entropy (128 bits fills the scale)', text: `${Math.round(bits)} bits` },
			note: `${all.length} possible characters per position. Over 80 bits resists offline guessing for any practical attacker.`,
		};
	},
});
