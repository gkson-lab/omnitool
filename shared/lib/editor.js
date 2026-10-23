// A code editor component: CodeMirror 5 when it loads, a plain textarea otherwise. Used by Code Pad and the playgrounds.
(function () {
	'use strict';
	const { h } = Omni;

	const MODES = {
		javascript: { label: 'JavaScript', mode: 'javascript', ext: ['js', 'mjs', 'cjs', 'jsx'] },
		typescript: { label: 'TypeScript', mode: 'text/typescript', ext: ['ts', 'tsx'] },
		json: { label: 'JSON', mode: 'application/json', ext: ['json'] },
		html: { label: 'HTML', mode: 'htmlmixed', ext: ['html', 'htm'] },
		css: { label: 'CSS', mode: 'css', ext: ['css', 'scss', 'less'] },
		python: { label: 'Python', mode: 'python', ext: ['py'] },
		markdown: { label: 'Markdown', mode: 'markdown', ext: ['md', 'markdown'] },
		sql: { label: 'SQL', mode: 'text/x-sql', ext: ['sql'] },
		xml: { label: 'XML', mode: 'xml', ext: ['xml', 'svg'] },
		yaml: { label: 'YAML', mode: 'yaml', ext: ['yml', 'yaml'] },
		shell: { label: 'Shell', mode: 'shell', ext: ['sh', 'bash', 'ps1', 'bat'] },
		c: { label: 'C / C++', mode: 'text/x-c++src', ext: ['c', 'h', 'cpp', 'hpp', 'cc'] },
		java: { label: 'Java', mode: 'text/x-java', ext: ['java'] },
		csharp: { label: 'C#', mode: 'text/x-csharp', ext: ['cs'] },
		text: { label: 'Plain text', mode: null, ext: ['txt', 'log', 'csv'] },
	};

	function modeForName(name) {
		const ext = (String(name).split('.').pop() || '').toLowerCase();
		return Object.keys(MODES).find((k) => MODES[k].ext.includes(ext)) || 'text';
	}

	/**
	 * create(container, { value, mode, height, onChange, readOnly }) resolves to
	 * { getValue, setValue, setMode, focus, refresh, cm, destroy }.
	 */
	async function create(container, opts) {
		const o = opts || {};
		const shell = h('div', { class: 'editor-shell' });
		container.appendChild(shell);
		try {
			await Omni.vendor.codemirror();
			const cm = window.CodeMirror(shell, {
				value: o.value || '',
				mode: (MODES[o.mode] || MODES.text).mode,
				lineNumbers: true,
				tabSize: 2,
				indentUnit: 2,
				indentWithTabs: !!o.tabs,
				matchBrackets: true,
				autoCloseBrackets: true,
				styleActiveLine: true,
				readOnly: !!o.readOnly,
				lineWrapping: !!o.wrap,
				screenReaderLabel: o.label || 'Code editor',
				extraKeys: {
					'Ctrl-/': 'toggleComment',
					'Cmd-/': 'toggleComment',
					Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('  ')),
					'Shift-Tab': (c) => c.indentSelection('subtract'),
					// Esc then Tab leaves the editor, so the Tab key doesn't trap keyboard users.
					Esc: (c) => c.getInputField().blur(),
					'Ctrl-Enter': () => o.onRun && o.onRun(),
				},
			});
			if (o.height) cm.setSize(null, o.height);
			if (o.onChange) cm.on('change', () => o.onChange(cm.getValue()));
			setTimeout(() => cm.refresh(), 0);
			return {
				cm,
				getValue: () => cm.getValue(),
				setValue: (v) => cm.setValue(v || ''),
				setMode: (m) => cm.setOption('mode', (MODES[m] || MODES.text).mode),
				focus: () => cm.focus(),
				refresh: () => cm.refresh(),
				destroy: () => shell.remove(),
			};
		} catch (err) {
			// CodeMirror failed to load (folder moved or damaged): keep working with a textarea.
			const ta = h('textarea', { class: 'code', spellcheck: 'false', style: { minHeight: o.height || '360px', border: '0', borderRadius: '0' }, 'aria-label': o.label || 'Code editor' });
			ta.value = o.value || '';
			if (o.onChange) ta.addEventListener('input', () => o.onChange(ta.value));
			shell.appendChild(ta);
			shell.appendChild(h('p', { class: 'muted', style: { padding: '6px 10px', fontSize: '0.8rem' } }, `Syntax highlighting is off: ${err.message}`));
			return { cm: null, getValue: () => ta.value, setValue: (v) => (ta.value = v || ''), setMode: () => {}, focus: () => ta.focus(), refresh: () => {}, destroy: () => shell.remove() };
		}
	}

	Omni.editor = { create, MODES, modeForName };
})();
