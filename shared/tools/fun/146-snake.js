// No. 146 Snake: arrow keys, WASD or swipes; the speed rises as you eat; the best score is saved.
Omni.register({
	no: 146,
	id: 'snake',
	name: 'Snake',
	category: 'fun',
	keywords: ['snake', 'game', 'arcade', 'play'],
	description: 'Classic Snake on a 20 by 20 board. Arrow keys or WASD on a keyboard, swipes on a touch screen, Space to pause.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const N = 20;
		const canvas = h('canvas', { class: 'plot', width: 480, height: 480, tabindex: '0', role: 'img', 'aria-label': 'Snake board. Use arrow keys to steer.', style: { maxWidth: '480px', aspectRatio: '1', touchAction: 'none' } });
		const score = h('span', { class: 'mono' });
		const status = h('p', { class: 'muted', role: 'status' });
		const startBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Start');
		let snake;
		let dir;
		let queue;
		let food;
		let timer = null;
		let points = 0;
		let paused = false;
		let best = ctx.store.get('best', 0);
		const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
		const placeFood = () => {
			do food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
			while (snake.some(([x, y]) => x === food[0] && y === food[1]));
		};
		const draw = () => {
			const g = canvas.getContext('2d');
			const c = canvas.width / N;
			g.fillStyle = css('--sunken');
			g.fillRect(0, 0, canvas.width, canvas.height);
			g.fillStyle = css('--signal');
			if (food) g.fillRect(food[0] * c + 4, food[1] * c + 4, c - 8, c - 8);
			g.fillStyle = css('--ink');
			(snake || []).forEach(([x, y]) => g.fillRect(x * c + 1, y * c + 1, c - 2, c - 2));
			score.textContent = `Score ${points} · Best ${best}`;
		};
		const speed = () => Math.max(55, 140 - points * 3);
		const step = () => {
			if (paused) return;
			if (queue.length) {
				const next = queue.shift();
				if (next[0] !== -dir[0] || next[1] !== -dir[1]) dir = next;
			}
			const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
			if (head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || snake.some(([x, y]) => x === head[0] && y === head[1])) return over();
			snake.unshift(head);
			if (head[0] === food[0] && head[1] === food[1]) {
				points++;
				placeFood();
				clearInterval(timer);
				timer = setInterval(step, speed());
			} else snake.pop();
			draw();
		};
		const over = () => {
			clearInterval(timer);
			timer = null;
			if (points > best) {
				best = points;
				ctx.store.set('best', best);
				status.textContent = `New best: ${points}! Press Start or Enter to play again.`;
			} else status.textContent = `Game over with ${points}. Press Start or Enter to play again.`;
			startBtn.textContent = 'Play again';
			draw();
		};
		const start = () => {
			snake = [[10, 10], [9, 10], [8, 10]];
			dir = [1, 0];
			queue = [];
			points = 0;
			paused = false;
			placeFood();
			clearInterval(timer);
			timer = setInterval(step, speed());
			status.textContent = 'Playing. Space pauses.';
			startBtn.textContent = 'Restart';
			canvas.focus();
			draw();
		};
		const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
		canvas.addEventListener('keydown', (e) => {
			const k = KEYS[e.key] || KEYS[e.key.toLowerCase()];
			if (k && timer) {
				e.preventDefault();
				if (queue.length < 3) queue.push(k);
			} else if (e.key === ' ' && timer) {
				e.preventDefault();
				paused = !paused;
				status.textContent = paused ? 'Paused. Space continues.' : 'Playing. Space pauses.';
			} else if (e.key === 'Enter' && !timer) start();
		});
		let touch = null;
		canvas.addEventListener('pointerdown', (e) => (touch = [e.clientX, e.clientY]));
		canvas.addEventListener('pointerup', (e) => {
			if (!touch || !timer) return;
			const dx = e.clientX - touch[0];
			const dy = e.clientY - touch[1];
			if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) queue.push(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
			touch = null;
		});
		startBtn.onclick = start;
		root.appendChild(h('div', { class: 'panel stack', style: { maxWidth: '540px' } }, h('div', { class: 'row between' }, score, startBtn), canvas, status));
		status.textContent = 'Press Start, then steer with the arrow keys.';
		draw();
		const off = Omni.on('theme', () => requestAnimationFrame(draw));
		return () => {
			clearInterval(timer);
			off();
		};
	},
});
