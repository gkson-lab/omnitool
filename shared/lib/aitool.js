// Shared page for the AI tools (No. 138 to 145): Claude when a key is set, the labeled offline version otherwise.
(function () {
	'use strict';
	const { h } = Omni;

	/** Loads the code the user is working on: the active LabsCode file on desktop, else Code Pad. */
	async function currentCode() {
		if (Omni.edition === 'desktop' && Omni.native) {
			const status = await Omni.native.labscode.status();
			if (status.running) {
				try {
					const state = await Omni.native.labscode.bridge('GET', '/state');
					if (state.file) return { text: state.file.text, name: state.file.name, lang: state.file.languageId, source: 'LabsCode', uri: state.file.uri, version: state.file.version };
				} catch {
					// Bridge not ready; fall back to Code Pad.
				}
			}
		}
		const pad = Omni.codepad.state().active;
		if (pad && pad.text.trim()) return { text: pad.text, name: pad.name, lang: pad.mode, source: 'Code Pad' };
		return null;
	}

	/**
	 * def: { no, id, name, description, keywords, inputs, action, system(args), prompt(args), offline(args), offlineLabel,
	 *        codeField (name of the input that holds code), afterResult(text, args, actionsEl) }
	 */
	Omni.aiTool = function aiTool(def) {
		Omni.register({
			...def,
			category: 'ai',
			// Headless runs (Omni Agent, offline commands) use the offline version: the agent is already Claude.
			run: (args) => def.offline(args),
			mount(root, ctx) {
				const saved = ctx.store.get('inputs', {});
				const start = Object.assign(Omni.forms.defaultsFor(def), saved, ctx.args || {});
				const fields = def.inputs.map((spec) => Omni.forms.field(spec, start[spec.name], () => ctx.store.set('inputs', values())));
				const values = () => Object.fromEntries(fields.map((f) => [f.spec.name, f.get()]));
				const output = h('div', { 'aria-live': 'polite' });
				const modeLine = h('p', { class: 'muted', style: { fontSize: '0.86rem' } });
				const primary = h('button', { type: 'submit', class: 'btn btn-primary' }, def.action || 'Run');
				const offlineBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => go(true) }, 'Offline version');
				const stopBtn = h('button', { type: 'button', class: 'btn', hidden: true }, 'Stop');
				let controller = null;
				let lastText = '';
				// Where the code came from (LabsCode file or Code Pad), so a rewrite can be applied back there.
				let source = null;
				const setField = (name, value) => {
					const f = fields.find((x) => x.spec.name === name);
					if (f) f.set(value);
					ctx.store.set('inputs', values());
				};

				const drawMode = async () => {
					const m = await Omni.ai.mode();
					offlineBtn.hidden = m !== 'claude';
					modeLine.replaceChildren(
						...(m === 'claude'
							? [h('strong', null, 'Claude'), ` (${Omni.ai.settings().model}) writes the answer. "Offline version" gives the limited local result instead.`]
							: [h('strong', null, 'Offline mode (limited): '), def.offlineLabel + ' ', h('a', { href: '#/settings' }, 'Add an API key'), ' for a full answer from Claude.']),
					);
				};

				const loadCode = async () => {
					const code = await currentCode();
					if (!code) return Omni.ui.toast(Omni.edition === 'desktop' ? 'Open a file in LabsCode or type in Code Pad first.' : 'Code Pad is empty.', { error: true });
					const f = fields.find((x) => x.spec.name === def.codeField);
					f.set(code.text);
					source = code;
					const lang = fields.find((x) => x.spec.name === 'language');
					if (lang && code.lang) {
						const map = { javascriptreact: 'javascript', typescriptreact: 'typescript' };
						const v = map[code.lang] || code.lang;
						if ([...lang.control.options].some((o) => o.value === v)) lang.set(v);
					}
					ctx.store.set('inputs', values());
					Omni.ui.toast(`Loaded ${code.name} from ${code.source}`);
				};

				const showOffline = async (args) => {
					const result = await def.offline(args);
					Omni.forms.renderOutput(result, output);
					output.prepend(Omni.forms.stateBox('empty', 'Offline result (limited).', def.offlineLabel));
					const t = Omni.forms.normalize(result).find((b) => b.type === 'text');
					lastText = t ? t.value : '';
					if (def.afterResult) def.afterResult(lastText, args, output, source);
				};

				async function go(forceOffline) {
					const args = values();
					ctx.store.set('inputs', values());
					const code = def.codeField ? args[def.codeField] : '';
					if (def.codeField && !String(code).trim()) {
						output.replaceChildren(Omni.forms.stateBox('empty', 'Nothing to work on yet.', def.emptyText || 'Paste some input above first.'));
						return;
					}
					if (forceOffline || (await Omni.ai.mode()) === 'offline') {
						try {
							await showOffline(args);
						} catch (err) {
							output.replaceChildren(Omni.forms.stateBox('error', 'The offline version failed.', err.message));
						}
						return;
					}
					controller = new AbortController();
					stopBtn.hidden = false;
					primary.disabled = true;
					const pre = h('pre', { class: 'readout', tabindex: '0' });
					const md = h('div', { class: 'msg-body' });
					output.replaceChildren(Omni.forms.block('Claude', pre), md);
					let text = '';
					try {
						text = await Omni.ai.complete({ system: def.system(args), prompt: def.prompt(args), signal: controller.signal, onText: (d) => {
							text += d;
							pre.textContent = text;
						} });
						lastText = text;
						if (def.markdown !== false) {
							await Omni.vendor(['marked.umd.js', 'purify.min.js']);
							md.innerHTML = window.DOMPurify.sanitize(window.marked.parse(text));
							pre.closest('.out-block').remove();
						}
						output.appendChild(h('div', { class: 'row', style: { marginTop: '12px' } }, Omni.forms.copyButton(() => text, 'Copy the answer')));
						if (def.afterResult) def.afterResult(text, args, output, source);
					} catch (err) {
						output.appendChild(Omni.forms.stateBox('error', 'Claude did not finish.', Omni.ai.errorMessage(err)));
					} finally {
						controller = null;
						stopBtn.hidden = true;
						primary.disabled = false;
					}
				}
				stopBtn.onclick = () => controller && controller.abort();

				const form = h(
					'form',
					{ class: 'panel stack', onsubmit: (e) => (e.preventDefault(), go(false)) },
					modeLine,
					h('div', { class: 'fields' }, fields.map((f) => f.el)),
					h('div', { class: 'form-actions' }, primary, offlineBtn, stopBtn, def.codeField && !def.noLoad ? h('button', { type: 'button', class: 'btn', onclick: loadCode }, Omni.edition === 'desktop' ? 'Use the LabsCode file' : 'Use Code Pad') : null, def.extraActions ? def.extraActions(setField) : null),
				);
				form.addEventListener('keydown', (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && (e.preventDefault(), go(false)));
				output.appendChild(Omni.forms.stateBox('empty', null, `Press ${def.action || 'Run'} to see the result here.`));
				root.appendChild(h('div', { class: 'io' }, form, h('section', { class: 'panel', 'aria-label': 'Result' }, output)));
				drawMode();
				const offStore = Omni.on('store', (e) => e.key && e.key.startsWith('ai.') && drawMode());
				const offSecrets = Omni.on('secrets', drawMode);
				return () => {
					offStore();
					offSecrets();
					if (controller) controller.abort();
				};
			},
		});
	};

	/** First fenced code block in a model answer, or the whole answer when it has no fence. */
	function extractCode(text) {
		const m = String(text).match(/```[\w+#.-]*\n([\s\S]*?)```/);
		return m ? m[1].replace(/\n$/, '') : String(text).trim();
	}

	/** Buttons to reuse rewritten code: copy, open in Code Pad, or apply to the LabsCode file it came from (after a diff). */
	function codeActions(code, original, output, source) {
		const row = h('div', { class: 'row', style: { marginTop: '12px' } }, Omni.forms.copyButton(code, 'Copy code'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
			Omni.codepad.write(code, source && source.name ? source.name.replace(/(\.\w+)?$/, '.new$1') : 'rewritten.txt');
			Omni.open('codepad');
		} }, 'Open in Code Pad'));
		if (source && source.source === 'LabsCode' && Omni.native) {
			row.appendChild(h('button', { type: 'button', class: 'btn btn-small btn-primary', onclick: async () => {
				const ok = await Omni.ui.confirm({ title: `Apply these changes to ${source.name}?`, body: await Omni.agent.diffView(original, code), confirmLabel: 'Apply in LabsCode' });
				if (!ok) return;
				try {
					await Omni.native.labscode.bridge('POST', '/replace', { uri: source.uri, text: code, version: source.version });
					Omni.ui.toast(`Applied to ${source.name} as an unsaved edit. Undo works in LabsCode.`);
				} catch (err) {
					Omni.ui.toast(err.message, { error: true, title: 'Not applied.' });
				}
			} }, 'Apply to the LabsCode file'));
		}
		output.appendChild(row);
	}

	Omni.aiTool.currentCode = currentCode;
	Omni.aiTool.extractCode = extractCode;
	Omni.aiTool.codeActions = codeActions;
	Omni.aiTool.LANGS = ['auto', 'javascript', 'typescript', 'python', 'java', 'csharp', 'c', 'html', 'css', 'sql', 'shell', 'text'];
})();
