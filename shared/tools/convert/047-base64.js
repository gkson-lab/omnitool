// No. 047 Base64 encoder: UTF-8 safe Base64 and Base64URL, both directions.
Omni.register({
	no: 47,
	id: 'base64',
	name: 'Base64 encoder',
	category: 'convert',
	keywords: ['base64', 'encode', 'decode', 'base64url', 'b64'],
	description: 'Encodes text to Base64 or Base64URL and decodes it back, with full UTF-8 support.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Mode', type: 'seg', options: [{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }], default: 'encode' },
		{ name: 'text', label: 'Input', type: 'textarea', rows: 6, default: 'OmniTool says hello, 你好, 👋' },
		{ name: 'urlsafe', label: 'URL-safe alphabet (Base64URL, no padding)', type: 'checkbox' },
	],
	run({ mode, text, urlsafe }) {
		const B = Omni.bytes;
		if (mode === 'encode') {
			let out = B.toBase64(B.utf8(text));
			if (urlsafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
			return { text: out, label: 'Base64', readings: [{ label: 'Input bytes', value: B.utf8(text).length, copy: false }, { label: 'Output length', value: out.length, copy: false }] };
		}
		const bytes = B.fromBase64(text);
		const decoded = new TextDecoder('utf-8', { fatal: true });
		try {
			return { text: decoded.decode(bytes), label: 'Decoded text' };
		} catch {
			return { text: B.toHex(bytes).replace(/(..)/g, '$1 ').trim(), label: 'Decoded bytes (hex)', note: 'The data is not UTF-8 text, so it is shown as hex.' };
		}
	},
});
