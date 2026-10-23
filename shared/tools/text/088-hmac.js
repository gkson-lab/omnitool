// No. 088 HMAC generator: keyed hashes with SHA-1, SHA-256, SHA-384 or SHA-512 (for webhook signatures and APIs).
Omni.register({
	no: 88,
	id: 'hmac',
	name: 'HMAC generator',
	category: 'text',
	keywords: ['hmac', 'signature', 'webhook', 'sha256', 'keyed hash', 'mac', 'verify'],
	description: 'Computes an HMAC of a message with a secret key, and checks it against a signature you paste (for example a webhook header).',
	live: true,
	inputs: [
		{ name: 'message', label: 'Message', type: 'textarea', rows: 5, default: '{"event":"push","id":42}' },
		{ name: 'key', label: 'Secret key', type: 'password', remember: false, default: 'demo-secret' },
		{ name: 'keyFormat', label: 'Key is', type: 'select', options: [{ value: 'text', label: 'Text' }, { value: 'hex', label: 'Hex' }, { value: 'base64', label: 'Base64' }], default: 'text' },
		{ name: 'algo', label: 'Hash', type: 'select', options: ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512'], default: 'SHA-256' },
		{ name: 'expected', label: 'Signature to check (optional)', type: 'text', mono: true, placeholder: 'sha256=... or the bare hex/Base64' },
	],
	async run({ message, key, keyFormat, algo, expected }) {
		const B = Omni.bytes;
		if (!key) return { note: 'Enter the secret key.' };
		const keyBytes = keyFormat === 'hex' ? B.fromHex(key) : keyFormat === 'base64' ? B.fromBase64(key) : B.utf8(key);
		const mac = await B.hmac(algo, keyBytes, B.utf8(message));
		const hex = B.toHex(mac);
		const b64 = B.toBase64(mac);
		const readings = [{ label: 'Hex', value: hex }, { label: 'Base64', value: b64 }, { label: 'GitHub-style header', value: `${algo.replace('-', '').toLowerCase()}=${hex}` }];
		if (expected && expected.trim()) {
			const e = expected.trim().replace(/^sha\d+=/i, '');
			const match = e.toLowerCase() === hex || e === b64 || e.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '') === b64.replace(/=+$/, '');
			readings.push({ label: 'Matches the pasted signature', value: match ? 'Yes' : 'No', copy: false });
		}
		return { readings };
	},
});
