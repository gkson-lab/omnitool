// No. 130 Border and radius generator: border width, style and color plus per-corner radius, with CSS.
Omni.register({
	no: 130,
	id: 'border-radius',
	name: 'Border and radius generator',
	category: 'design',
	keywords: ['border', 'border-radius', 'rounded corners', 'css', 'outline', 'blob'],
	description: 'Sets border width, style and color and the radius of each corner separately, with a live preview and the CSS.',
	live: true,
	inputs: [
		{ name: 'width', label: 'Border width (px)', type: 'range', min: 0, max: 20, default: 2 },
		{ name: 'style', label: 'Border style', type: 'select', options: ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'none'], default: 'solid' },
		{ name: 'color', label: 'Border color', type: 'color', default: '#1d1716' },
		{ name: 'tl', label: 'Top left radius', type: 'range', min: 0, max: 120, default: 14 },
		{ name: 'tr', label: 'Top right radius', type: 'range', min: 0, max: 120, default: 14 },
		{ name: 'br', label: 'Bottom right radius', type: 'range', min: 0, max: 120, default: 14 },
		{ name: 'bl', label: 'Bottom left radius', type: 'range', min: 0, max: 120, default: 14 },
		{ name: 'unit', label: 'Radius unit', type: 'seg', options: [{ value: 'px', label: 'px' }, { value: '%', label: '%' }], default: 'px' },
	],
	run({ width, style, color, tl, tr, br, bl, unit }) {
		const u = unit === '%' ? '%' : 'px';
		const r = [tl, tr, br, bl].map((v) => `${Math.min(v, u === '%' ? 50 : v)}${u}`);
		const radius = new Set(r).size === 1 ? r[0] : r.join(' ');
		const border = `${width}px ${style} ${color}`;
		const { h } = Omni;
		const box = h('div', { style: { width: '220px', height: '140px', border, borderRadius: r.join(' '), background: 'var(--surface)', margin: '0 auto' }, role: 'img', 'aria-label': 'Border preview' });
		return { node: h('div', { class: 'preview-box' }, box), text: `border: ${border};\nborder-radius: ${radius};`, label: 'CSS' };
	},
});
