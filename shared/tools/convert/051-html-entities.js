// No. 051 HTML entity converter: escape text for HTML and decode any named or numeric entity.
Omni.register({
	no: 51,
	id: 'html-entities',
	name: 'HTML entity converter',
	category: 'convert',
	keywords: ['html', 'entities', 'escape', 'unescape', 'encode', 'amp', 'nbsp'],
	description: 'Escapes text for safe use in HTML and decodes named (&copy;) and numeric (&#169;) entities.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Mode', type: 'seg', options: [{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }], default: 'encode' },
		{ name: 'text', label: 'Input', type: 'textarea', rows: 6, default: '<a href="/?a=1&b=2">Tom & Jerry\'s © 2026</a>' },
		{ name: 'all', label: 'Also encode every non-ASCII character', type: 'checkbox', when: (v) => v.mode === 'encode' },
	],
	run({ mode, text, all }) {
		if (mode === 'encode') {
			let out = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
			if (all) out = out.replace(/[^\x00-\x7f]/gu, (c) => `&#${c.codePointAt(0)};`);
			return { text: out, label: 'Encoded' };
		}
		// A detached textarea decodes every entity the browser knows without running any markup.
		const ta = document.createElement('textarea');
		ta.innerHTML = text;
		return { text: ta.value, label: 'Decoded' };
	},
});
