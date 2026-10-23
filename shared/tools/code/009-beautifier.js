// No. 009 Code beautifier for JavaScript, CSS and HTML (js-beautify).
Omni.register({
	no: 9,
	id: 'beautifier',
	name: 'Code beautifier',
	category: 'code',
	keywords: ['format', 'beautify', 'prettify', 'indent', 'javascript', 'css', 'html'],
	description: 'Formats JavaScript, CSS and HTML with your indent settings.',
	vendor: ['beautify.js', 'beautify-css.js', 'beautify-html.js'],
	action: 'Format',
	inputs: [
		{ name: 'language', label: 'Language', type: 'seg', options: [{ value: 'js', label: 'JavaScript' }, { value: 'css', label: 'CSS' }, { value: 'html', label: 'HTML' }], default: 'js' },
		{ name: 'code', label: 'Code', type: 'textarea', mono: true, rows: 12, default: 'function sum(a,b){if(a==null){return b}return a+b}const total=[1,2,3].reduce((s,x)=>sum(s,x),0);console.log(total)' },
		{ name: 'indent', label: 'Indent size', type: 'select', options: ['2', '4', 'tab'], default: '2' },
		{ name: 'braces', label: 'Brace style', type: 'select', options: [{ value: 'collapse', label: 'Same line' }, { value: 'expand', label: 'Next line' }, { value: 'end-expand', label: 'End on next line' }], default: 'collapse', when: (v) => v.language !== 'html' },
		{ name: 'maxLine', label: 'Wrap lines at', type: 'number', min: 0, max: 400, default: 100, hint: '0 turns wrapping off' },
	],
	run({ language, code, indent, braces, maxLine }) {
		const opts = { indent_size: indent === 'tab' ? 1 : Number(indent), indent_char: indent === 'tab' ? '\t' : ' ', brace_style: braces, wrap_line_length: maxLine || 0, end_with_newline: true, preserve_newlines: true, max_preserve_newlines: 2 };
		const fn = { js: window.js_beautify, css: window.css_beautify, html: window.html_beautify }[language];
		return { text: fn(code, opts), label: 'Formatted' };
	},
});
