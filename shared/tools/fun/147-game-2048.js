// No. 147 2048: slide tiles with the arrow keys or swipes; equal tiles merge. Best score is saved.
Omni.register({
	no: 147,
	id: 'game-2048',
	name: '2048',
	category: 'fun',
	keywords: ['2048', 'game', 'puzzle', 'tiles', 'merge'],
	description: 'Slide the tiles with the arrow keys or by swiping. Equal tiles merge; reach 2048.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		let grid;
		let ids;
		let nextId = 1;
		let merged = new Set();
		let spawned = 0;
		let score;
		let best = ctx.store.get('best', 0);
		let won;
		const board = h('div', { class: 'game-board', tabindex: '0', role: 'grid', 'aria-label': '2048 board. Use the arrow keys.', style: { gridTemplateColumns: 'repeat(4, 1fr)' } });
		const scoreEl = h('span', { class: 'mono' });
		const status = h('p', { class: 'muted', role: 'status', 'aria-live': 'polite' });
		const empty = () => grid.flatMap((r, y) => r.map((v, x) => (v ? null : [x, y]))).filter(Boolean);
		const spawn = () => {
			const cells = empty();
			if (!cells.length) return;
			const [x, y] = cells[Math.floor(Math.random() * cells.length)];
			grid[y][x] = Math.random() < 0.9 ? 2 : 4;
			ids[y][x] = spawned = nextId++;
		};
		const freshIds = () => grid.map((row) => row.map((v) => (v ? nextId++ : 0)));
		const save = () => ctx.store.set('game', { grid, score, won });
		const shade = (v) => {
			// Darker ink as values grow, so the scale reads without extra hues.
			const level = Math.min(11, Math.log2(v || 1));
			return { background: v ? `color-mix(in oklab, var(--ink) ${level * 8}%, var(--surface))` : 'var(--surface)', color: level > 6 ? 'var(--paper)' : 'var(--ink)' };
		};
		const draw = () => {
			const settle = Omni.motion.flip(board, '.tile[data-key]', { duration: 120 });
			board.replaceChildren(...grid.flatMap((row, y) => row.map((v, x) => {
				const id = ids[y][x];
				const cls = 'tile' + (v && merged.has(id) ? ' merged' : '') + (v && id === spawned ? ' spawned' : '');
				return h('div', { class: cls, role: 'gridcell', 'data-key': v ? String(id) : null, style: { ...shade(v), fontSize: v >= 1024 ? 'clamp(0.9rem, 3vw, 1.3rem)' : null } }, v ? String(v) : '');
			})));
			settle();
			merged = new Set();
			spawned = 0;
			scoreEl.textContent = `Score ${score} · Best ${best}`;
		};
		// A row is a list of { v, id }; a merged tile keeps the first tile's id, so it slides and then pops.
		const slide = (row) => {
			const vals = row.filter((t) => t.v);
			const out = [];
			let gained = 0;
			for (let i = 0; i < vals.length; i++) {
				if (vals[i + 1] && vals[i].v === vals[i + 1].v) {
					out.push({ v: vals[i].v * 2, id: vals[i].id });
					merged.add(vals[i].id);
					gained += vals[i].v * 2;
					i++;
				} else out.push(vals[i]);
			}
			while (out.length < 4) out.push({ v: 0, id: 0 });
			return { out, gained };
		};
		const move = (dir) => {
			const before = JSON.stringify(grid);
			const pos = (i, j) => (dir === 'left' ? [i, j] : dir === 'right' ? [i, 3 - j] : dir === 'up' ? [j, i] : [3 - j, i]);
			const get = (i, j) => {
				const [y, x] = pos(i, j);
				return { v: grid[y][x], id: ids[y][x] };
			};
			const next = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
			const nextIds = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
			merged = new Set();
			for (let i = 0; i < 4; i++) {
				const { out, gained } = slide([0, 1, 2, 3].map((j) => get(i, j)));
				score += gained;
				out.forEach((t, j) => {
					const [y, x] = pos(i, j);
					next[y][x] = t.v;
					nextIds[y][x] = t.id;
				});
			}
			if (JSON.stringify(next) === before) return;
			grid = next;
			ids = nextIds;
			spawn();
			if (score > best) {
				best = score;
				ctx.store.set('best', best);
			}
			if (!won && grid.flat().includes(2048)) {
				won = true;
				status.textContent = 'You made 2048! Keep going if you like.';
			}
			const stuck = !empty().length && grid.every((r, y) => r.every((v, x) => v !== r[x + 1] && (!grid[y + 1] || v !== grid[y + 1][x])));
			if (stuck) status.textContent = `No moves left. Final score ${score}. Press New game.`;
			save();
			draw();
		};
		const newGame = () => {
			grid = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
			ids = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
			score = 0;
			won = false;
			spawn();
			spawn();
			status.textContent = 'Use the arrow keys or swipe.';
			save();
			draw();
			board.focus();
		};
		board.addEventListener('keydown', (e) => {
			const d = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' }[e.key];
			if (d) {
				e.preventDefault();
				move(d);
			}
		});
		let start = null;
		board.addEventListener('pointerdown', (e) => (start = [e.clientX, e.clientY]));
		board.addEventListener('pointerup', (e) => {
			if (!start) return;
			const dx = e.clientX - start[0];
			const dy = e.clientY - start[1];
			if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
			start = null;
		});
		const saved = ctx.store.get('game', null);
		root.appendChild(h('div', { class: 'panel stack', style: { maxWidth: '480px' } }, h('div', { class: 'row between' }, scoreEl, h('button', { type: 'button', class: 'btn btn-primary', onclick: newGame }, 'New game')), board, status));
		if (saved && saved.grid) {
			({ grid, score, won } = saved);
			ids = freshIds();
			status.textContent = 'Game restored. Use the arrow keys or swipe.';
			draw();
		} else newGame();
	},
});
