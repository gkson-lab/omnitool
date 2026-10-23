// No. 087 Hash generator: MD5, SHA-1, SHA-256, SHA-384, SHA-512 and CRC32 of text, all at once.
Omni.register({
	no: 87,
	id: 'hash',
	name: 'Hash generator',
	category: 'text',
	keywords: ['hash', 'md5', 'sha1', 'sha256', 'sha512', 'crc32', 'checksum', 'digest'],
	description: 'Computes MD5, SHA-1, SHA-256, SHA-384, SHA-512 and CRC32 of text (UTF-8). MD5 and SHA-1 are for checksums only, not security.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Text', type: 'textarea', rows: 5, default: 'hello' },
		{ name: 'upper', label: 'Uppercase hex', type: 'checkbox' },
		{ name: 'base64', label: 'Show as Base64 instead of hex', type: 'checkbox' },
	],
	async run({ text, upper, base64 }) {
		const B = Omni.bytes;
		const data = B.utf8(text);
		const hexes = {
			MD5: B.md5(data),
			'SHA-1': await B.sha('SHA-1', data),
			'SHA-256': await B.sha('SHA-256', data),
			'SHA-384': await B.sha('SHA-384', data),
			'SHA-512': await B.sha('SHA-512', data),
			CRC32: B.crc32(data),
		};
		const show = (hex) => (base64 ? B.toBase64(B.fromHex(hex)) : upper ? hex.toUpperCase() : hex);
		return { readings: Object.entries(hexes).map(([label, hex]) => ({ label, value: show(hex) })), note: `${data.length} bytes of UTF-8 input.` };
	},
});
