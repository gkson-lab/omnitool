// No. 053 Markdown to HTML: live, sanitized preview (marked + DOMPurify) and the HTML source.
Omni.register({
	no: 53,
	id: 'markdown',
	name: 'Markdown to HTML',
	category: 'convert',
	keywords: ['markdown', 'md', 'html', 'preview', 'convert', 'gfm'],
	description: 'Converts Markdown (GitHub flavored) to HTML with a live preview. Scripts and unsafe attributes are removed.',
	vendor: ['marked.umd.js', 'purify.min.js'],
	live: true,
	layout: 'split',
	inputs: [
		{ name: 'md', label: 'Markdown', type: 'textarea', mono: true, rows: 16, default: '# Release notes\n\nOmniTool **1.0** ships with:\n\n- 150 numbered tools\n- Omni Agent, with an offline mode\n- `start.bat` for the desktop edition\n\n| Edition | Tools |\n|---|---|\n| Desktop | 150 |\n| Web | 133 |\n\n> Keep the `web` and `shared` folders side by side.\n' },
		{ name: 'breaks', label: 'Single line breaks become <br>', type: 'checkbox' },
	],
	run({ md, breaks }) {
		const html = window.DOMPurify.sanitize(window.marked.parse(md, { gfm: true, breaks }));
		return { blocks: [{ type: 'html', html: `<div class="msg-body">${html}</div>`, label: 'Preview' }, { type: 'text', label: 'HTML', value: html }] };
	},
});
