// No. 023 Chmod calculator: a permission grid that stays in sync with the octal and rwx forms.
Omni.register({
	no: 23,
	id: 'chmod',
	name: 'Chmod calculator',
	category: 'code',
	keywords: ['chmod', 'permissions', 'unix', 'linux', 'octal', 'rwx'],
	description: 'Converts Unix file permissions between a checkbox grid, octal (755) and symbolic (rwxr-xr-x) forms.',
	inputs: [{ name: 'octal', label: 'Octal', type: 'text', default: '755' }],
	run({ octal }) {
		const v = String(octal).trim();
		if (!/^[0-7]{3,4}$/.test(v)) throw new Error('Use 3 or 4 octal digits, for example 755 or 4755.');
		const digits = v.padStart(4, '0').split('').map(Number);
		const sym = digits.slice(1).map((d, i) => {
			let s = (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-');
			const special = digits[0] & (4 >> i);
			s += d & 1 ? (special ? (i === 2 ? 't' : 's') : 'x') : special ? (i === 2 ? 'T' : 'S') : '-';
			return s;
		}).join('');
		return { readings: [{ label: 'Symbolic', value: sym }, { label: 'Octal', value: v }, { label: 'Command', value: `chmod ${v} file` }] };
	},
	mount(root, ctx) {
		const { h } = Omni;
		const who = ['Owner', 'Group', 'Others'];
		const what = [['Read', 4], ['Write', 2], ['Execute', 1]];
		const special = [['setuid', 4, 'Runs as the file owner'], ['setgid', 2, 'Runs as the group / new files inherit the group'], ['sticky', 1, 'Only owners can delete in this folder']];
		let mode = ctx.store.get('mode', '0755').padStart(4, '0');
		const boxes = who.map((w, i) => what.map(([label, bit]) => h('input', { type: 'checkbox', id: `chmod-${i}-${bit}`, 'aria-label': `${w} ${label}`, onchange: fromGrid })));
		const spec = special.map(([label, bit]) => h('input', { type: 'checkbox', id: `chmod-s-${bit}`, onchange: fromGrid }));
		const octal = h('input', { type: 'text', id: 'chmod-octal', class: 'code', inputmode: 'numeric', maxlength: 4, oninput: () => {
			if (/^[0-7]{3,4}$/.test(octal.value)) {
				octal.removeAttribute('aria-invalid');
				mode = octal.value.padStart(4, '0');
				draw(false);
			} else octal.setAttribute('aria-invalid', 'true');
		} });
		const out = h('div');
		function fromGrid() {
			const d = boxes.map((row) => row.reduce((n, b, k) => n + (b.checked ? what[k][1] : 0), 0));
			const s = spec.reduce((n, b, k) => n + (b.checked ? special[k][1] : 0), 0);
			mode = `${s}${d.join('')}`;
			draw(true);
		}
		function draw(updateOctal) {
			const digits = mode.split('').map(Number);
			boxes.forEach((row, i) => row.forEach((b, k) => (b.checked = !!(digits[i + 1] & what[k][1]))));
			spec.forEach((b, k) => (b.checked = !!(digits[0] & special[k][1])));
			const short = digits[0] ? mode : mode.slice(1);
			if (updateOctal) octal.value = short;
			ctx.store.set('mode', mode);
			Omni.forms.renderOutput(resultFor(short), out);
		}
		const resultFor = (v) => Omni.byId.chmod.run({ octal: v });
		const grid = h('table', { class: 'data', style: { maxWidth: '520px' } },
			h('thead', null, h('tr', null, h('th', null, ''), what.map(([l]) => h('th', { scope: 'col' }, l)))),
			h('tbody', null, who.map((w, i) => h('tr', null, h('th', { scope: 'row' }, w), boxes[i].map((b) => h('td', null, b))))),
		);
		root.appendChild(h('div', { class: 'io split' },
			h('div', { class: 'panel stack' }, h('div', { class: 'table-wrap' }, grid), h('div', { class: 'stack' }, special.map(([label, , hint], k) => h('div', { class: 'field check' }, spec[k], h('label', { for: spec[k].id }, `${label}: ${hint}`)))), h('div', { class: 'field' }, h('label', { for: 'chmod-octal' }, 'Octal'), octal)),
			h('section', { class: 'panel', 'aria-label': 'Result', 'aria-live': 'polite' }, out),
		));
		draw(true);
	},
});
