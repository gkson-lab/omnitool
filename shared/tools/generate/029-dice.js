// No. 029 Dice roller: standard notation (3d6+2, 4d6kh3, 2d20kl1), advantage and a roll history.
(function () {
	'use strict';

	/** Rolls "3d6+2", "4d6kh3 + 1d4 - 1" and so on. Returns { total, parts:[{term, rolls, kept, sum}] }. */
	function roll(notation, rand) {
		const src = notation.replace(/\s+/g, '').toLowerCase();
		if (!src) throw new Error('Type dice notation, for example 2d6+3.');
		const terms = src.match(/[+-]?[^+-]+/g);
		if (!terms || terms.join('') !== src) throw new Error(`Cannot read "${notation}".`);
		let total = 0;
		const parts = [];
		for (const t of terms) {
			const sign = t.startsWith('-') ? -1 : 1;
			const body = t.replace(/^[+-]/, '');
			const m = body.match(/^(\d*)d(\d+|%)(?:(kh|kl|dh|dl)(\d+))?$/);
			if (m) {
				const n = m[1] === '' ? 1 : Number(m[1]);
				const sides = m[2] === '%' ? 100 : Number(m[2]);
				if (n < 1 || n > 1000) throw new Error('Roll between 1 and 1000 dice at a time.');
				if (sides < 2 || sides > 1000) throw new Error('Dice need between 2 and 1000 sides.');
				const rolls = Array.from({ length: n }, () => Omni.random.int(rand, 1, sides));
				let kept = rolls.slice();
				if (m[3]) {
					const k = Math.min(n, Number(m[4]));
					const sorted = rolls.slice().sort((a, b) => a - b);
					kept = { kh: sorted.slice(n - k), kl: sorted.slice(0, k), dh: sorted.slice(0, n - k), dl: sorted.slice(n - k) }[m[3]];
				}
				const sum = kept.reduce((a, b) => a + b, 0) * sign;
				total += sum;
				parts.push({ term: (sign < 0 ? '-' : '+') + body, rolls, kept, sum });
			} else if (/^\d+$/.test(body)) {
				total += sign * Number(body);
				parts.push({ term: (sign < 0 ? '-' : '+') + body, rolls: [], kept: [], sum: sign * Number(body) });
			} else throw new Error(`"${body}" is not a dice term. Examples: d20, 3d6, 4d6kh3, d%.`);
		}
		return { total, parts };
	}
	Omni.dice = { roll };

	Omni.register({
		no: 29,
		id: 'dice',
		name: 'Dice roller',
		category: 'generate',
		keywords: ['dice', 'roll', 'd20', 'd6', 'rpg', 'dnd', 'tabletop'],
		description: 'Rolls dice in standard notation: 3d6+2, 4d6kh3 (keep highest 3), 2d20kl1 (disadvantage), d%.',
		action: 'Roll',
		chance: true,
		inputs: [
			{ name: 'notation', label: 'Dice', type: 'text', mono: true, default: '2d20kh1 + 5', hint: 'kh/kl keep highest or lowest, dh/dl drop highest or lowest' },
			{ name: 'times', label: 'Roll this many times', type: 'number', min: 1, max: 100, default: 1 },
		],
		extraActions: (values, set) => Omni.h('div', { class: 'row' }, ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd%', '4d6kh3'].map((d) => Omni.h('button', { type: 'button', class: 'btn btn-small', onclick: (e) => {
			set({ notation: d });
			e.target.closest('form').requestSubmit();
		} }, d))),
		run({ notation, times }) {
			const rand = Omni.random.source();
			const results = Array.from({ length: Math.max(1, Math.min(100, times || 1)) }, () => roll(notation, rand));
			const history = Omni.store.get('tool.dice.history', []);
			Omni.store.set('tool.dice.history', [...results.map((r) => ({ notation, total: r.total, at: Date.now() })), ...history].slice(0, 30));
			const detail = (r) => r.parts.map((p) => (p.rolls.length ? `${p.term} [${p.rolls.join(', ')}]${p.kept.length !== p.rolls.length ? ` kept ${p.kept.join(', ')}` : ''}` : p.term)).join(' ');
			return {
				blocks: [
					{ type: 'text', label: results.length === 1 ? 'Total' : 'Totals', value: results.map((r) => r.total).join(', '), big: results.length === 1 },
					{ type: 'text', label: 'Each roll', value: results.map(detail).join('\n') },
					{ type: 'table', label: 'Recent rolls', columns: ['Dice', 'Total', 'When'], rows: Omni.store.get('tool.dice.history', []).slice(0, 10).map((x) => [x.notation, x.total, new Date(x.at).toLocaleTimeString()]) },
				],
			};
		},
	});
})();
