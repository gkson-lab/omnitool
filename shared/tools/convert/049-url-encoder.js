// No. 049 URL encoder: percent-encoding for a URL component or a whole URL, both directions.
Omni.register({
	no: 49,
	id: 'url-encoder',
	name: 'URL encoder',
	category: 'convert',
	keywords: ['url', 'encode', 'decode', 'percent', 'uri', 'escape', 'query'],
	description: 'Percent-encodes and decodes text, either as one URL component (query values) or as a full URL.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Mode', type: 'seg', options: [{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }], default: 'encode' },
		{ name: 'scope', label: 'Treat input as', type: 'select', options: [{ value: 'component', label: 'One component (encodes / ? & =)' }, { value: 'full', label: 'A whole URL (keeps / ? & =)' }], default: 'component' },
		{ name: 'text', label: 'Input', type: 'textarea', rows: 4, default: 'name=Ada Lovelace & role=engineer/lead' },
		{ name: 'plus', label: 'Spaces as + (form encoding)', type: 'checkbox' },
	],
	run({ mode, scope, text, plus }) {
		if (mode === 'encode') {
			let out = scope === 'full' ? encodeURI(text) : encodeURIComponent(text);
			if (plus) out = out.replace(/%20/g, '+');
			return { text: out, label: 'Encoded' };
		}
		try {
			const src = plus ? text.replace(/\+/g, ' ') : text;
			return { text: scope === 'full' ? decodeURI(src) : decodeURIComponent(src), label: 'Decoded' };
		} catch {
			throw new Error('The input has a broken % sequence (a % must be followed by two hex digits).');
		}
	},
});
