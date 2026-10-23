// No. 002 Code Pad: a multi-tab editor saved locally. Omni.codepad lets Omni Agent read and change it from anywhere.
(function () {
	'use strict';
	const KEY_DOCS = 'codepad.docs';
	const KEY_ACTIVE = 'codepad.active';
	const newId = () => Math.random().toString(36).slice(2, 10);
	const welcome = () => ({ id: newId(), name: 'scratch.js', mode: 'javascript', text: '// Code Pad keeps every tab in local storage.\n// Ctrl+F finds, Shift+Ctrl+F replaces, Ctrl+/ comments a line.\n\nfunction greet(name) {\n  return `Hello, ${name}`;\n}\n\nconsole.log(greet("OmniTool"));\n' });

	function load() {
		let docs = Omni.store.get(KEY_DOCS, null);
		if (!Array.isArray(docs) || !docs.length) docs = [welcome()];
		let active = Omni.store.get(KEY_ACTIVE, docs[0].id);
		if (!docs.some((d) => d.id === active)) active = docs[0].id;
		return { docs, activeId: active };
	}
	function save(docs, activeId) {
		Omni.store.set(KEY_DOCS, docs);
		Omni.store.set(KEY_ACTIVE, activeId);
	}

	Omni.codepad = {
		state() {
			Omni.emit('codepad:flush');
			const { docs, activeId } = load();
			return { docs, active: docs.find((d) => d.id === activeId) };
		},
		write(text, newTabName) {
			const { docs, activeId } = load();
			let id = activeId;
			if (newTabName) {
				const doc = { id: newId(), name: newTabName, mode: Omni.editor.modeForName(newTabName), text };
				docs.push(doc);
				id = doc.id;
			} else docs.find((d) => d.id === activeId).text = text;
			save(docs, id);
			Omni.emit('codepad:changed');
		},
	};

	Omni.register({
		no: 2,
		id: 'codepad',
		name: 'Code Pad',
		category: 'code',
		keywords: ['editor', 'scratch', 'notepad', 'code', 'tabs'],
		description: 'A multi-tab code editor with syntax highlighting and find and replace. Tabs are saved on this device.',
		layout: 'wide',
		ai: false,
		mount(root) {
			const { h, icon } = Omni;
			const native = Omni.native;
			let { docs, activeId } = load();
			let editor = null;
			let destroyed = false;
			const paths = Omni.store.get('codepad.paths', {}); // doc id -> file path (desktop)
			const active = () => docs.find((d) => d.id === activeId);
			const persist = Omni.util.debounce(() => save(docs, activeId), 300);
			const flush = () => {
				if (editor) active().text = editor.getValue();
				save(docs, activeId);
			};

			const tabs = h('div', { class: 'editor-tabs', role: 'tablist', 'aria-label': 'Open documents' });
			const mode = h('select', { 'aria-label': 'Language', style: { width: 'auto' }, onchange: () => {
				active().mode = mode.value;
				editor.setMode(mode.value);
				persist();
			} }, Object.entries(Omni.editor.MODES).map(([k, m]) => h('option', { value: k }, m.label)));
			const status = h('span', { class: 'muted mono', style: { fontSize: '0.78rem' } });
			const editorBox = h('div');

			const drawTabs = () => {
				tabs.replaceChildren(
					...docs.map((d) =>
						h(
							'div',
							{ class: 'editor-tab', role: 'tab', 'aria-selected': String(d.id === activeId), tabindex: d.id === activeId ? '0' : '-1', onclick: () => switchTo(d.id), onkeydown: (e) => {
								const i = docs.indexOf(d);
								if (e.key === 'ArrowRight' && docs[i + 1]) switchTo(docs[i + 1].id, true);
								if (e.key === 'ArrowLeft' && docs[i - 1]) switchTo(docs[i - 1].id, true);
							} },
							h('span', null, d.name),
							h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Close ${d.name}`, onclick: (e) => {
								e.stopPropagation();
								closeTab(d.id);
							} }, icon('close')),
						),
					),
					h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'New tab', onclick: newTab }, icon('plus')),
				);
			};
			const drawStatus = () => {
				if (!editor) return;
				const text = editor.getValue();
				const pos = editor.cm ? editor.cm.getCursor() : { line: 0, ch: 0 };
				status.textContent = `Line ${pos.line + 1}, column ${pos.ch + 1} · ${text.split('\n').length} lines · ${text.length} characters${paths[activeId] ? ' · ' + paths[activeId] : ''}`;
			};
			function switchTo(id, focusTab) {
				flush();
				activeId = id;
				const d = active();
				editor.setValue(d.text);
				editor.setMode(d.mode);
				mode.value = d.mode;
				save(docs, activeId);
				drawTabs();
				drawStatus();
				if (focusTab) tabs.querySelector('[aria-selected="true"]').focus();
			}
			async function newTab() {
				const name = await Omni.ui.prompt({ title: 'New tab', body: 'The extension picks the highlighting, for example notes.md or query.sql.', value: 'untitled.txt', confirmLabel: 'Create' });
				if (!name) return;
				flush();
				const d = { id: newId(), name, mode: Omni.editor.modeForName(name), text: '' };
				docs.push(d);
				switchTo(d.id);
				editor.focus();
			}
			async function closeTab(id) {
				const d = docs.find((x) => x.id === id);
				if (id === activeId) flush();
				if (d.text.trim() && !(await Omni.ui.confirm({ title: `Close ${d.name}?`, body: 'Its text is deleted from Code Pad. Download or save it first if you need it.', confirmLabel: 'Close tab' }))) return;
				docs = docs.filter((x) => x.id !== id);
				delete paths[id];
				Omni.store.set('codepad.paths', paths);
				if (!docs.length) docs.push({ id: newId(), name: 'untitled.txt', mode: 'text', text: '' });
				if (id === activeId) {
					activeId = docs[0].id;
					editor.setValue(active().text);
					editor.setMode(active().mode);
					mode.value = active().mode;
				}
				save(docs, activeId);
				drawTabs();
				drawStatus();
			}
			async function rename() {
				const name = await Omni.ui.prompt({ title: 'Rename tab', value: active().name, confirmLabel: 'Rename' });
				if (!name) return;
				active().name = name;
				active().mode = Omni.editor.modeForName(name);
				editor.setMode(active().mode);
				mode.value = active().mode;
				persist();
				drawTabs();
			}
			// A NUL character means a binary file; read as text it is unreadable, and saving it back would corrupt the original.
			const refuseBinary = (name, text) => {
				if (!text.includes('\u0000')) return false;
				Omni.ui.toast(`${name} is a binary file. Code Pad opens text files only.`, { error: true });
				return true;
			};
			async function openFile(file) {
				const text = await Omni.util.readFile(file);
				if (refuseBinary(file.name, text)) return;
				flush();
				const d = { id: newId(), name: file.name, mode: Omni.editor.modeForName(file.name), text };
				docs.push(d);
				switchTo(d.id);
			}
			async function openNative() {
				const files = await native.dialog.openFile({});
				if (!files || !files.length) return;
				const { path, text } = await native.fs.readText(files[0].path);
				if (refuseBinary(files[0].name, text)) return;
				flush();
				const d = { id: newId(), name: files[0].name, mode: Omni.editor.modeForName(files[0].name), text };
				docs.push(d);
				paths[d.id] = path;
				Omni.store.set('codepad.paths', paths);
				switchTo(d.id);
			}
			async function saveNative(as) {
				flush();
				let path = paths[activeId];
				if (as || !path) path = await native.dialog.saveFile({ defaultPath: active().name });
				if (!path) return;
				try {
					await native.fs.writeText(path, active().text);
					paths[activeId] = path;
					active().name = path.split(/[\\/]/).pop();
					Omni.store.set('codepad.paths', paths);
					save(docs, activeId);
					drawTabs();
					drawStatus();
					Omni.ui.toast(`Saved ${path}`);
				} catch (err) {
					Omni.ui.toast(err.message, { error: true, title: 'Not saved.' });
				}
			}
			const fileInput = h('input', { type: 'file', class: 'sr-only', id: 'codepad-open', onchange: () => fileInput.files[0] && openFile(fileInput.files[0]) });
			const fileActions = native
				? [h('button', { type: 'button', class: 'btn btn-small', onclick: openNative }, 'Open file'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => saveNative(false) }, 'Save'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => saveNative(true) }, 'Save as')]
				: [h('label', { for: 'codepad-open', class: 'btn btn-small', tabindex: '0', onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.click()) }, 'Open file'), fileInput, h('button', { type: 'button', class: 'btn btn-small', onclick: () => (flush(), Omni.util.download(active().name, active().text)) }, icon('download'), 'Download')];

			root.appendChild(
				h(
					'div',
					{ class: 'stack' },
					h('div', { class: 'row between' }, h('div', { class: 'row' }, ...fileActions, h('button', { type: 'button', class: 'btn btn-small', onclick: rename }, 'Rename'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.util.copy(editor.getValue()) }, 'Copy all')), mode),
					h('div', { class: 'editor-shell', style: { border: '0' } }, tabs, editorBox),
					h('div', { class: 'row between' }, status, h('span', { class: 'muted', style: { fontSize: '0.78rem' } }, 'Ctrl+F find · Shift+Ctrl+F replace · Ctrl+/ comment · Esc then Tab leaves the editor')),
				),
			);
			drawTabs();
			mode.value = active().mode;
			Omni.editor.create(editorBox, { value: active().text, mode: active().mode, height: 'calc(100dvh - 300px)', label: 'Code Pad editor', onChange: () => {
				active().text = editor.getValue();
				persist();
				drawStatus();
			} }).then((ed) => {
				if (destroyed) return;
				editor = ed;
				editorBox.firstChild.style.border = '0';
				if (ed.cm) ed.cm.on('cursorActivity', drawStatus);
				drawStatus();
			});

			const offFlush = Omni.on('codepad:flush', () => editor && flush());
			const offChanged = Omni.on('codepad:changed', () => {
				({ docs, activeId } = load());
				if (editor) {
					editor.setValue(active().text);
					editor.setMode(active().mode);
				}
				mode.value = active().mode;
				drawTabs();
				drawStatus();
			});
			return () => {
				destroyed = true;
				if (editor) flush();
				offFlush();
				offChanged();
			};
		},
	});
})();
