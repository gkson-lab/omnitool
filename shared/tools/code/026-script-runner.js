// No. 026 Script runner (desktop): runs Python, Node.js or PowerShell code and shows its output.
Omni.register({
	no: 26,
	id: 'script-runner',
	name: 'Script runner',
	category: 'code',
	editions: ['desktop'],
	keywords: ['run', 'python', 'node', 'powershell', 'script', 'execute'],
	description: 'Runs a Python, Node.js or PowerShell script and shows stdout, stderr and the exit code. Node uses OmniTool\'s own runtime.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const samples = {
			python: 'import platform, sys\nprint("Python", sys.version.split()[0], "on", platform.system())\nprint(sum(range(101)))\n',
			node: 'console.log(`Node ${process.version} on ${process.platform}`);\nconsole.log([1, 2, 3].map((n) => n * n));\n',
			powershell: 'Get-Date -Format "yyyy-MM-dd HH:mm"\n$PSVersionTable.PSVersion.ToString()\n',
		};
		let lang = ctx.store.get('lang', 'python');
		const code = ctx.store.get('code', {});
		const langSel = h('select', { id: 'sr-lang', onchange: () => {
			code[lang] = editor.getValue();
			lang = langSel.value;
			ctx.store.set('lang', lang);
			editor.setValue(code[lang] || samples[lang]);
			editor.setMode(lang === 'node' ? 'javascript' : lang === 'powershell' ? 'shell' : 'python');
		} }, h('option', { value: 'python' }, 'Python'), h('option', { value: 'node' }, 'Node.js'), h('option', { value: 'powershell' }, 'PowerShell'));
		langSel.value = lang;
		const timeout = h('input', { type: 'number', id: 'sr-timeout', min: 1, max: 600, value: ctx.store.get('timeout', 30) });
		const stdin = h('textarea', { id: 'sr-stdin', class: 'code', rows: 2, placeholder: 'Optional input sent to the script' });
		const out = h('div', { 'aria-live': 'polite' });
		const runBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Run');
		const stopBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => Omni.native.script.kill() }, 'Stop');
		let editor;
		const run = async () => {
			code[lang] = editor.getValue();
			ctx.store.set('code', code);
			ctx.store.set('timeout', Number(timeout.value) || 30);
			runBtn.disabled = true;
			stopBtn.hidden = false;
			out.replaceChildren(Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, 'Running')));
			try {
				const r = await Omni.native.script.run({ lang, code: editor.getValue(), stdin: stdin.value, timeoutMs: (Number(timeout.value) || 30) * 1000 });
				Omni.forms.renderOutput({
					readings: [{ label: 'Exit code', value: r.timedOut ? 'stopped (time limit)' : r.killed ? 'stopped' : r.exitCode, copy: false }, { label: 'Time', value: `${r.ms} ms`, copy: false }, { label: 'Runtime', value: r.runtime, copy: false }],
					blocks: [{ type: 'text', label: 'Output', value: r.stdout || '(no output)' }, r.stderr ? { type: 'text', label: 'Errors', value: r.stderr } : null].filter(Boolean),
				}, out);
			} catch (err) {
				out.replaceChildren(Omni.forms.stateBox('error', 'The script could not start.', err.message));
			} finally {
				runBtn.disabled = false;
				stopBtn.hidden = true;
			}
		};
		runBtn.onclick = run;
		const box = h('div');
		root.appendChild(h('div', { class: 'stack-lg' },
			h('div', { class: 'panel stack' }, h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'sr-lang' }, 'Language'), langSel), h('div', { class: 'field' }, h('label', { for: 'sr-timeout' }, 'Time limit (seconds)'), timeout)), box, h('div', { class: 'field' }, h('label', { for: 'sr-stdin' }, 'Standard input'), stdin), h('div', { class: 'form-actions' }, runBtn, stopBtn, h('span', { class: 'muted', style: { fontSize: '0.84rem', alignSelf: 'center' } }, 'Ctrl+Enter runs. Scripts run with your user account, like a terminal.'))),
			h('section', { class: 'panel', 'aria-label': 'Output' }, out),
		));
		out.appendChild(Omni.forms.stateBox('empty', null, 'Output appears here.'));
		Omni.editor.create(box, { value: code[lang] || samples[lang], mode: lang === 'node' ? 'javascript' : lang === 'powershell' ? 'shell' : 'python', height: '300px', onRun: run, label: 'Script editor' }).then((ed) => (editor = ed));
		return () => Omni.native.script.kill();
	},
});
