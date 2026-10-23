// No. 136 CSS grid generator: columns, rows and gaps with a live numbered preview and the CSS.
Omni.register({
	no: 136,
	id: 'css-grid',
	name: 'CSS grid generator',
	category: 'design',
	keywords: ['css grid', 'grid', 'layout', 'columns', 'rows', 'gap', 'template'],
	description: 'Sets grid columns, rows and gaps (fixed, fr or responsive auto-fit) and shows the layout with numbered cells and the CSS.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Columns', type: 'seg', options: [{ value: 'fixed', label: 'Fixed count' }, { value: 'auto', label: 'Responsive (auto-fit)' }], default: 'fixed' },
		{ name: 'cols', label: 'Number of columns', type: 'number', min: 1, max: 12, default: 3, when: (v) => v.mode === 'fixed' },
		{ name: 'colSize', label: 'Column size', type: 'text', mono: true, default: '1fr', when: (v) => v.mode === 'fixed' },
		{ name: 'minWidth', label: 'Minimum column width (px)', type: 'number', min: 40, max: 600, default: 180, when: (v) => v.mode === 'auto' },
		{ name: 'rows', label: 'Rows', type: 'number', min: 1, max: 12, default: 2 },
		{ name: 'rowSize', label: 'Row size', type: 'text', mono: true, default: 'minmax(80px, auto)' },
		{ name: 'gap', label: 'Gap (px)', type: 'number', min: 0, max: 80, default: 16 },
		{ name: 'items', label: 'Items to preview', type: 'number', min: 1, max: 48, default: 6 },
	],
	run({ mode, cols, colSize, minWidth, rows, rowSize, gap, items }) {
		if (!CSS.supports('grid-template-columns', colSize || '1fr') || !CSS.supports('grid-auto-rows', rowSize || 'auto')) throw new Error('A column or row size is not valid CSS (try 1fr, 200px, auto or minmax(80px, auto)).');
		const columns = mode === 'auto' ? `repeat(auto-fit, minmax(min(100%, ${minWidth || 180}px), 1fr))` : `repeat(${cols || 3}, ${colSize || '1fr'})`;
		const rowsValue = `repeat(${rows || 1}, ${rowSize || 'auto'})`;
		const css = `.grid {\n  display: grid;\n  grid-template-columns: ${columns};\n  grid-template-rows: ${rowsValue};\n  gap: ${gap || 0}px;\n}`;
		const { h } = Omni;
		const grid = h('div', { style: { display: 'grid', gridTemplateColumns: columns, gridTemplateRows: rowsValue, gap: `${gap || 0}px`, padding: '8px', border: '1px dashed var(--edge)', borderRadius: 'var(--r-control)' } }, Array.from({ length: items || 6 }, (_, i) => h('div', { style: { minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sunken)', border: '1px solid var(--line)', borderRadius: 'var(--r-chip)', fontFamily: 'var(--font-mono)' } }, String(i + 1))));
		return { node: Omni.forms.block('Preview (resize the window to see auto-fit)', grid), text: css, label: 'CSS' };
	},
});
