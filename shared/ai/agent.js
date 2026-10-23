// Omni Agent: the chat panel, its tool loop over the Claude API, and the step and approval display shared with offline mode.
(function () {
	'use strict';
	const { h, icon } = Omni;

	/* ---------- Agent tools ---------- */

	const tools = [];
	/** tool: { name, description, input_schema, editions?, run(input, step) }. step.approve() asks the user first. */
	function addTool(tool) {
		if (tool.editions && !tool.editions.includes(Omni.edition)) return;
		tools.push(tool);
	}

	function toolDefs() {
		// eager_input_streaming streams large inputs (whole files) as they are generated; inputs are validated below.
		return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema, eager_input_streaming: true }));
	}

	/** Small JSON-schema check; the streaming parser can hand back a truncated object, so never trust it blindly. */
	function validate(schema, input) {
		if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Input must be an object';
		for (const req of schema.required || []) if (!(req in input)) return `Missing required field "${req}"`;
		for (const [k, v] of Object.entries(input)) {
			const spec = schema.properties && schema.properties[k];
			if (!spec || v == null) continue;
			const want = spec.type;
			const ok = want === 'string' ? typeof v === 'string' : want === 'number' || want === 'integer' ? typeof v === 'number' : want === 'boolean' ? typeof v === 'boolean' : want === 'object' ? typeof v === 'object' && !Array.isArray(v) : want === 'array' ? Array.isArray(v) : true;
			if (!ok) return `Field "${k}" should be a ${want}`;
			if (spec.enum && !spec.enum.includes(v)) return `Field "${k}" must be one of ${spec.enum.join(', ')}`;
		}
		return null;
	}

	function inputSpecForAgent(tool) {
		return tool.inputs
			.filter((s) => s.type !== 'file')
			.map((s) => {
				const o = { name: s.name, label: s.label, type: s.type === 'textarea' || s.type === 'password' || s.type === 'color' ? 'string' : s.type === 'seg' ? 'select' : s.type };
				if (s.options) {
					const list = (typeof s.options === 'function' ? s.options() : s.options).map((x) => (typeof x === 'object' ? x.value : x));
					// Long lists (every time zone) would flood the model; the first few show the format.
					if (list.length > 40) o.examples = list.slice(0, 5);
					else o.options = list;
				}
				const d = typeof s.default === 'function' ? undefined : s.default;
				if (d !== undefined && String(d).length < 200) o.default = d;
				if (s.hint) o.hint = s.hint;
				return o;
			});
	}

	function describeTool(t) {
		return { tool_id: t.id, no: t.code, name: t.name, category: Omni.category(t.category).name, description: t.description, runnable: !!t.run && t.ai !== false && !t.inputs.some((s) => s.type === 'file' && s.required), inputs: t.run ? inputSpecForAgent(t) : [] };
	}

	addTool({
		name: 'find_tools',
		description: 'Search OmniTool\'s catalog of numbered tools by keyword. Returns tool ids, whether each can run headless with run_tool, and its inputs.',
		input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Keywords, e.g. "uuid", "unit convert", "hash".' } }, required: ['query'] },
		run: async ({ query }) => Omni.fuzzy.searchTools(query, Omni.sortedTools()).slice(0, 8).map((r) => describeTool(r.tool)),
	});

	addTool({
		name: 'run_tool',
		description: 'Run one OmniTool tool with arguments and get its result. Use find_tools first to learn the tool_id and input names. Omitted inputs use the tool defaults.',
		input_schema: { type: 'object', properties: { tool_id: { type: 'string' }, args: { type: 'object', description: 'Input name to value.' } }, required: ['tool_id'] },
		run: async ({ tool_id, args }) => {
			const tool = Omni.byId[tool_id];
			if (!tool) throw new Error(`Unknown tool_id "${tool_id}". Use find_tools.`);
			if (tool.ai === false || !tool.run) throw new Error(`${tool.name} is interactive. Use open_tool to show it to the user.`);
			return { tool: `No. ${tool.code} ${tool.name}`, result: Omni.forms.summarize(await Omni.runTool(tool_id, args || {})) };
		},
	});

	addTool({
		name: 'open_tool',
		description: 'Open a tool page in OmniTool for the user, optionally with inputs filled in and run. Use it when the user should see or keep working in the tool.',
		input_schema: { type: 'object', properties: { tool_id: { type: 'string' }, args: { type: 'object' } }, required: ['tool_id'] },
		run: async ({ tool_id, args }) => {
			const tool = Omni.byId[tool_id];
			if (!tool) throw new Error(`Unknown tool_id "${tool_id}"`);
			Omni.open(tool_id, args || null, { autorun: !!args });
			return { opened: `No. ${tool.code} ${tool.name}` };
		},
	});

	/* ---------- Panel ---------- */

	let box, logEl, input, sendBtn, stopBtn, modeEl;
	let history = [];
	let busy = false;
	let controller = null;

	function systemPrompt() {
		const desktop = Omni.edition === 'desktop';
		return [
			`You are Omni Agent, the assistant inside OmniTool (${desktop ? 'desktop' : 'web'} edition) by gklabs. OmniTool has ${Omni.tools.length} numbered tools for developers: code tools, generators, converters, calculators, text tools, productivity, network, design, AI tools and games.`,
			'Use find_tools and run_tool whenever a tool can produce the answer (UUIDs, hashes, unit or base conversions, calculations, formatting, passwords, QR codes and so on) instead of computing it yourself, so results come from the same code the user would use. For a multi-step task, do the steps in order with tools and use earlier results in later steps.',
			desktop
				? 'You can read the file open in LabsCode (the code editor tab) with labscode_read_active_file and propose a full new version with labscode_propose_edit. You can read and list files, and write or delete files inside the agent folder or LabsCode\'s open folders. Every write, delete and editor change is shown to the user for approval first; if they reject it, do not retry the same change unless they ask.'
				: 'You can read the code open in Code Pad with codepad_read and propose a new version with codepad_write, and you can offer a file download with save_download. The user approves each change or download first; if they reject it, do not retry unless they ask.',
			'Keep replies short and concrete. Use Markdown for code. When you cannot do something, say what blocks it.',
		].join('\n\n');
	}

	function contextNote() {
		const r = location.hash.match(/^#\/tool\/([^/]+)/);
		const t = r && Omni.byId[decodeURIComponent(r[1])];
		return t ? `\n\n[OmniTool context: the user is on No. ${t.code} ${t.name}.]` : '';
	}

	async function renderMarkdown(el, text) {
		try {
			await Omni.vendor(['marked.umd.js', 'purify.min.js']);
			el.innerHTML = window.DOMPurify.sanitize(window.marked.parse(text, { breaks: true }));
		} catch {
			el.textContent = text;
		}
	}

	function scrollLog() {
		logEl.scrollTop = logEl.scrollHeight;
	}

	function addUser(text) {
		clearIntro();
		logEl.appendChild(h('div', { class: 'msg msg-user' }, h('div', { class: 'msg-who' }, 'You'), h('div', { class: 'msg-body' }, text)));
		scrollLog();
	}

	/** One assistant turn: alternating text segments and step lists. */
	function addTurn(label) {
		clearIntro();
		const body = h('div', { class: 'msg-body' });
		const el = h('div', { class: 'msg' }, h('div', { class: 'msg-who' }, label || 'Omni Agent'), body);
		logEl.appendChild(el);
		let textEl = null;
		let textBuf = '';
		let steps = null;
		let n = 0;
		const turn = {
			text(delta) {
				if (!textEl) {
					textEl = h('div');
					body.appendChild(textEl);
					textBuf = '';
				}
				textBuf += delta;
				textEl.textContent = textBuf;
				scrollLog();
			},
			async endText() {
				if (textEl && textBuf) await renderMarkdown(textEl, textBuf);
				textEl = null;
				textBuf = '';
				steps = null;
				scrollLog();
			},
			markdown(text) {
				const div = h('div');
				body.appendChild(div);
				steps = null;
				return renderMarkdown(div, text).then(scrollLog);
			},
			note(text, error) {
				body.appendChild(h('p', { class: error ? 'error-text' : 'muted', style: { fontSize: '0.84rem', marginTop: '6px' } }, text));
				scrollLog();
			},
			step(name, input) {
				if (!steps) {
					steps = h('ol', { class: 'steps' });
					body.appendChild(steps);
				}
				n++;
				const summary = h('span', { class: 'muted' }, ' running');
				const li = h('li', null, h('span', null, `Step ${n} `), h('span', { class: 'step-name' }, name), summary);
				if (input && Object.keys(input).length) li.appendChild(h('details', null, h('summary', null, 'Input'), h('pre', null, JSON.stringify(input, null, 2).slice(0, 4000))));
				steps.appendChild(li);
				scrollLog();
				return {
					done(result) {
						li.classList.add('done');
						summary.textContent = ' done';
						if (result !== undefined) li.appendChild(h('details', null, h('summary', null, 'Result'), h('pre', null, (typeof result === 'string' ? result : JSON.stringify(result, null, 2)).slice(0, 6000))));
						scrollLog();
					},
					fail(err) {
						li.classList.add('failed');
						summary.textContent = ` failed: ${err.message || err}`;
						scrollLog();
					},
					/** Shows an approval card and resolves true only if the user approves. */
					approve({ title, body: content, confirmLabel }) {
						return new Promise((resolve) => {
							const yes = h('button', { type: 'button', class: 'btn btn-primary btn-small' }, confirmLabel || 'Approve');
							const no = h('button', { type: 'button', class: 'btn btn-small' }, 'Reject');
							const status = h('span', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Waiting for you');
							const card = h('div', { class: 'approval', role: 'group', 'aria-label': title }, h('h3', null, title), content, h('div', { class: 'row' }, yes, no, status));
							li.appendChild(card);
							const finish = (ok) => {
								yes.disabled = true;
								no.disabled = true;
								status.textContent = ok ? 'Approved' : 'Rejected';
								controller && controller.signal.removeEventListener('abort', onAbort);
								resolve(ok);
							};
							const onAbort = () => finish(false);
							yes.onclick = () => finish(true);
							no.onclick = () => finish(false);
							controller && controller.signal.addEventListener('abort', onAbort);
							scrollLog();
							yes.focus();
						});
					},
				};
			},
		};
		return turn;
	}

	/** Line diff for approval cards: removed lines in red, added in green, unchanged runs shortened. */
	async function diffView(before, after) {
		await Omni.vendor('diff.min.js');
		const parts = window.Diff.diffLines(before || '', after || '');
		const rows = [];
		for (const p of parts) {
			const lines = p.value.replace(/\n$/, '').split('\n');
			if (!p.added && !p.removed && lines.length > 6) {
				lines.slice(0, 2).forEach((l) => rows.push(['', l]));
				rows.push(['', `... ${lines.length - 4} unchanged lines ...`]);
				lines.slice(-2).forEach((l) => rows.push(['', l]));
			} else lines.forEach((l) => rows.push([p.added ? 'add' : p.removed ? 'del' : '', l]));
		}
		const shown = rows.slice(0, 400);
		return h(
			'div',
			{ class: 'diff-wrap' },
			h('table', { class: 'data diff-table' }, h('tbody', null, shown.map(([k, l]) => h('tr', null, h('td', { class: 'ln' }, k === 'add' ? '+' : k === 'del' ? '-' : ''), h('td', { class: 'code ' + k }, l))))),
			rows.length > shown.length ? h('p', { class: 'muted', style: { padding: '6px', fontSize: '0.8rem' } }, `${rows.length - shown.length} more diff lines not shown`) : null,
		);
	}

	async function execute(turn, name, toolInput) {
		const tool = tools.find((t) => t.name === name);
		const step = turn.step(name, toolInput);
		if (!tool) {
			const err = new Error(`Unknown tool ${name}`);
			step.fail(err);
			throw err;
		}
		const problem = validate(tool.input_schema, toolInput);
		if (problem) {
			step.fail(new Error(problem));
			throw new Error(problem);
		}
		try {
			const result = await tool.run(toolInput, step);
			step.done(result);
			return result;
		} catch (err) {
			step.fail(err);
			throw err;
		}
	}

	/* ---------- Claude loop ---------- */

	async function runClaude(text) {
		const client = await Omni.ai.client();
		history.push({ role: 'user', content: text + contextNote() });
		const turn = addTurn('Omni Agent');
		let jsonRetries = 0;
		for (let round = 0; round < 24; round++) {
			const stream = client.beta.messages.stream(Omni.ai.params({ max_tokens: 64000, system: systemPrompt(), tools: toolDefs(), messages: history }), { signal: controller.signal });
			stream.on('text', (d) => turn.text(d));
			let message;
			try {
				message = await stream.finalMessage();
				jsonRetries = 0;
			} catch (err) {
				await turn.endText();
				// A tool input that could not be parsed at all is retried; API errors and aborts are not.
				if (err instanceof window.Anthropic.APIError || controller.signal.aborted || jsonRetries++ >= 2) throw err;
				turn.note('A tool call arrived garbled; asking again.');
				continue;
			}
			await turn.endText();
			history.push({ role: 'assistant', content: message.content });
			if (message.stop_reason === 'refusal') {
				turn.note(Omni.ai.refusalText(message), true);
				return;
			}
			if (message.stop_reason === 'pause_turn') continue;
			const uses = message.content.filter((b) => b.type === 'tool_use');
			if (!uses.length) {
				if (message.stop_reason === 'max_tokens') turn.note('The reply hit the length limit and was cut off.', true);
				return;
			}
			const results = [];
			for (const use of uses) {
				if (message.stop_reason === 'max_tokens' || controller.signal.aborted) {
					results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: controller.signal.aborted ? 'Stopped by the user.' : 'Tool input was cut off at max_tokens; not run.' });
					continue;
				}
				try {
					const out = await execute(turn, use.name, use.input);
					results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(out === undefined ? { ok: true } : out).slice(0, 60000) });
				} catch (err) {
					results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: String(err.message || err) });
				}
			}
			// Every tool_use gets a tool_result in one user message, even after a stop, so the history stays valid.
			history.push({ role: 'user', content: results });
			if (controller.signal.aborted) return;
		}
		turn.note('Stopped after 24 rounds of tool calls. Ask again to continue.', true);
	}

	/* ---------- Send ---------- */

	async function send(textArg) {
		const text = (textArg != null ? textArg : input.value).trim();
		if (!text || busy) return;
		input.value = '';
		addUser(text);
		busy = true;
		controller = new AbortController();
		sendBtn.disabled = true;
		stopBtn.hidden = false;
		try {
			if ((await engine()) === 'claude') await runClaude(text);
			else await Omni.onyx.handle(text, { addTurn, execute, signal: controller.signal, newChat });
		} catch (err) {
			const turn = addTurn('Omni Agent');
			turn.note(Omni.ai.errorMessage(err), true);
		} finally {
			busy = false;
			controller = null;
			sendBtn.disabled = false;
			stopBtn.hidden = true;
			input.focus();
		}
	}

	let introEl = null;
	function clearIntro() {
		if (introEl) {
			introEl.remove();
			introEl = null;
		}
	}
	/** Which engine answers: Claude when there is a key (unless you picked Onyx), otherwise Onyx. */
	async function engine() {
		const hasKey = (await Omni.ai.mode()) === 'claude';
		return hasKey && Omni.store.get('agent.engine', null) !== 'onyx' ? 'claude' : 'onyx';
	}

	async function intro() {
		const onyx = (await engine()) === 'onyx';
		if (introEl) introEl.remove();
		const examples = onyx
			? ['Hi Onyx', 'What can you do?', 'I need to format some JSON', 'Generate 10 UUIDs and save them to a file', 'Tell me a joke']
			: Omni.edition === 'desktop'
				? ['Generate 10 UUIDs and save them to a file', 'Explain the file open in LabsCode', 'Convert 72 F to C', 'Hash hello with SHA-256']
				: ['Generate 10 UUIDs and save them to a file', 'Explain the code in Code Pad', 'Convert 72 F to C', 'Hash hello with SHA-256'];
		if (logEl.querySelector('.msg')) return;
		introEl = h(
			'div',
			{ class: 'stack' },
			h('p', { class: 'muted', style: { fontSize: '0.9rem' } }, onyx ? 'Onyx runs on this device, with no internet. Talk to it, ask about OmniTool, or give it a task; anything that writes or deletes waits for your approval.' : 'Ask for a result or a task. Claude runs OmniTool\'s own tools and shows each step; anything that writes, deletes or edits waits for your approval.'),
			h('div', { class: 'stack' }, examples.map((ex) => h('button', { type: 'button', class: 'btn btn-small', style: { justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }, onclick: () => send(ex) }, ex))),
		);
		logEl.appendChild(introEl);
	}

	async function drawMode() {
		const hasKey = (await Omni.ai.mode()) === 'claude';
		const e = await engine();
		const s = Omni.ai.settings();
		const choose = (value) => {
			Omni.store.set('agent.engine', value);
		};
		const sw = h('div', { class: 'seg', role: 'group', 'aria-label': 'Omni Agent engine' },
			h('button', { type: 'button', 'aria-pressed': String(e === 'onyx'), onclick: () => choose('onyx') }, 'Onyx'),
			h('button', { type: 'button', 'aria-pressed': String(e === 'claude'), disabled: !hasKey, title: hasKey ? null : 'Add an Anthropic API key in Settings first', onclick: () => choose('claude') }, 'Claude'));
		modeEl.replaceChildren(
			sw,
			h('span', null, ...(e === 'claude'
				? [h('b', null, 'Claude'), ` · ${s.model} · effort ${s.effort === 'default' ? 'model default' : s.effort}`]
				: [h('b', null, 'Omni Agent - Onyx'), ' · on this device, no internet', ...(hasKey ? [] : [' · ', h('a', { href: '#/settings' }, 'add a key'), ' for Claude'])])),
		);
		intro();
	}

	function newChat() {
		if (busy) return;
		history = [];
		logEl.replaceChildren();
		intro();
		if (Omni.onyx) Omni.onyx.reset();
		input.focus();
	}

	function mount(container) {
		box = container;
		logEl = h('div', { class: 'agent-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
		modeEl = h('div', { class: 'agent-mode' });
		input = h('textarea', {
			placeholder: 'Ask Omni Agent. Enter sends, Shift+Enter adds a line.',
			'aria-label': 'Message to Omni Agent',
			onkeydown: (e) => {
				if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
					e.preventDefault();
					send();
				}
			},
		});
		sendBtn = h('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: () => send() }, 'Send');
		stopBtn = h('button', { type: 'button', class: 'btn btn-small', hidden: true, onclick: () => controller && controller.abort() }, 'Stop');
		Omni.append(box, [
			h('div', { class: 'agent-head' }, h('h2', null, 'Omni Agent'), h('button', { type: 'button', class: 'btn btn-small btn-quiet', onclick: newChat }, 'New chat'), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close Omni Agent', onclick: () => Omni.toggleAgent(false) }, icon('close'))),
			modeEl,
			logEl,
			h('div', { class: 'agent-input' }, input, h('div', { class: 'row end' }, stopBtn, sendBtn)),
		]);
		intro();
		drawMode();
		Omni.on('store', (e) => e.key && (e.key.startsWith('ai.') || e.key === 'agent.engine') && drawMode());
		Omni.on('secrets', drawMode);
	}

	Omni.agent = {
		mount,
		addTool,
		tools,
		diffView,
		describeTool,
		focus: () => input && setTimeout(() => input.focus(), 0),
		ask: (text) => send(text),
	};
})();
