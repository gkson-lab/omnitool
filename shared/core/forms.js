// Renders a declarative tool (inputs + run) as a form and its results as readouts, tables and scales.
(function () {
	'use strict';
	const { h, icon } = Omni;
	const { copy, download, debounce } = Omni.util;

	/* ---------- Output building blocks ---------- */

	function copyButton(getText, label) {
		return h(
			'button',
			{ type: 'button', class: 'btn btn-small btn-quiet copy', onclick: () => copy(typeof getText === 'function' ? getText() : getText), 'aria-label': label || 'Copy' },
			icon('copy'),
			h('span', null, 'Copy'),
		);
	}

	/** The gklabs scale: 20 ticks, filled to `value` (0 to 1). */
	function scale(value) {
		const n = Math.round(Math.max(0, Math.min(1, value || 0)) * 20);
		return h('div', { class: 'scale', role: 'presentation' }, Array.from({ length: 20 }, (_, i) => h('i', { class: i < n ? 'on' : '' })));
	}

	function meter(value, label, text) {
		return h(
			'div',
			{ class: 'meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((value || 0) * 100), 'aria-label': label },
			h('div', { class: 'meter-label' }, h('span', null, label), h('b', null, text != null ? text : Math.round((value || 0) * 100) + '%')),
			scale(value),
		);
	}

	function readings(items) {
		return h(
			'dl',
			{ class: 'readings' },
			items.map((it) =>
				h(
					'div',
					{ class: 'reading' },
					h('dt', null, it.label),
					h('dd', null, h('span', null, it.value == null || it.value === '' ? '-' : String(it.value)), it.copy === false || it.value == null || it.value === '' ? null : copyButton(String(it.value), `Copy ${it.label}`)),
				),
			),
		);
	}

	function toCsv(columns, rows) {
		const cell = (v) => {
			const s = v == null ? '' : String(v);
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};
		return [columns.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
	}

	function table(columns, rows, opts) {
		const numeric = (opts && opts.numeric) || [];
		return h(
			'div',
			{ class: 'table-wrap' },
			h(
				'table',
				{ class: 'data' },
				h('thead', null, h('tr', null, columns.map((c, i) => h('th', { class: numeric.includes(i) ? 'num' : '', scope: 'col' }, c)))),
				h('tbody', null, rows.map((r) => h('tr', null, r.map((v, i) => h('td', { class: numeric.includes(i) ? 'num' : '' }, v == null ? '' : v instanceof Node ? v : String(v)))))),
			),
		);
	}

	function block(label, content, actions) {
		return h('div', { class: 'out-block' }, label || actions ? h('div', { class: 'out-head' }, h('span', { class: 'label' }, label || ''), h('div', { class: 'row' }, actions || [])) : null, content);
	}

	function stateBox(kind, title, detail, action) {
		return h('div', { class: 'state' + (kind === 'error' ? ' state-error' : ''), role: kind === 'error' ? 'alert' : 'status' }, title ? h('strong', null, title) : null, detail ? h('span', null, detail) : null, action || null);
	}

	/** Normalizes anything a tool returns into a list of typed blocks. */
	function normalize(result) {
		if (result == null) return [];
		if (typeof result === 'string' || typeof result === 'number') return [{ type: 'text', value: String(result) }];
		if (result instanceof Node) return [{ type: 'node', node: result }];
		if (Array.isArray(result)) return result.flatMap(normalize);
		if (result.type) return [result];
		const out = [];
		if (result.error) out.push({ type: 'error', message: result.error });
		if (result.text != null) out.push({ type: 'text', value: String(result.text), label: result.label, big: result.big, lang: result.lang });
		if (result.readings) out.push({ type: 'readings', items: result.readings, label: result.readingsLabel });
		if (result.meter) out.push({ type: 'meter', ...result.meter });
		if (result.table) out.push({ type: 'table', ...result.table });
		if (result.html != null) out.push({ type: 'html', html: result.html, label: result.htmlLabel });
		if (result.image) out.push({ type: 'image', ...result.image });
		if (result.node) out.push({ type: 'node', node: result.node });
		if (result.blocks) out.push(...result.blocks.filter(Boolean).flatMap(normalize));
		if (result.download) out.push({ type: 'download', ...result.download });
		if (result.note) out.push({ type: 'note', value: result.note });
		return out;
	}

	function renderBlock(b) {
		switch (b.type) {
			case 'text': {
				const pre = h('pre', { class: 'readout' + (b.big ? ' big' : ''), tabindex: '0' }, b.value);
				return block(b.label || 'Result', pre, [copyButton(b.value, `Copy ${b.label || 'result'}`)]);
			}
			case 'readings':
				return block(b.label || null, readings(b.items));
			case 'meter':
				return block(null, meter(b.value, b.label, b.text));
			case 'table':
				return block(b.label || `${Omni.util.fmt.plural(b.rows.length, 'row')}`, table(b.columns, b.rows, b), [
					copyButton(() => toCsv(b.columns, b.rows.map((r) => r.map((v) => (v instanceof Node ? v.textContent : v)))), 'Copy as CSV'),
				]);
			case 'html':
				return block(b.label || null, h('div', { class: 'html-out', html: b.html }));
			case 'image': {
				const img = h('img', { src: b.src, alt: b.alt || '' });
				return block(b.label || 'Image', h('div', { class: 'preview-box' }, img), b.name ? [h('button', { type: 'button', class: 'btn btn-small', onclick: () => download(b.name, Omni.util.dataUrlToBlob(b.src)) }, icon('download'), `Download ${b.name}`)] : null);
			}
			case 'download':
				return h('div', { class: 'out-block' }, h('button', { type: 'button', class: 'btn', onclick: () => download(b.name, b.data, b.mime) }, icon('download'), b.label || `Download ${b.name}`));
			case 'note':
				return h('p', { class: 'out-block muted', style: { fontSize: '0.86rem' } }, b.value);
			case 'error':
				return h('div', { class: 'out-block' }, stateBox('error', 'That did not work.', b.message));
			case 'node':
				return h('div', { class: 'out-block' }, b.node);
			default:
				return null;
		}
	}

	function renderOutput(result, container) {
		container.replaceChildren();
		const blocks = normalize(result);
		if (!blocks.length) {
			container.appendChild(stateBox('empty', null, 'Nothing to show for these inputs.'));
			return;
		}
		blocks.forEach((b) => {
			const el = renderBlock(b);
			if (el) container.appendChild(el);
		});
	}

	/** Plain-JSON version of a result for Omni Agent; large text is cut so a tool can't flood the model. */
	function summarize(result) {
		const cut = (s, n = 20000) => (s.length > n ? s.slice(0, n) + `\n[cut: ${s.length - n} more characters]` : s);
		const blocks = normalize(result);
		const texts = new Set(blocks.filter((b) => b.type === 'text').map((b) => String(b.value).trim()));
		return blocks.map((b) => {
			switch (b.type) {
				case 'text':
					return { [b.label || 'result']: cut(b.value) };
				case 'readings':
					return Object.fromEntries(b.items.map((i) => [i.label, i.value]));
				case 'meter':
					return { [b.label]: b.text != null ? b.text : Math.round(b.value * 100) + '%' };
				case 'table':
					return { columns: b.columns, rows: b.rows.slice(0, 100).map((r) => r.map((v) => (v instanceof Node ? v.textContent : v))), totalRows: b.rows.length };
				case 'html': {
					const div = document.createElement('div');
					div.innerHTML = b.html;
					return { [b.label || 'content']: cut(div.textContent || '', 8000) };
				}
				case 'image':
					return { image: b.name || 'image shown in the tool' };
				case 'download':
					// Many tools also offer their text result as a file; sending it twice only doubles the tokens.
					if (typeof b.data === 'string' && texts.has(b.data.trim())) return { file: b.name, content: 'same as the text result' };
					return { file: b.name, content: typeof b.data === 'string' ? cut(b.data) : '[binary]' };
				case 'note':
					return { note: b.value };
				case 'error':
					return { error: b.message };
				case 'node':
					return { view: (b.node.textContent || '').slice(0, 4000) };
				default:
					return {};
			}
		});
	}

	/* ---------- Inputs ---------- */

	let uid = 0;
	function optionList(options) {
		const list = typeof options === 'function' ? options() : options;
		return list.map((o) => (typeof o === 'object' ? o : { value: String(o), label: String(o) }));
	}

	/** Builds one input from its spec; returns { el, get, set, spec }. */
	function field(spec, value, onChange) {
		const id = `f${++uid}-${spec.name}`;
		const fire = () => onChange && onChange(spec.name);
		let control;
		let get;
		let set;
		const wrap = h('div', { class: 'field' + (spec.wide || spec.type === 'textarea' ? ' wide' : '') + (spec.type === 'checkbox' ? ' check' : '') });

		switch (spec.type) {
			case 'textarea':
				control = h('textarea', { id, rows: spec.rows || 6, class: spec.mono ? 'code' : '', placeholder: spec.placeholder || '', spellcheck: spec.mono ? 'false' : 'true', oninput: fire });
				control.value = value ?? '';
				get = () => control.value;
				set = (v) => (control.value = v ?? '');
				break;
			case 'select':
				control = h('select', { id, onchange: fire }, optionList(spec.options).map((o) => h('option', { value: o.value }, o.label)));
				control.value = value ?? '';
				get = () => control.value;
				set = (v) => (control.value = v);
				break;
			case 'checkbox':
				control = h('input', { id, type: 'checkbox', onchange: fire });
				control.checked = !!value;
				get = () => control.checked;
				set = (v) => (control.checked = !!v);
				break;
			case 'seg': {
				const opts = optionList(spec.options);
				let current = value ?? opts[0].value;
				const buttons = opts.map((o) =>
					h('button', { type: 'button', 'aria-pressed': String(o.value === current), onclick: () => {
						current = o.value;
						buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i].value === current)));
						fire();
					} }, o.label),
				);
				control = h('div', { class: 'seg', role: 'group', 'aria-labelledby': id + '-label' }, buttons);
				get = () => current;
				set = (v) => {
					current = v;
					buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i].value === current)));
				};
				break;
			}
			case 'file': {
				let files = [];
				const input = h('input', { id, type: 'file', accept: spec.accept || '', multiple: !!spec.multiple, class: 'sr-only', onchange: () => take(input.files) });
				const label = h('span', null, spec.placeholder || 'Drop a file here or');
				const chosen = h('span', { class: 'muted', style: { fontSize: '0.84rem' } }, '');
				const take = (list) => {
					files = Array.from(list || []);
					chosen.textContent = files.length ? files.map((f) => `${f.name} (${Omni.util.fmt.bytes(f.size)})`).join(', ') : '';
					fire();
				};
				const pick = h('label', { for: id, class: 'btn btn-small', tabindex: '0', onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()) }, spec.multiple ? 'Choose files' : 'Choose a file');
				control = h('div', {
					class: 'dropzone',
					ondragover: (e) => {
						e.preventDefault();
						control.classList.add('over');
					},
					ondragleave: () => control.classList.remove('over'),
					ondrop: (e) => {
						e.preventDefault();
						control.classList.remove('over');
						take(e.dataTransfer.files);
					},
				}, label, pick, input, chosen);
				get = () => (spec.multiple ? files : files[0] || null);
				set = () => {};
				break;
			}
			default: {
				const type = { number: 'number', password: 'password', color: 'color', range: 'range', date: 'date', time: 'time', datetime: 'datetime-local', url: 'url', email: 'email' }[spec.type] || 'text';
				control = h('input', {
					id,
					type,
					class: spec.mono ? 'code' : '',
					placeholder: spec.placeholder || '',
					min: spec.min,
					max: spec.max,
					step: spec.step,
					autocomplete: type === 'password' ? 'new-password' : 'off',
					spellcheck: 'false',
					inputmode: spec.inputmode,
					oninput: fire,
				});
				control.value = value ?? '';
				get = () => {
					if (type === 'number' || type === 'range') return control.value === '' ? null : Number(control.value);
					return control.value;
				};
				set = (v) => (control.value = v ?? '');
			}
		}

		const labelEl = spec.type === 'checkbox' ? h('label', { for: id }, spec.label) : h(spec.type === 'seg' || spec.type === 'file' ? 'span' : 'label', { for: spec.type === 'seg' ? null : id, id: id + '-label', class: 'field-label' }, spec.label);
		if (spec.type === 'checkbox') Omni.append(wrap, [control, labelEl]);
		else Omni.append(wrap, [labelEl, control]);
		if (spec.hint) wrap.appendChild(h('span', { class: 'hint', id: id + '-hint' }, spec.hint));
		if (spec.hint && control.setAttribute) control.setAttribute('aria-describedby', id + '-hint');
		return { el: wrap, get, set, spec, control };
	}

	function defaultsFor(tool) {
		const out = {};
		for (const spec of tool.inputs) {
			const d = typeof spec.default === 'function' ? spec.default() : spec.default;
			if (d !== undefined) out[spec.name] = d;
			else if (spec.type === 'checkbox') out[spec.name] = false;
			else if (spec.type === 'select' || spec.type === 'seg') out[spec.name] = optionList(spec.options)[0].value;
			else if (spec.type === 'number' || spec.type === 'range') out[spec.name] = null;
			else out[spec.name] = '';
		}
		return out;
	}

	/** Coerces loosely typed arguments (from the agent or a URL) to what the tool's inputs expect. */
	function coerce(tool, args) {
		const out = defaultsFor(tool);
		for (const spec of tool.inputs) {
			if (!(spec.name in (args || {}))) continue;
			let v = args[spec.name];
			if (spec.type === 'number' || spec.type === 'range') v = v === '' || v == null ? null : Number(v);
			else if (spec.type === 'checkbox') v = v === true || v === 'true' || v === 1 || v === 'yes';
			else if (spec.type === 'file') continue;
			else if (v != null) v = String(v);
			if ((spec.type === 'select' || spec.type === 'seg') && !optionList(spec.options).some((o) => o.value === v)) {
				const byLabel = optionList(spec.options).find((o) => o.label.toLowerCase() === String(v).toLowerCase());
				if (!byLabel) throw new Error(`${spec.label} must be one of: ${optionList(spec.options).map((o) => o.value).join(', ')}`);
				v = byLabel.value;
			}
			out[spec.name] = v;
		}
		return out;
	}

	/** Runs a declarative tool outside its page (Omni Agent, offline commands, self-test). */
	async function runTool(id, args) {
		const tool = Omni.byId[id];
		if (!tool) throw new Error(`No tool with id "${id}" in this edition`);
		if (!tool.run) throw new Error(`${tool.name} is interactive only; open it with open_tool instead`);
		if (tool.vendor) await Omni.vendor(tool.vendor);
		return tool.run(coerce(tool, args), { store: Omni.store.scope('tool.' + tool.id), native: Omni.native, headless: true });
	}

	/* ---------- Form renderer for declarative tools ---------- */

	function renderTool(tool, root, ctx) {
		const saved = tool.remember === false ? {} : Omni.store.get('inputs.' + tool.id, {});
		const start = Object.assign(defaultsFor(tool), saved, ctx.args || {});
		const fields = [];
		const output = h('div', { class: 'output', 'aria-live': 'polite' });
		let runId = 0;

		const values = () => Object.fromEntries(fields.map((f) => [f.spec.name, f.get()]));
		const updateVisibility = () => {
			const v = values();
			fields.forEach((f) => (f.el.hidden = f.spec.when ? !f.spec.when(v) : false));
		};
		const persist = () => {
			if (tool.remember === false) return;
			const v = values();
			for (const spec of tool.inputs) if (spec.type === 'password' || spec.type === 'file' || spec.remember === false) delete v[spec.name];
			Omni.store.set('inputs.' + tool.id, v);
		};

		const run = async () => {
			const mine = ++runId;
			const args = values();
			persist();
			const slow = setTimeout(() => mine === runId && output.replaceChildren(stateBox('loading', null, h('span', { class: 'loading-text' }, tool.busyText || 'Working'))), 150);
			try {
				if (tool.vendor) await Omni.vendor(tool.vendor);
				const result = await tool.run(args, { ...ctx, output });
				if (mine !== runId) return;
				clearTimeout(slow);
				renderOutput(result, output);
			} catch (err) {
				if (mine !== runId) return;
				clearTimeout(slow);
				output.replaceChildren(stateBox('error', 'That did not work.', err && err.message ? err.message : String(err)));
			}
		};
		const liveRun = debounce(run, tool.liveDelay || 220);

		const onChange = () => {
			updateVisibility();
			if (tool.live) liveRun();
			else persist();
		};
		for (const spec of tool.inputs) fields.push(field(spec, start[spec.name], onChange));

		const form = h(
			'form',
			{
				class: 'panel',
				novalidate: true,
				onsubmit: (e) => {
					e.preventDefault();
					run();
				},
			},
			h('div', { class: 'fields' }, fields.map((f) => f.el)),
			tool.live
				? null
				: h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, tool.action || 'Run'), tool.extraActions ? tool.extraActions(values, (patch) => {
					for (const f of fields) if (f.spec.name in patch) f.set(patch[f.spec.name]);
					onChange();
				}) : null),
		);
		// Ctrl+Enter runs from inside a textarea, where Enter adds a line.
		form.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				run();
			}
		});

		const outPanel = h('section', { class: 'panel', 'aria-label': 'Result' }, output);
		output.appendChild(stateBox('empty', null, tool.emptyText || (tool.live ? 'Results appear here as you type.' : `Fill in the fields and press ${tool.action || 'Run'}. Ctrl+Enter works too.`)));
		root.appendChild(h('div', { class: 'io' + (tool.layout === 'split' ? ' split' : '') }, form, outPanel));
		updateVisibility();
		if (tool.live || (ctx.args && Object.keys(ctx.args).length && !tool.live && ctx.autorun)) run();
		return () => {
			runId++;
		};
	}

	Omni.forms = { field, renderTool, renderOutput, renderBlock, normalize, summarize, meter, scale, readings, table, block, stateBox, copyButton, toCsv, defaultsFor, coerce };
	Omni.runTool = runTool;
})();
