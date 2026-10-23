// No. 096 Password strength checker: entropy that accounts for patterns, words and repeats, plus a crack-time estimate.
Omni.register({
	no: 96,
	id: 'password-strength',
	name: 'Password strength checker',
	category: 'text',
	keywords: ['password', 'strength', 'entropy', 'check', 'secure', 'crack time'],
	description: 'Estimates how hard a password is to guess, lists what weakens it, and shows guessing time. Nothing leaves this device.',
	live: true,
	ai: false,
	inputs: [{ name: 'password', label: 'Password', type: 'password', remember: false, placeholder: 'Type a password to check' }],
	run({ password }) {
		const p = password || '';
		if (!p) return { note: 'Type a password. It is not stored or sent anywhere.' };
		let pool = 0;
		if (/[a-z]/.test(p)) pool += 26;
		if (/[A-Z]/.test(p)) pool += 26;
		if (/\d/.test(p)) pool += 10;
		if (/[^A-Za-z0-9]/.test(p)) pool += 33;
		let bits = p.length * Math.log2(pool || 1);
		const issues = [];
		const lower = p.toLowerCase();
		const common = ['password', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'abc123', 'login', 'master', 'sunshine', 'princess', 'shadow', '123456', '111111', 'passw0rd', 'trustno1'];
		if (common.some((c) => lower.replace(/[@4]/g, 'a').replace(/0/g, 'o').replace(/[1!]/g, 'i').replace(/3/g, 'e').replace(/[$5]/g, 's').includes(c))) {
			bits = Math.min(bits, 14);
			issues.push('Contains one of the most common passwords (even with letter swaps like @ for a).');
		}
		if (/(.)\1{2,}/.test(p)) {
			bits -= 6;
			issues.push('Repeats the same character three or more times.');
		}
		const seqs = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiopasdfghjklzxcvbnm'];
		const hasSeq = seqs.some((s) => {
			for (let i = 0; i + 4 <= s.length; i++) if (lower.includes(s.slice(i, i + 4)) || lower.includes([...s.slice(i, i + 4)].reverse().join(''))) return true;
			return false;
		});
		if (hasSeq) {
			bits -= 10;
			issues.push('Contains a run like abcd, 1234 or qwer.');
		}
		if (/(19|20)\d{2}/.test(p)) {
			bits -= 6;
			issues.push('Contains a year, which guessers try early.');
		}
		const dictHits = Omni.words.common.filter((w) => w.length >= 4 && lower.includes(w));
		if (dictHits.length && !/[^A-Za-z]/.test(p.replace(new RegExp(dictHits.join('|'), 'gi'), ''))) {
			bits = Math.min(bits, dictHits.length * 11 + 4);
			issues.push(`Made of dictionary words (${dictHits.slice(0, 4).join(', ')}); guessers try word lists before random characters.`);
		}
		if (p.length < 12) issues.push('Shorter than 12 characters.');
		bits = Math.max(0, bits);
		// Offline attack on a fast hash at 10 billion guesses per second; half the space on average.
		const seconds = 2 ** bits / 2 / 1e10;
		const human = seconds < 1 ? 'instantly' : seconds < 3600 ? `${Math.ceil(seconds / 60)} minutes` : seconds < 86400 * 365 ? `${Math.ceil(seconds / 86400)} days` : seconds < 86400 * 365 * 1e6 ? `${Math.round(seconds / 86400 / 365).toLocaleString()} years` : 'more than a million years';
		const verdict = bits < 28 ? 'Very weak' : bits < 45 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Very strong';
		return {
			meter: { value: Math.min(1, bits / 100), label: `Strength: ${verdict}`, text: `${Math.round(bits)} bits` },
			readings: [{ label: 'Length', value: p.length, copy: false }, { label: 'Character pool', value: pool, copy: false }, { label: 'Guessing time (10 billion tries a second)', value: human, copy: false }],
			table: issues.length ? { label: 'What weakens it', columns: ['Issue'], rows: issues.map((i) => [i]) } : null,
			note: issues.length ? null : 'No common weaknesses found.',
		};
	},
});
