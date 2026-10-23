// No. 132 SVG previewer: renders SVG safely on light and dark backgrounds and strips editor metadata.
Omni.register({
	no: 132,
	id: 'svg-preview',
	name: 'SVG previewer',
	category: 'design',
	keywords: ['svg', 'icon', 'preview', 'optimize', 'minify', 'vector'],
	description: 'Previews SVG code on light and dark backgrounds (scripts removed), strips comments and editor metadata, and shows the size saved.',
	vendor: ['purify.min.js'],
	live: true,
	inputs: [
		{ name: 'svg', label: 'SVG code', type: 'textarea', mono: true, rows: 10, default: '<?xml version="1.0"?>\n<!-- Generator: Some Editor -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="64" height="64" viewBox="0 0 24 24" inkscape:version="1.3">\n  <metadata>editor data</metadata>\n  <path d="M9 3h6l-1 6 4 4H6l4-4z" fill="none" stroke="currentColor" stroke-width="1.6"/>\n  <path d="M12 13v8" stroke="currentColor" stroke-width="1.6"/>\n</svg>' },
		{ name: 'precision', label: 'Round path numbers to decimals', type: 'select', options: [{ value: '', label: 'Do not round' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }], default: '' },
	],
	run({ svg, precision }) {
		if (!/<svg[\s>]/i.test(svg)) return { note: 'Paste SVG code that contains an <svg> element.' };
		let out = svg
			.replace(/<\?xml[^>]*\?>/g, '')
			.replace(/<!DOCTYPE[^>]*>/gi, '')
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
			.replace(/<(sodipodi|inkscape):[\s\S]*?(\/>|<\/\1:[^>]*>)/gi, '')
			.replace(/\s(?:xmlns:)?(sodipodi|inkscape|sketch|serif)(:[\w-]+)?="[^"]*"/gi, '')
			.replace(/>\s+</g, '><')
			.trim();
		if (precision) {
			const p = Number(precision);
			out = out.replace(/(\sd|points)="([^"]+)"/g, (m, attr, d) => `${attr}="${d.replace(/-?\d*\.\d+/g, (n) => String(Number(Number(n).toFixed(p))))}"`);
		}
		const safe = window.DOMPurify.sanitize(out, { USE_PROFILES: { svg: true, svgFilters: true } });
		const { h } = Omni;
		const tile = (bg, fg, label) => h('div', { style: { flex: '1', minWidth: '160px' } }, h('div', { class: 'muted', style: { fontSize: '0.8rem', marginBottom: '4px' } }, label), h('div', { class: 'preview-box', style: { background: bg, color: fg }, html: safe }));
		const before = new Blob([svg]).size;
		const after = new Blob([out]).size;
		return {
			node: h('div', { class: 'row', style: { alignItems: 'stretch' } }, tile('#ffffff', '#1d1716', 'On light'), tile('#120e0d', '#f1e9e7', 'On dark')),
			meter: { value: Math.max(0, 1 - after / before), label: 'Size saved', text: `${Omni.util.fmt.bytes(before)} to ${Omni.util.fmt.bytes(after)}` },
			text: out,
			label: 'Cleaned SVG',
			download: { name: 'image.svg', data: out, mime: 'image/svg+xml', label: 'Download SVG' },
		};
	},
});
