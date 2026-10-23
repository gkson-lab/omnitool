// No. 076 Tip and bill splitter.
Omni.register({
	no: 76,
	id: 'tip',
	name: 'Tip and bill splitter',
	category: 'math',
	keywords: ['tip', 'bill', 'split', 'restaurant', 'gratuity', 'share'],
	description: 'Works out the tip, the total and each person\'s share, with optional rounding up.',
	live: true,
	inputs: [
		{ name: 'bill', label: 'Bill', type: 'number', min: 0, step: 'any', default: 84.5 },
		{ name: 'tip', label: 'Tip (%)', type: 'number', min: 0, step: 'any', default: 15 },
		{ name: 'people', label: 'People', type: 'number', min: 1, default: 3 },
		{ name: 'round', label: 'Round each share up to', type: 'select', options: [{ value: '0', label: 'No rounding' }, { value: '0.5', label: '0.50' }, { value: '1', label: '1' }, { value: '5', label: '5' }], default: '0' },
	],
	run({ bill, tip, people, round }) {
		const b = Number(bill) || 0;
		const p = Math.max(1, Math.floor(people || 1));
		const t = (b * (Number(tip) || 0)) / 100;
		let share = (b + t) / p;
		const step = Number(round);
		if (step) share = Math.ceil(share / step - 1e-9) * step;
		const m = (v) => v.toFixed(2);
		return {
			text: m(share),
			big: true,
			label: `Each of ${p} pays`,
			readings: [{ label: 'Tip', value: m(t) }, { label: 'Total with tip', value: m(b + t) }, { label: 'Collected after rounding', value: m(share * p) }, { label: 'Effective tip', value: b ? `${(((share * p - b) / b) * 100).toFixed(1)}%` : '-', copy: false }],
		};
	},
});
