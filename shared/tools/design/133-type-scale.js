// No. 133 Type scale generator: a modular scale as CSS custom properties, with a preview at each step.
Omni.register({
	no: 133,
	id: 'type-scale',
	name: 'Type scale generator',
	category: 'design',
	keywords: ['type scale', 'typography', 'font size', 'modular scale', 'css', 'rem', 'clamp'],
	description: 'Builds a modular type scale from a base size and ratio, optionally fluid with clamp(), as CSS custom properties.',
	live: true,
	inputs: [
		{ name: 'base', label: 'Base size (px)', type: 'number', min: 8, max: 32, step: 0.5, default: 16 },
		{ name: 'ratio', label: 'Ratio', type: 'select', options: [{ value: '1.067', label: 'Minor second (1.067)' }, { value: '1.125', label: 'Major second (1.125)' }, { value: '1.2', label: 'Minor third (1.2)' }, { value: '1.25', label: 'Major third (1.25)' }, { value: '1.333', label: 'Perfect fourth (1.333)' }, { value: '1.414', label: 'Augmented fourth (1.414)' }, { value: '1.5', label: 'Perfect fifth (1.5)' }, { value: '1.618', label: 'Golden ratio (1.618)' }], default: '1.25' },
		{ name: 'up', label: 'Steps up', type: 'number', min: 1, max: 10, default: 5 },
		{ name: 'down', label: 'Steps down', type: 'number', min: 0, max: 5, default: 2 },
		{ name: 'fluid', label: 'Fluid sizes with clamp() (90% on narrow screens)', type: 'checkbox', default: false },
		{ name: 'sample', label: 'Preview text', type: 'text', default: 'Pack my box with five dozen jugs' },
	],
	run({ base, ratio, up, down, fluid, sample }) {
		const r = Number(ratio);
		const b = Number(base) || 16;
		const steps = [];
		for (let i = -(down || 0); i <= (up || 5); i++) steps.push(i);
		const name = (i) => (i === 0 ? 'base' : i > 0 ? `up-${i}` : `down-${-i}`);
		const rem = (px) => `${+(px / 16).toFixed(4)}rem`;
		const lines = steps.map((i) => {
			const px = b * r ** i;
			const value = fluid ? `clamp(${rem(px * 0.9)}, ${rem(px * 0.9)} + ${+((px * 0.1) / 9.6).toFixed(3)}vw, ${rem(px)})` : rem(px);
			return `  --step-${name(i)}: ${value}; /* ${px.toFixed(2)}px */`;
		});
		const { h } = Omni;
		const preview = h('div', { class: 'stack' }, steps.slice().reverse().map((i) => h('div', { style: { display: 'grid', gridTemplateColumns: '5.5em minmax(0, 1fr)', gap: '12px', alignItems: 'baseline' } }, h('span', { class: 'mono muted', style: { fontSize: '0.75rem' } }, `${(b * r ** i).toFixed(1)}px`), h('span', { style: { fontSize: `${b * r ** i}px`, lineHeight: 1.15, overflowWrap: 'anywhere' } }, sample))));
		return { node: Omni.forms.block('Preview', preview), text: `:root {\n${lines.join('\n')}\n}`, label: 'CSS' };
	},
});
