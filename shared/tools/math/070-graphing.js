// No. 070 Graphing calculator: plots up to five functions of x with pan, zoom and a trace readout.
Omni.register({
	no: 70,
	id: 'graphing',
	name: 'Graphing calculator',
	category: 'math',
	keywords: ['graph', 'plot', 'function', 'chart', 'curve', 'grapher'],
	description: 'Plots up to five functions of x. Drag to pan, scroll or use the buttons to zoom, and point at the plot to read values.',
	layout: 'wide',
	inputs: [
		{ name: 'expr', label: 'f(x)', type: 'text', default: 'sin(x) * x' },
		{ name: 'from', label: 'From x', type: 'number', default: -10 },
		{ name: 'to', label: 'To x', type: 'number', default: 10 },
		{ name: 'steps', label: 'Points', type: 'number', min: 2, max: 200, default: 11 },
	],
	run({ expr, from, to, steps }) {
		const f = Omni.math.compile(Omni.math.parse(expr));
		const n = Math.max(2, Math.min(200, steps || 11));
		const rows = Array.from({ length: n }, (_, i) => {
			const x = from + ((to - from) * i) / (n - 1);
			return [Omni.math.format(x, 6), Omni.math.format(f({ x }), 8)];
		});
		return { table: { label: `f(x) = ${expr}`, columns: ['x', 'f(x)'], rows, numeric: [0, 1] } };
	},
	mount(root, ctx) {
		const { h } = Omni;
		// Line colors per function, borrowed from the code-view hues (signal red stays reserved for actions and errors).
		const COLORS = ['var(--ink)', '#255d86', '#2f6b45', '#8a3a12', '#5b3c8f'];
		const DARK = ['var(--ink)', '#8cc4ee', '#8fd19e', '#f0a77a', '#c4a8f0'];
		const st = ctx.store.get('state', { exprs: ['sin(x) * x', 'x^2 / 10', '', '', ''], cx: 0, cy: 0, scale: 40 });
		if (ctx.args && ctx.args.expr) st.exprs[0] = ctx.args.expr;
		const inputs = st.exprs.map((e, i) => h('input', { type: 'text', class: 'code', value: e, placeholder: i ? 'Optional' : 'For example sin(x)', 'aria-label': `Function ${i + 1}`, style: { borderLeft: `4px solid ${COLORS[i]}` } }));
		const errors = h('div', { class: 'error-text', role: 'alert' });
		const canvas = h('canvas', { class: 'plot', role: 'img', 'aria-label': 'Function plot', tabindex: '0', style: { height: '460px', cursor: 'crosshair' } });
		const trace = h('div', { class: 'readout', 'aria-live': 'polite' }, 'Point at the plot to read values.');
		let fns = [];
		const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
		const color = (i) => (i === 0 ? css('--ink') : (Omni.isDark() ? DARK : COLORS)[i]);

		const compile = () => {
			const errs = [];
			fns = inputs.map((inp, i) => {
				const src = inp.value.trim();
				if (!src) return null;
				try {
					const f = Omni.math.compile(Omni.math.parse(src));
					f({ x: 1 });
					inp.removeAttribute('aria-invalid');
					return f;
				} catch (err) {
					inp.setAttribute('aria-invalid', 'true');
					errs.push(`Function ${i + 1}: ${err.message}`);
					return null;
				}
			});
			errors.textContent = errs.join(' · ');
			st.exprs = inputs.map((i) => i.value);
			ctx.store.set('state', st);
			draw();
		};

		function niceStep(range) {
			const raw = range / 10;
			const p = 10 ** Math.floor(Math.log10(raw));
			return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
		}
		function draw() {
			const dpr = window.devicePixelRatio || 1;
			const W = canvas.clientWidth;
			const H = canvas.clientHeight;
			canvas.width = W * dpr;
			canvas.height = H * dpr;
			const g = canvas.getContext('2d');
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
			g.fillStyle = css('--surface');
			g.fillRect(0, 0, W, H);
			const toPx = (x, y) => [W / 2 + (x - st.cx) * st.scale, H / 2 - (y - st.cy) * st.scale];
			const xMin = st.cx - W / 2 / st.scale;
			const xMax = st.cx + W / 2 / st.scale;
			const yMin = st.cy - H / 2 / st.scale;
			const yMax = st.cy + H / 2 / st.scale;
			const step = niceStep(xMax - xMin);
			g.lineWidth = 1;
			g.font = '11px "Martian Mono", monospace';
			g.fillStyle = css('--muted');
			g.strokeStyle = css('--line');
			for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
				const [px] = toPx(x, 0);
				g.beginPath();
				g.moveTo(px, 0);
				g.lineTo(px, H);
				g.stroke();
				if (Math.abs(x) > step / 2) g.fillText(Omni.math.format(x, 6), px + 3, Math.min(H - 4, Math.max(12, toPx(0, 0)[1] + 14)));
			}
			for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
				const [, py] = toPx(0, y);
				g.beginPath();
				g.moveTo(0, py);
				g.lineTo(W, py);
				g.stroke();
				if (Math.abs(y) > step / 2) g.fillText(Omni.math.format(y, 6), Math.min(W - 40, Math.max(4, toPx(0, 0)[0] + 4)), py - 3);
			}
			g.strokeStyle = css('--edge');
			g.lineWidth = 1.5;
			const [ox, oy] = toPx(0, 0);
			g.beginPath();
			g.moveTo(0, oy);
			g.lineTo(W, oy);
			g.moveTo(ox, 0);
			g.lineTo(ox, H);
			g.stroke();
			fns.forEach((f, i) => {
				if (!f) return;
				g.strokeStyle = color(i);
				g.lineWidth = 2;
				g.beginPath();
				let pen = false;
				let prevY = null;
				for (let px = 0; px <= W; px++) {
					const x = xMin + px / st.scale;
					let y;
					try {
						y = f({ x });
					} catch {
						y = NaN;
					}
					const py = H / 2 - (y - st.cy) * st.scale;
					// Lift the pen at gaps and at vertical asymptotes (tan, 1/x) instead of drawing a wall.
					if (!Number.isFinite(y) || (prevY !== null && Math.abs(py - prevY) > H * 2)) {
						pen = false;
						prevY = Number.isFinite(y) ? py : null;
						continue;
					}
					if (pen) g.lineTo(px, py);
					else g.moveTo(px, py);
					pen = true;
					prevY = py;
				}
				g.stroke();
			});
		}

		let drag = null;
		canvas.addEventListener('pointerdown', (e) => {
			canvas.setPointerCapture(e.pointerId);
			drag = { x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy };
		});
		canvas.addEventListener('pointermove', (e) => {
			const r = canvas.getBoundingClientRect();
			const x = st.cx + (e.clientX - r.left - r.width / 2) / st.scale;
			if (drag) {
				st.cx = drag.cx - (e.clientX - drag.x) / st.scale;
				st.cy = drag.cy + (e.clientY - drag.y) / st.scale;
				draw();
			}
			const vals = fns.map((f, i) => {
				if (!f) return null;
				try {
					return `f${i + 1}(${Omni.math.format(x, 5)}) = ${Omni.math.format(f({ x }), 6)}`;
				} catch {
					return null;
				}
			}).filter(Boolean);
			trace.textContent = vals.length ? vals.join('\n') : 'Enter a function.';
		});
		const endDrag = () => {
			if (drag) ctx.store.set('state', st);
			drag = null;
		};
		canvas.addEventListener('pointerup', endDrag);
		canvas.addEventListener('pointercancel', endDrag);
		const zoom = (factor) => {
			st.scale = Math.max(0.5, Math.min(5000, st.scale * factor));
			ctx.store.set('state', st);
			draw();
		};
		canvas.addEventListener('wheel', (e) => {
			e.preventDefault();
			zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
		}, { passive: false });
		canvas.addEventListener('keydown', (e) => {
			const pan = 40 / st.scale;
			const moves = { ArrowLeft: [-pan, 0], ArrowRight: [pan, 0], ArrowUp: [0, pan], ArrowDown: [0, -pan] };
			if (moves[e.key]) {
				e.preventDefault();
				st.cx += moves[e.key][0];
				st.cy += moves[e.key][1];
				draw();
			} else if (e.key === '+' || e.key === '=') zoom(1.25);
			else if (e.key === '-') zoom(0.8);
		});
		inputs.forEach((i) => i.addEventListener('input', Omni.util.debounce(compile, 250)));
		const ro = new ResizeObserver(() => draw());
		ro.observe(canvas);
		const offTheme = Omni.on('theme', () => requestAnimationFrame(draw));
		root.appendChild(h('div', { class: 'io aside-left' },
			h('div', { class: 'panel stack' }, h('h2', null, 'Functions of x'), ...inputs, errors, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => zoom(1.25) }, 'Zoom in'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => zoom(0.8) }, 'Zoom out'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => ((st.cx = 0), (st.cy = 0), (st.scale = 40), ctx.store.set('state', st), draw()) }, 'Reset view')), h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Keyboard: focus the plot, then arrows pan and + or - zoom.'), trace),
			h('div', { class: 'panel' }, canvas),
		));
		compile();
		return () => {
			ro.disconnect();
			offTheme();
		};
	},
});
