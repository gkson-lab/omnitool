// No. 061 Unicode inspector: code point, category, UTF-8 and UTF-16 units and escapes for every character.
Omni.register({
	no: 61,
	id: 'unicode',
	name: 'Unicode inspector',
	category: 'convert',
	keywords: ['unicode', 'utf8', 'utf-16', 'code point', 'emoji', 'character', 'escape', 'invisible'],
	description: 'Lists each character\'s code point, general category, UTF-8 bytes and escapes. Finds invisible and look-alike characters.',
	live: true,
	inputs: [{ name: 'text', label: 'Text', type: 'textarea', rows: 4, default: 'Café ✓ 👋🏽​!' }],
	run({ text }) {
		const cats = [['Lu', /\p{Lu}/u, 'uppercase letter'], ['Ll', /\p{Ll}/u, 'lowercase letter'], ['Lo', /\p{L}/u, 'letter'], ['Mn', /\p{M}/u, 'combining mark'], ['Nd', /\p{Nd}/u, 'digit'], ['N', /\p{N}/u, 'number'], ['P', /\p{P}/u, 'punctuation'], ['Sm', /\p{Sm}/u, 'math symbol'], ['Sc', /\p{Sc}/u, 'currency symbol'], ['So', /\p{Extended_Pictographic}/u, 'emoji or pictograph'], ['S', /\p{S}/u, 'symbol'], ['Zs', /\p{Zs}/u, 'space'], ['Cf', /\p{Cf}/u, 'format (invisible)'], ['Cc', /\p{Cc}/u, 'control']];
		const chars = [...text];
		if (chars.length > 2000) throw new Error('Inspect up to 2000 characters at a time.');
		const rows = chars.map((ch) => {
			const cp = ch.codePointAt(0);
			const cat = cats.find(([, re]) => re.test(ch));
			const utf8 = Array.from(Omni.bytes.utf8(ch), (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
			const utf16 = Array.from({ length: ch.length }, (_, i) => ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join(' ');
			const shown = /\p{Cf}|\p{Cc}|\p{Zs}/u.test(ch) ? '(invisible)' : ch;
			return [shown, `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, cat ? cat[2] : 'other', utf8, utf16, cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`, `&#${cp};`];
		});
		const invisible = rows.filter((r) => r[0] === '(invisible)' && r[1] !== 'U+0020').length;
		return {
			readings: [{ label: 'Characters (code points)', value: chars.length, copy: false }, { label: 'UTF-16 units (JS length)', value: text.length, copy: false }, { label: 'UTF-8 bytes', value: Omni.bytes.utf8(text).length, copy: false }, { label: 'Invisible characters', value: invisible, copy: false }],
			table: { columns: ['Char', 'Code point', 'Category', 'UTF-8', 'UTF-16', 'JS escape', 'HTML'], rows },
		};
	},
});
