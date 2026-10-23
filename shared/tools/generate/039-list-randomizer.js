// No. 039 List randomizer: shuffle a list, draw winners, or split it into teams.
Omni.register({
	no: 39,
	id: 'list-randomizer',
	name: 'List randomizer',
	category: 'generate',
	chance: (text, args) => {
		const items = String(args.items || '').split('\n').map((x) => x.trim()).filter(Boolean);
		return items.length && !text.includes('\n') ? items[Math.floor(Math.random() * items.length)] : text;
	},
	keywords: ['shuffle', 'random', 'pick', 'winner', 'raffle', 'teams', 'groups', 'draw'],
	description: 'Shuffles a list, draws winners, or splits it into balanced teams.',
	action: 'Randomize',
	inputs: [
		{ name: 'items', label: 'Items, one per line', type: 'textarea', rows: 8, default: 'Ada\nBo\nCai\nDev\nEli\nFen\nGus\nHal' },
		{ name: 'mode', label: 'Do', type: 'seg', options: [{ value: 'shuffle', label: 'Shuffle' }, { value: 'pick', label: 'Pick winners' }, { value: 'teams', label: 'Make teams' }], default: 'shuffle' },
		{ name: 'winners', label: 'Winners', type: 'number', min: 1, default: 1, when: (v) => v.mode === 'pick' },
		{ name: 'teams', label: 'Teams', type: 'number', min: 2, default: 2, when: (v) => v.mode === 'teams' },
		{ name: 'dedupe', label: 'Remove duplicates first', type: 'checkbox', default: true },
	],
	run({ items, mode, winners, teams, dedupe }) {
		let list = items.split('\n').map((s) => s.trim()).filter(Boolean);
		if (dedupe) list = [...new Set(list)];
		if (!list.length) throw new Error('Add at least one item.');
		const rand = Omni.random.source();
		const shuffled = Omni.random.shuffle(rand, list);
		if (mode === 'pick') {
			const n = Math.min(list.length, Math.max(1, winners || 1));
			return { text: shuffled.slice(0, n).map((x, i) => (n > 1 ? `${i + 1}. ${x}` : x)).join('\n'), label: n === 1 ? 'Winner' : 'Winners in draw order', big: n === 1, note: `Drawn from ${list.length} entries.` };
		}
		if (mode === 'teams') {
			const t = Math.min(list.length, Math.max(2, teams || 2));
			const groups = Array.from({ length: t }, () => []);
			shuffled.forEach((x, i) => groups[i % t].push(x));
			return { table: { label: `${t} teams`, columns: groups.map((g, i) => `Team ${i + 1} (${g.length})`), rows: Array.from({ length: Math.max(...groups.map((g) => g.length)) }, (_, r) => groups.map((g) => g[r] || '')) } };
		}
		return { text: shuffled.join('\n'), label: `Shuffled (${list.length})` };
	},
});
