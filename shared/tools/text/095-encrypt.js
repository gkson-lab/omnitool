// No. 095 Text encryption: AES-256-GCM with a PBKDF2-derived key, so you can share a secret over an untrusted channel.
Omni.register({
	no: 95,
	id: 'encrypt',
	name: 'Text encryption',
	category: 'text',
	keywords: ['encrypt', 'decrypt', 'aes', 'cipher', 'secret', 'password', 'protect'],
	description: 'Encrypts text with a passphrase (AES-256-GCM, PBKDF2 with 310,000 rounds) and decrypts it again. Everything happens on this device.',
	action: 'Run',
	inputs: [
		{ name: 'mode', label: 'Mode', type: 'seg', options: [{ value: 'encrypt', label: 'Encrypt' }, { value: 'decrypt', label: 'Decrypt' }], default: 'encrypt' },
		{ name: 'text', label: 'Text', type: 'textarea', rows: 6, remember: false, placeholder: 'Plain text to encrypt, or omni1. ciphertext to decrypt' },
		{ name: 'passphrase', label: 'Passphrase', type: 'password', remember: false, hint: 'Share it separately from the ciphertext. Lost passphrases cannot be recovered.' },
	],
	ai: false,
	async run({ mode, text, passphrase }) {
		if (!text) return { note: 'Type the text first.' };
		if (!passphrase || passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
		if (mode === 'encrypt') return { text: await Omni.bytes.encrypt(text, passphrase), label: 'Ciphertext (send this; the passphrase goes separately)' };
		return { text: await Omni.bytes.decrypt(text, passphrase), label: 'Decrypted text' };
	},
});
