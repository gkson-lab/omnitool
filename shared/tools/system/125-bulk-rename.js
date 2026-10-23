// No. 125 Bulk file renamer (desktop): pattern-based renames with a full preview; nothing changes until you confirm.
Omni.register({
	no: 125,
	id: 'bulk-rename',
	name: 'Bulk file renamer',
	category: 'system',
	editions: ['desktop'],
	keywords: ['rename', 'bulk', 'batch', 'files', 'numbering', 'pattern'],
	description: 'Renames many files in a folder with find and replace, numbering, case and extension rules. Shows every new name first and asks before renaming.',
	ai: false,
	layout: 'wide',
	mount(root, ctx) {
		const { h } = Omni;
		let folder = ctx.store.get('folder', null);
		let files = [];
		const st = ctx.store.get('rules', { pattern: '{name}{ext}', find: '', replace: '', regex: false, case: 'keep', start: 1, pad: 2, only: '' });
		const folderLabel = h('code', null, folder || 'No folder chosen');
		const inp = (id, label, value, attrs) => {
			const el = h('input', { id: `br-${id}`, value, ...attrs });
			return [el, h('div', { class: 'field' }, h('label', { for: `br-${id}` }, label), el)];
		};
		const [pattern, patternF] = inp('pattern', 'New name pattern', st.pattern, { type: 'text', class: 'code' });
		const [find, findF] = inp('find', 'Find', st.find, { type: 'text' });
		const [replace, replaceF] = inp('replace', 'Replace with', st.replace, { type: 'text' });
		const [start, startF] = inp('start', 'Numbering starts at', st.start, { type: 'number', min: 0 });
		const [pad, padF] = inp('pad', 'Number digits', st.pad, { type: 'number', min: 1, max: 8 });
		const [only, onlyF] = inp('only', 'Only files ending in (optional)', st.only, { type: 'text', placeholder: '.jpg' });
		const regex = h('input', { type: 'checkbox', id: 'br-regex', checked: st.regex });
		const caseSel = h('select', { id: 'br-case' }, [['keep', 'Keep case'], ['lower', 'lowercase'], ['upper', 'UPPERCASE'], ['title', 'Title Case'], ['kebab', 'kebab-case'], ['snake', 'snake_case']].map(([v, l]) => h('option', { value: v }, l)));
		caseSel.value = st.case;
		const preview = h('div');
		const applyBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Rename files');
		let plan = [];

		const compute = () => {
			const rules = { pattern: pattern.value, find: find.value, replace: replace.value, regex: regex.checked, case: caseSel.value, start: Number(start.value) || 0, pad: Number(pad.value) || 1, only: only.value.trim() };
			ctx.store.set('rules', rules);
			const chosen = files.filter((f) => !rules.only || f.toLowerCase().endsWith(rules.only.toLowerCase()));
			let re = null;
			if (rules.find) {
				try {
					re = rules.regex ? new RegExp(rules.find, 'g') : new RegExp(rules.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
				} catch (err) {
					preview.replaceChildren(Omni.forms.stateBox('error', 'The find pattern is not a valid regex.', err.message));
					return [];
				}
			}
			const caseFn = { keep: (s) => s, lower: (s) => s.toLowerCase(), upper: (s) => s.toUpperCase(), title: (s) => Omni.caseStyles.all(s).title, kebab: (s) => Omni.caseStyles.all(s).kebab, snake: (s) => Omni.caseStyles.all(s).snake }[rules.case];
			return chosen.map((file, i) => {
				const dot = file.lastIndexOf('.');
				let name = dot > 0 ? file.slice(0, dot) : file;
				const ext = dot > 0 ? file.slice(dot) : '';
				if (re) name = name.replace(re, rules.replace);
				name = caseFn(name);
				const n = String(rules.start + i).padStart(rules.pad, '0');
				const out = rules.pattern.replace(/\{name\}/g, name).replace(/\{ext\}/g, ext).replace(/\{n\}/g, n).replace(/\{date\}/g, new Date().toISOString().slice(0, 10));
				return { from: file, to: out.trim() };
			});
		};
		const draw = () => {
			if (!folder) return preview.replaceChildren(Omni.forms.stateBox('empty', null, 'Choose a folder to see its files.'));
			plan = compute();
			const targets = new Map();
			plan.forEach((p) => targets.set(p.to.toLowerCase(), (targets.get(p.to.toLowerCase()) || 0) + 1));
			const unchanged = new Set(files.map((f) => f.toLowerCase()));
			const rows = plan.map((p) => {
				const bad = !p.to || /[\\/:*?"<>|]/.test(p.to) ? 'invalid name' : targets.get(p.to.toLowerCase()) > 1 ? 'duplicate' : p.to !== p.from && unchanged.has(p.to.toLowerCase()) && !plan.some((q) => q.from.toLowerCase() === p.to.toLowerCase()) ? 'name taken' : p.to === p.from ? 'unchanged' : 'ok';
				return [p.from, p.to, bad];
			});
			const problems = rows.filter((r) => !['ok', 'unchanged'].includes(r[2])).length;
			applyBtn.disabled = !!problems || !rows.some((r) => r[2] === 'ok');
			preview.replaceChildren(Omni.forms.readings([{ label: 'Files', value: plan.length, copy: false }, { label: 'Will change', value: rows.filter((r) => r[2] === 'ok').length, copy: false }, { label: 'Problems', value: problems, copy: false }]), Omni.forms.block('Preview', Omni.forms.table(['Current name', 'New name', 'Check'], rows)));
		};
		const load = async () => {
			try {
				files = await Omni.native.rename.list(folder);
			} catch (err) {
				files = [];
				preview.replaceChildren(Omni.forms.stateBox('error', 'Could not read the folder.', err.message));
				return;
			}
			draw();
		};
		applyBtn.onclick = async () => {
			const changes = plan.filter((p) => p.from !== p.to);
			if (!(await Omni.ui.confirm({ title: `Rename ${changes.length} files?`, body: `In ${folder}. A file list with the old names is saved as omnitool-rename-undo.json in that folder so you can see what changed.`, confirmLabel: 'Rename files' }))) return;
			try {
				const r = await Omni.native.rename.apply(folder, changes);
				Omni.ui.toast(`Renamed ${r.renamed} files.`);
			} catch (err) {
				Omni.ui.toast(err.message, { error: true, title: 'Renaming stopped.' });
			}
			load();
		};
		[pattern, find, replace, start, pad, only].forEach((el) => el.addEventListener('input', Omni.util.debounce(draw, 150)));
		[regex, caseSel].forEach((el) => el.addEventListener('change', draw));
		root.appendChild(h('div', { class: 'stack-lg' },
			h('div', { class: 'panel stack' },
				h('div', { class: 'row' }, h('p', null, 'Folder: ', folderLabel), h('button', { type: 'button', class: 'btn btn-small', onclick: async () => {
					const f = await Omni.native.dialog.openFolder();
					if (!f) return;
					folder = f;
					ctx.store.set('folder', f);
					folderLabel.textContent = f;
					load();
				} }, 'Choose folder')),
				h('div', { class: 'fields' }, patternF, findF, replaceF, h('div', { class: 'field check' }, regex, h('label', { for: 'br-regex' }, 'Find is a regex')), h('div', { class: 'field' }, h('label', { for: 'br-case' }, 'Case'), caseSel), startF, padF, onlyF),
				h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Pattern tokens: {name} the name after find/replace and case, {ext} the extension with its dot, {n} the number, {date} today.'),
				h('div', { class: 'form-actions' }, applyBtn),
			),
			h('section', { class: 'panel', 'aria-label': 'Preview' }, preview),
		));
		if (folder) load();
		else draw();
	},
});
