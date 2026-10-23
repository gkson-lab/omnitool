// No. 148 Minesweeper: three sizes, flags, a safe first click and full keyboard play.
Omni.register({
	no: 148,
	id: 'minesweeper',
	name: 'Minesweeper',
	category: 'fun',
	keywords: ['minesweeper', 'mines', 'game', 'puzzle', 'logic'],
	description: 'Clear the board without hitting a mine. Right-click, long-press or press F to flag; arrow keys and Enter work too. The first click is always safe.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const LEVELS = { easy: [9, 9, 10], medium: [16, 16, 40], hard: [16, 30, 99] };
		const level = h('select', { 'aria-label': 'Difficulty' }, h('option', { value: 'easy' }, 'Easy 9x9, 10 mines'), h('option', { value: 'medium' }, 'Medium 16x16, 40 mines'), h('option', { value: 'hard' }, 'Hard 16x30, 99 mines'));
		level.value = ctx.store.get('level', 'easy');
		const grid = h('div', { class: 'mines', role: 'grid', 'aria-label': 'Minefield' });
		// Cells opened by the current action and their distance from the clicked cell, for the outward reveal.
		const fresh = new Map();
		let origin = null;
		const distance = (i) => (origin ? Math.max(Math.abs(Math.floor(i / cols) - origin[0]), Math.abs((i % cols) - origin[1])) : 0);
		const status = h('p', { role: 'status', 'aria-live': 'polite' });
		const info = h('span', { class: 'mono' });
		let rows, cols, mines, cells, started, over, flags, t0, timer, focus;
		const at = (r, c) => cells[r * cols + c];
		const neighbors = (r, c) => {
			const out = [];
			for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols) out.push([r + dr, c + dc]);
			return out;
		};
		const lay = (sr, sc) => {
			const safe = new Set([[sr, sc], ...neighbors(sr, sc)].map(([r, c]) => r * cols + c));
			let placed = 0;
			while (placed < mines) {
				const i = Math.floor(Math.random() * rows * cols);
				if (cells[i].mine || safe.has(i)) continue;
				cells[i].mine = true;
				placed++;
			}
			cells.forEach((cell, i) => (cell.n = neighbors(Math.floor(i / cols), i % cols).filter(([r, c]) => at(r, c).mine).length));
		};
		const tick = () => (info.textContent = `Mines left ${mines - flags} · ${started ? Math.floor((Date.now() - t0) / 1000) : 0} s`);
		const end = (won) => {
			over = true;
			clearInterval(timer);
			cells.forEach((c, i) => {
				if (c.mine && !c.open) {
					c.open = true;
					fresh.set(i, distance(i));
				}
			});
			if (!won) Omni.motion.nudge(grid, 'lost');
			const secs = Math.floor((Date.now() - t0) / 1000);
			const bestKey = 'best.' + level.value;
			const best = ctx.store.get(bestKey, null);
			if (won && (best === null || secs < best)) ctx.store.set(bestKey, secs);
			status.textContent = won ? `Cleared in ${secs} s${best === null || secs < best ? ', a new best' : ` (best ${best} s)`}.` : 'Boom. Press New game to try again.';
			draw();
		};
		const open = (r, c) => {
			if (over) return;
			const cell = at(r, c);
			if (cell.open || cell.flag) return;
			origin = [r, c];
			if (!started) {
				lay(r, c);
				started = true;
				t0 = Date.now();
				timer = setInterval(tick, 1000);
			}
			if (cell.mine) {
				cell.boom = true;
				return end(false);
			}
			const stack = [[r, c]];
			while (stack.length) {
				const [y, x] = stack.pop();
				const cur = at(y, x);
				if (cur.open || cur.flag) continue;
				cur.open = true;
				fresh.set(y * cols + x, Math.max(Math.abs(y - r), Math.abs(x - c)));
				if (cur.n === 0) neighbors(y, x).forEach((p) => stack.push(p));
			}
			if (cells.filter((x) => !x.open).length === mines) end(true);
		};
		const chord = (r, c) => {
			const cell = at(r, c);
			if (!cell.open || !cell.n) return;
			const around = neighbors(r, c);
			if (around.filter(([y, x]) => at(y, x).flag).length === cell.n) around.forEach(([y, x]) => open(y, x));
		};
		const flag = (r, c) => {
			const cell = at(r, c);
			if (over || cell.open) return;
			cell.flag = !cell.flag;
			flags += cell.flag ? 1 : -1;
		};
		function draw() {
			setTimeout(() => fresh.clear(), 0);
			grid.style.gridTemplateColumns = `repeat(${cols}, 32px)`;
			grid.replaceChildren(...cells.map((cell, i) => {
				const r = Math.floor(i / cols);
				const c = i % cols;
				const label = cell.open ? (cell.mine ? 'mine' : cell.n ? String(cell.n) : 'empty') : cell.flag ? 'flagged' : 'hidden';
				const b = h('button', { type: 'button', role: 'gridcell', class: (cell.open ? 'open' : '') + (cell.boom ? ' boom' : '') + (fresh.has(i) ? ' revealed' : ''), style: fresh.has(i) ? { '--d': Math.min(fresh.get(i) * 18, 320) + 'ms' } : null, tabindex: focus === i ? '0' : '-1', 'aria-label': `Row ${r + 1}, column ${c + 1}: ${label}`, 'data-i': i }, cell.open ? (cell.mine ? '*' : cell.n || '') : cell.flag ? 'F' : '');
				b.addEventListener('click', () => {
					focus = i;
					cell.open ? chord(r, c) : open(r, c);
					draw();
				});
				b.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					focus = i;
					flag(r, c);
					draw();
				});
				let press;
				b.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && (press = setTimeout(() => (flag(r, c), draw(), (press = 'done')), 450)));
				b.addEventListener('pointerup', () => press !== 'done' && clearTimeout(press));
				return b;
			}));
			tick();
			const f = grid.querySelector(`[data-i="${focus}"]`);
			if (f && grid.contains(document.activeElement)) f.focus();
		}
		grid.addEventListener('keydown', (e) => {
			const r = Math.floor(focus / cols);
			const c = focus % cols;
			const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
			if (moves[e.key]) {
				e.preventDefault();
				const nr = Math.min(rows - 1, Math.max(0, r + moves[e.key][0]));
				const nc = Math.min(cols - 1, Math.max(0, c + moves[e.key][1]));
				focus = nr * cols + nc;
				grid.querySelectorAll('button').forEach((b) => (b.tabIndex = -1));
				const b = grid.querySelector(`[data-i="${focus}"]`);
				b.tabIndex = 0;
				b.focus();
			} else if (e.key.toLowerCase() === 'f') {
				flag(r, c);
				draw();
			}
		});
		const newGame = () => {
			ctx.store.set('level', level.value);
			[rows, cols, mines] = LEVELS[level.value];
			cells = Array.from({ length: rows * cols }, () => ({ mine: false, n: 0, open: false, flag: false }));
			started = false;
			over = false;
			flags = 0;
			focus = 0;
			clearInterval(timer);
			status.textContent = 'Click any square to start.';
			draw();
		};
		level.addEventListener('change', newGame);
		root.appendChild(h('div', { class: 'panel stack', style: { overflowX: 'auto' } }, h('div', { class: 'row between' }, h('div', { class: 'row' }, level, h('button', { type: 'button', class: 'btn btn-primary', onclick: newGame }, 'New game')), info), grid, status));
		newGame();
		return () => clearInterval(timer);
	},
});
