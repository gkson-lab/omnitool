// No. 068 Percentage calculator: the four questions people actually ask about percentages.
Omni.register({
	no: 68,
	id: 'percentage',
	name: 'Percentage calculator',
	category: 'math',
	keywords: ['percent', 'percentage', 'increase', 'decrease', 'change', 'discount', 'markup'],
	description: 'X% of Y, X as a percent of Y, percent change from X to Y, and Y increased or decreased by X%.',
	live: true,
	inputs: [
		{ name: 'mode', label: 'Question', type: 'select', options: [{ value: 'of', label: 'What is X% of Y?' }, { value: 'what', label: 'X is what percent of Y?' }, { value: 'change', label: 'Percent change from X to Y' }, { value: 'apply', label: 'Y increased or decreased by X%' }], default: 'of' },
		{ name: 'x', label: 'X', type: 'number', step: 'any', default: 15 },
		{ name: 'y', label: 'Y', type: 'number', step: 'any', default: 80 },
	],
	run({ mode, x, y }) {
		if (x == null || y == null) return { note: 'Fill in X and Y.' };
		const f = (n) => Omni.math.format(n, 10);
		if (mode === 'of') return { text: f((x / 100) * y), big: true, label: `${f(x)}% of ${f(y)}` };
		if (mode === 'what') {
			if (y === 0) throw new Error('Y cannot be 0.');
			return { text: f((x / y) * 100) + '%', big: true, label: `${f(x)} as a percent of ${f(y)}` };
		}
		if (mode === 'change') {
			if (x === 0) throw new Error('A change from 0 has no percentage.');
			const c = ((y - x) / Math.abs(x)) * 100;
			return { text: `${c >= 0 ? '+' : ''}${f(c)}%`, big: true, label: `From ${f(x)} to ${f(y)}`, readings: [{ label: 'Difference', value: f(y - x) }, { label: 'Y as a multiple of X', value: f(y / x) + 'x' }] };
		}
		return { readings: [{ label: `${f(y)} + ${f(x)}%`, value: f(y * (1 + x / 100)) }, { label: `${f(y)} - ${f(x)}%`, value: f(y * (1 - x / 100)) }, { label: `${f(x)}% of ${f(y)}`, value: f((y * x) / 100) }] };
	},
});
