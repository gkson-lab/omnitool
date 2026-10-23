// No. 020 JWT decoder: header and payload, time claims, and optional HMAC signature verification.
Omni.register({
	no: 20,
	id: 'jwt-decoder',
	name: 'JWT decoder',
	category: 'code',
	keywords: ['jwt', 'token', 'json web token', 'decode', 'auth', 'bearer'],
	description: 'Decodes a JSON Web Token, explains its time claims and, for HS256/384/512, verifies the signature with a secret you provide.',
	live: true,
	inputs: [
		{ name: 'token', label: 'Token', type: 'textarea', mono: true, rows: 5, default: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.uRpG-1fbxaWEOoydffVNQ4njNsWRBsxBCs8AKtQ3PR0' },
		{ name: 'secret', label: 'Secret for HS signature check (optional)', type: 'password', remember: false, placeholder: 'Never leaves this device' },
	],
	async run({ token, secret }) {
		const B = Omni.bytes;
		const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
		if (parts.length < 2) throw new Error('A JWT has three parts separated by dots.');
		const decode = (p, what) => {
			try {
				return JSON.parse(B.fromUtf8(B.fromBase64(p)));
			} catch {
				throw new Error(`The ${what} is not Base64URL-encoded JSON.`);
			}
		};
		const header = decode(parts[0], 'header');
		const payload = decode(parts[1], 'payload');
		const now = Date.now() / 1000;
		const when = (t) => (typeof t === 'number' ? `${new Date(t * 1000).toLocaleString()} (${t})` : null);
		const readings = [
			{ label: 'Algorithm', value: header.alg || '-', copy: false },
			{ label: 'Type', value: header.typ || '-', copy: false },
			{ label: 'Issued at', value: when(payload.iat), copy: false },
			{ label: 'Not before', value: when(payload.nbf), copy: false },
			{ label: 'Expires', value: payload.exp ? `${when(payload.exp)}, ${payload.exp < now ? 'expired' : 'still valid'}` : 'no expiry', copy: false },
			{ label: 'Subject', value: payload.sub },
			{ label: 'Issuer', value: payload.iss },
		];
		let verdict = 'Not checked. Enter the secret to verify an HS256, HS384 or HS512 token.';
		if (secret && /^HS(256|384|512)$/.test(header.alg || '')) {
			const algo = 'SHA-' + header.alg.slice(2);
			const sig = await B.hmac(algo, B.utf8(secret), B.utf8(parts[0] + '.' + parts[1]));
			const expected = B.toBase64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
			verdict = expected === parts[2] ? 'Valid: the signature matches this secret.' : 'Invalid: the signature does not match this secret.';
		} else if (secret) verdict = `Cannot check ${header.alg} here; only HS256, HS384 and HS512 use a shared secret.`;
		readings.push({ label: 'Signature', value: verdict, copy: false });
		return { readings, blocks: [{ type: 'text', label: 'Header', value: JSON.stringify(header, null, 2) }, { type: 'text', label: 'Payload', value: JSON.stringify(payload, null, 2) }] };
	},
});
