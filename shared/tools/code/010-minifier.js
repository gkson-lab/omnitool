// No. 010 Code minifier: JavaScript through Terser, CSS and HTML with conservative rules that keep behavior.
(function () {
	'use strict';

	function minifyCss(css) {
		const strings = [];
		// Protect strings first so their spaces and semicolons survive.
		let out = css.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (s) => `\u0000${strings.push(s) - 1}\u0000`);
		out = out
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\s+/g, ' ')
			.replace(/\s*([{}:;,>~])\s*/g, '$1')
			.replace(/;}/g, '}')
			.replace(/\b0(px|em|rem|%|pt|vh|vw)\b/g, '0')
			.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3\b/gi, '#$1$2$3')
			.trim();
		return out.replace(/\u0000(\d+)\u0000/g, (_, i) => strings[i]);
	}

	function minifyHtml(html) {
		const keep = [];
		let out = html.replace(/<(pre|textarea|script|style)\b[\s\S]*?<\/\1>/gi, (block) => `\u0000${keep.push(block) - 1}\u0000`);
		out = out
			.replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
			.replace(/\s+/g, ' ')
			.replace(/>\s+</g, '><')
			.trim();
		return out.replace(/\u0000(\d+)\u0000/g, (_, i) => {
			const block = keep[i];
			if (/^<style/i.test(block)) return block.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i, (m, a, b, c) => a + minifyCss(b) + c);
			return block;
		});
	}

	Omni.register({
		no: 10,
		id: 'minifier',
		name: 'Code minifier',
		category: 'code',
		keywords: ['minify', 'compress', 'uglify', 'terser', 'javascript', 'css', 'html', 'size'],
		description: 'Minifies JavaScript (Terser), CSS and HTML and shows how much smaller the result is.',
		vendor: ['terser.min.js'],
		action: 'Minify',
		inputs: [
			{ name: 'language', label: 'Language', type: 'seg', options: [{ value: 'js', label: 'JavaScript' }, { value: 'css', label: 'CSS' }, { value: 'html', label: 'HTML' }], default: 'js' },
			{ name: 'code', label: 'Code', type: 'textarea', mono: true, rows: 12, default: '// Adds up the numbers in a list\nfunction total(numbers) {\n  let sum = 0;\n  for (const value of numbers) {\n    sum += value;\n  }\n  return sum;\n}\n\nconsole.log(total([1, 2, 3]));\n' },
			{ name: 'mangle', label: 'Shorten variable names (JavaScript)', type: 'checkbox', default: true, when: (v) => v.language === 'js' },
		],
		async run({ language, code, mangle }) {
			let out;
			if (language === 'js') {
				const res = await window.Terser.minify(code, { mangle: !!mangle, compress: { passes: 2 }, format: { comments: false } });
				out = res.code;
			} else if (language === 'css') out = minifyCss(code);
			else out = minifyHtml(code);
			const before = new Blob([code]).size;
			const after = new Blob([out]).size;
			const saved = before ? 1 - after / before : 0;
			return {
				text: out,
				label: 'Minified',
				meter: { value: Math.max(0, saved), label: 'Size saved', text: `${Math.round(saved * 100)}%` },
				readings: [{ label: 'Original', value: Omni.util.fmt.bytes(before), copy: false }, { label: 'Minified', value: Omni.util.fmt.bytes(after), copy: false }],
			};
		},
	});
})();
