// No. 066 Scientific calculator: keypad and typed expressions, degrees or radians, memory and history.
Omni.register({
	no: 66,
	id: 'scientific',
	name: 'Scientific calculator',
	category: 'math',
	keywords: ['calculator', 'scientific', 'math', 'sin', 'cos', 'log', 'sqrt', 'calculate', 'evaluate'],
	description: 'Type or tap expressions with functions, constants and powers. Degrees or radians, memory, and a history you can reuse.',
	inputs: [
		{ name: 'expression', label: 'Expression', type: 'text', default: '2^10 / 3' },
		{ name: 'degrees', label: 'Angles in degrees', type: 'checkbox', default: false },
	],
	run({ expression, degrees }) {
		const v = Omni.math.evaluate(expression, {}, { degrees });
		return { text: Omni.math.format(v), big: true, label: expression };
	},
	mount(root, ctx) {
		const { h } = Omni;
		const M = Omni.math;
		let memory = ctx.store.get('memory', 0);
		let history = ctx.store.get('history', []);
		let ans = history.length ? history[0].value : 0;
		const expr = h('input', { type: 'text', class: 'code', id: 'sci-expr', 'aria-label': 'Expression', autocomplete: 'off', style: { fontSize: '1.2rem', minHeight: '52px' } });
		const preview = h('div', { class: 'readout big', 'aria-live': 'polite', style: { textAlign: 'right' } }, '0');
		const deg = h('input', { type: 'checkbox', id: 'sci-deg', checked: ctx.store.get('degrees', false), onchange: () => (ctx.store.set('degrees', deg.checked), live()) });
		const memLabel = h('span', { class: 'chip' }, `M = ${M.format(memory)}`);
		const hist = h('ul', { class: 'list', 'aria-label': 'History' });
		if (ctx.args && ctx.args.expression) expr.value = ctx.args.expression;

		const evalNow = () => M.evaluate(expr.value.replace(/\bans\b/g, `(${ans})`), { ans }, { degrees: deg.checked });
		function live() {
			if (!expr.value.trim()) {
				preview.textContent = '0';
				return;
			}
			try {
				preview.textContent = M.format(evalNow());
				expr.removeAttribute('aria-invalid');
			} catch {
				preview.textContent = '...';
			}
		}
		function equals() {
			try {
				const v = evalNow();
				history = [{ expr: expr.value, value: v }, ...history].slice(0, 40);
				ctx.store.set('history', history);
				ans = v;
				expr.value = M.format(v);
				expr.removeAttribute('aria-invalid');
				drawHistory();
				live();
			} catch (err) {
				expr.setAttribute('aria-invalid', 'true');
				preview.textContent = err.message;
			}
		}
		const insert = (s) => {
			const start = expr.selectionStart ?? expr.value.length;
			const end = expr.selectionEnd ?? expr.value.length;
			expr.value = expr.value.slice(0, start) + s + expr.value.slice(end);
			const pos = start + s.length - (s.endsWith('()') ? 1 : 0);
			expr.focus();
			expr.setSelectionRange(pos, pos);
			live();
		};
		const memOp = (op) => {
			let v = 0;
			try {
				v = evalNow();
			} catch {
				v = ans;
			}
			if (op === 'MC') memory = 0;
			if (op === 'M+') memory += v;
			if (op === 'M-') memory -= v;
			if (op === 'MR') return insert(M.format(memory));
			ctx.store.set('memory', memory);
			memLabel.textContent = `M = ${M.format(memory)}`;
		};
		function drawHistory() {
			hist.replaceChildren(...(history.length ? history.map((x) => h('li', null, h('button', { type: 'button', class: 'btn-quiet grow', style: { border: 0, background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }, onclick: () => ((expr.value = x.expr), live(), expr.focus()) }, h('span', { class: 'mono muted', style: { fontSize: '0.8rem' } }, x.expr), h('br'), h('strong', { class: 'mono' }, '= ' + M.format(x.value))))) : [h('li', null, h('span', { class: 'muted' }, 'Results you calculate appear here.'))]));
		}
		const keys = [
			['sin(', 'cos(', 'tan(', 'ln(', 'log(', '√('],
			['asin(', 'acos(', 'atan(', 'x²', '^', '!'],
			['(', ')', 'π', 'e', 'ans', '%'],
			['7', '8', '9', '/', 'MC', 'MR'],
			['4', '5', '6', '*', 'M+', 'M-'],
			['1', '2', '3', '-', 'C', '⌫'],
			['0', '.', 'E', '+', '='],
		];
		const press = (k) => {
			if (k === '=') return equals();
			if (k === 'C') return ((expr.value = ''), live(), expr.focus());
			if (k === '⌫') return ((expr.value = expr.value.slice(0, -1)), live(), expr.focus());
			if (['MC', 'MR', 'M+', 'M-'].includes(k)) return memOp(k);
			if (k === 'x²') return insert('^2');
			if (k === '√(') return insert('sqrt()');
			if (k === 'E') return insert('e');
			if (k === '%') return insert(' mod ');
			if (k.endsWith('(')) return insert(k + ')');
			return insert(k);
		};
		const pad = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' } }, keys.flat().map((k) => h('button', { type: 'button', class: 'btn' + (k === '=' ? ' btn-primary' : ''), style: { minHeight: '44px', padding: '0 4px', gridColumn: k === '=' ? 'span 2' : null }, 'aria-label': { '⌫': 'Delete last character', '√(': 'Square root', 'x²': 'Square', '^': 'Power', '!': 'Factorial', '%': 'Modulo', C: 'Clear', E: 'Euler number' }[k] || null, onclick: () => press(k) }, k)));
		expr.addEventListener('input', live);
		expr.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				equals();
			} else if (e.key === 'Escape') {
				expr.value = '';
				live();
			}
		});
		root.appendChild(h('div', { class: 'io split' },
			h('div', { class: 'panel stack' }, h('label', { for: 'sci-expr', class: 'field-label' }, 'Expression (Enter to calculate)'), expr, preview, h('div', { class: 'row between' }, h('div', { class: 'field check' }, deg, h('label', { for: 'sci-deg' }, 'Degrees')), memLabel), pad),
			h('section', { class: 'panel stack', 'aria-label': 'History' }, h('div', { class: 'row between' }, h('h2', null, 'History'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => ((history = []), ctx.store.set('history', history), drawHistory()) }, 'Clear')), hist, h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, `Functions: ${M.FUNCTIONS.join(', ')}. Constants: pi, e, tau, phi.`)),
		));
		drawHistory();
		live();
		expr.focus();
	},
});
