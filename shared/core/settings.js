// Settings page: theme, Omni Agent (API key, model, effort), desktop options, and local data.
(function () {
	'use strict';
	const { h, store } = Omni;

	function sectionPanel(title, ...children) {
		return h('section', { class: 'panel stack' }, h('h2', null, title), ...children);
	}

	async function aiSection() {
		const s = Omni.ai.settings();
		const hasKey = !!(await Omni.ai.key());
		const status = h('p', { role: 'status' });
		const drawStatus = async () => {
			const k = await Omni.ai.key();
			status.replaceChildren(
				k ? h('span', null, h('strong', null, 'Claude is on. '), `Key ending in ${k.slice(-4)}, stored in ${Omni.secrets.where()}.`) : h('span', null, h('strong', null, 'Onyx is on. '), 'Omni Agent uses Onyx, its local engine, and the AI tools use their limited offline versions until you add a key.'),
			);
		};
		const keyInput = h('input', { type: 'password', id: 'ai-key', autocomplete: 'off', spellcheck: 'false', placeholder: hasKey ? 'A key is saved. Paste a new one to replace it.' : 'sk-ant-...', 'aria-describedby': 'ai-key-hint' });
		const testOut = h('div', { 'aria-live': 'polite' });
		const save = async () => {
			const v = keyInput.value.trim();
			if (!v) return Omni.ui.toast('Paste a key first.', { error: true });
			if (!/^sk-ant-/.test(v)) {
				const go = await Omni.ui.confirm({ title: 'Save this key?', body: 'Anthropic API keys usually start with sk-ant-. Save it anyway?', confirmLabel: 'Save key' });
				if (!go) return;
			}
			await Omni.secrets.set('anthropic', v);
			keyInput.value = '';
			keyInput.placeholder = 'A key is saved. Paste a new one to replace it.';
			Omni.emit('secrets');
			drawStatus();
			Omni.ui.toast('API key saved.');
		};
		const clear = async () => {
			const ok = await Omni.ui.confirm({ title: 'Remove the API key?', body: 'Omni Agent goes back to Onyx, and the AI tools to their offline versions.', confirmLabel: 'Remove key', focusCancel: true });
			if (!ok) return;
			await Omni.secrets.clear('anthropic');
			keyInput.placeholder = 'sk-ant-...';
			Omni.emit('secrets');
			drawStatus();
			Omni.ui.toast('API key removed.');
		};
		const test = async () => {
			testOut.replaceChildren(Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, `Asking ${Omni.ai.settings().model}`)));
			try {
				const reply = await Omni.ai.complete({ system: 'Reply with exactly: OK', prompt: 'Connection test from OmniTool settings.', maxTokens: 2000 });
				testOut.replaceChildren(Omni.forms.stateBox('ok', 'Connected.', `${Omni.ai.settings().model} replied: ${reply.trim().slice(0, 80)}`));
			} catch (err) {
				testOut.replaceChildren(Omni.forms.stateBox('error', 'The test failed.', Omni.ai.errorMessage(err)));
			}
		};

		const model = h('input', { type: 'text', id: 'ai-model', value: s.model, spellcheck: 'false', class: 'code', onchange: () => store.set('ai.model', model.value.trim() || Omni.ai.DEFAULT_MODEL) });
		const effort = h(
			'select',
			{ id: 'ai-effort', onchange: () => store.set('ai.effort', effort.value) },
			[['default', 'Model default'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high'], ['max', 'Max']].map(([v, l]) => h('option', { value: v }, l)),
		);
		effort.value = s.effort;
		const fallback = h('input', { type: 'checkbox', id: 'ai-fallback', checked: s.fallback, onchange: () => store.set('ai.fallback', fallback.checked) });
		drawStatus();

		return sectionPanel(
			'Omni Agent and AI tools',
			status,
			h(
				'div',
				{ class: 'field' },
				h('label', { for: 'ai-key' }, 'Anthropic API key'),
				h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, keyInput, h('button', { type: 'button', class: 'btn btn-primary', onclick: save }, 'Save key')),
				h('span', { class: 'hint', id: 'ai-key-hint' }, `Create one at console.anthropic.com. It is kept in ${Omni.secrets.where()} and sent only to api.anthropic.com. It is never written to the OmniTool folder${Omni.edition === 'desktop' ? ' unencrypted' : ''}.`),
			),
			h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: test }, 'Test the connection'), h('button', { type: 'button', class: 'btn', onclick: clear }, 'Remove key')),
			testOut,
			h(
				'div',
				{ class: 'fields' },
				h('div', { class: 'field' }, h('label', { for: 'ai-model' }, 'Model'), model, h('span', { class: 'hint' }, `Any Claude model id. Default ${Omni.ai.DEFAULT_MODEL}.`)),
				h('div', { class: 'field' }, h('label', { for: 'ai-effort' }, 'Effort'), effort, h('span', { class: 'hint' }, 'Higher effort thinks longer and costs more.')),
			),
			h('div', { class: 'field check' }, fallback, h('label', { for: 'ai-fallback' }, 'If Claude declines a request, let the API retry it on a fallback model')),
			h('p', { class: 'hint muted' }, `Applies to ${Omni.ai.FALLBACK_MODELS.join(', ')}; other models ignore this setting.`),
		);
	}

	function desktopSection() {
		if (Omni.edition !== 'desktop' || !Omni.native) return null;
		const n = Omni.native;
		const folder = h('code', null, n.agentFs.root());
		const embed = h('select', { id: 'lc-embed', onchange: () => store.set('labscode.embed', embed.value === 'embed') }, h('option', { value: 'embed' }, 'Inside OmniTool'), h('option', { value: 'window' }, 'In its own window'));
		embed.value = store.get('labscode.embed', true) ? 'embed' : 'window';
		const clip = h('input', { type: 'checkbox', id: 'clip-rec', checked: n.clipboard.isRecording(), onchange: () => n.clipboard.setRecording(clip.checked) });
		return sectionPanel(
			'Desktop',
			h(
				'div',
				{ class: 'field' },
				h('span', { class: 'field-label' }, 'Agent folder'),
				h('p', null, folder),
				h('span', { class: 'hint' }, 'Omni Agent may read and, after you approve, write files here and in the folders open in LabsCode. Relative paths start here.'),
				h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: async () => {
					const picked = await n.dialog.openFolder();
					if (picked) {
						n.agentFs.setRoot(picked);
						folder.textContent = n.agentFs.root();
					}
				} }, 'Choose another folder'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => n.shell.openPath(n.agentFs.root()) }, 'Open in Explorer')),
			),
			h('div', { class: 'field' }, h('label', { for: 'lc-embed' }, 'Show LabsCode'), embed, h('span', { class: 'hint' }, 'Takes effect the next time LabsCode starts.')),
			h('div', { class: 'field check' }, clip, h('label', { for: 'clip-rec' }, 'Record clipboard history (text only; password managers that mark their copies are skipped)')),
			h('p', { class: 'hint muted' }, `Settings file: ${n.app.paths().config}`),
		);
	}

	function dataSection() {
		const exportData = () => {
			const all = Omni.native ? Omni.native.config.load() : Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('omnitool:')).map((k) => [k.slice(9), JSON.parse(localStorage.getItem(k))]));
			for (const k of Object.keys(all)) if (k.startsWith('secret.')) delete all[k];
			Omni.util.download(`omnitool-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(all, null, 2), 'application/json');
		};
		const importInput = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'import-data', onchange: async () => {
			const file = importInput.files[0];
			if (!file) return;
			try {
				const data = JSON.parse(await Omni.util.readFile(file));
				if (!data || typeof data !== 'object') throw new Error('Not an OmniTool export');
				const ok = await Omni.ui.confirm({ title: `Import ${Object.keys(data).length} saved items?`, body: 'Items with the same name are replaced. API keys are never part of an export.', confirmLabel: 'Import' });
				if (!ok) return;
				for (const [k, v] of Object.entries(data)) if (!k.startsWith('secret.')) store.set(k, v);
				Omni.ui.toast('Imported. Reloading.');
				setTimeout(() => location.reload(), 600);
			} catch (err) {
				Omni.ui.toast(`Import failed: ${err.message}`, { error: true });
			}
		} });
		const reset = async () => {
			const ok = await Omni.ui.confirm({ title: 'Erase all OmniTool data on this device?', body: 'Notes, to-dos, snippets, pins, settings and the API key are deleted. This cannot be undone. Export first if you want a copy.', confirmLabel: 'Erase everything', focusCancel: true });
			if (!ok) return;
			await Omni.secrets.clear('anthropic');
			store.clear();
			location.hash = '#/';
			location.reload();
		};
		const where = Omni.edition === 'desktop' ? 'in desktop\\data\\config.json' : store.kind === 'local' ? "in this browser's local storage" : 'in memory only, because this browser blocks storage for this page. Everything resets when you close it';
		return sectionPanel(
			'Your data',
			h('p', { class: 'muted' }, `Notes, to-dos, snippets and settings are saved ${where}. Nothing is sent anywhere unless a tool says it calls an outside service.`),
			h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: exportData }, 'Export as JSON'), h('label', { for: 'import-data', class: 'btn', tabindex: '0', onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), importInput.click()) }, 'Import JSON'), importInput, h('button', { type: 'button', class: 'btn', onclick: reset }, 'Erase all data')),
		);
	}

	function aboutSection() {
		const libs = ['Anthropic TypeScript SDK', 'CodeMirror 5', 'marked', 'DOMPurify', 'jsdiff', 'js-beautify', 'js-yaml', 'sql-formatter', 'Terser', 'JSHint', 'qrcode-generator'];
		return sectionPanel(
			'About',
			h('p', null, `OmniTool 1.0, ${Omni.edition} edition, ${Omni.tools.length} tools. By gklabs.`),
			h('p', { class: 'muted' }, `Bundled libraries: ${libs.join(', ')}. Fonts: Archivo and Martian Mono (SIL Open Font License). License texts are in shared/vendor/licenses and shared/fonts.`),
		);
	}

	Omni.settingsView = function settingsView(root) {
		document.title = 'Settings · OmniTool';
		const body = h('div', { class: 'stack-lg' });
		Omni.append(root, [h('div', { class: 'tool-head' }, h('div', null, h('h1', null, 'Settings'))), body]);
		const appearance = sectionPanel('Appearance', h('p', { class: 'muted' }, 'System follows your operating system and switches with it.'), h('div', { class: 'row' }, Omni.themeSwitch()));
		body.appendChild(appearance);
		aiSection().then((sec) => {
			body.insertBefore(sec, appearance.nextSibling);
		});
		const desk = desktopSection();
		if (desk) body.appendChild(desk);
		body.appendChild(dataSection());
		body.appendChild(aboutSection());
	};
})();
