// No. 137 Omni Agent: what the assistant can do in this edition, its mode, and a quick way to ask it something.
Omni.register({
	no: 137,
	id: 'omni-agent',
	name: 'Omni Agent',
	category: 'ai',
	keywords: ['agent', 'assistant', 'ai', 'chat', 'onyx', 'claude', 'help', 'automation'],
	description: 'The assistant that talks with you and runs OmniTool\'s tools, showing each step. Onyx runs it on this device; Claude can with your API key. The panel opens with Ctrl+J.',
	ai: false,
	mount(root) {
		const { h } = Omni;
		const mode = h('div');
		const ask = h('input', { type: 'text', id: 'oa-ask', placeholder: 'For example: generate 10 UUIDs and save them to a file' });
		const drawMode = async () => {
			const m = await Omni.ai.mode();
			const s = Omni.ai.settings();
			const onyx = m !== 'claude' || Omni.store.get('agent.engine', null) === 'onyx';
			mode.replaceChildren(onyx
				? Omni.forms.stateBox('empty', 'Omni Agent - Onyx', `Onyx is Omni Agent's local engine: small talk, questions about OmniTool, finding the right tool and running commands, all on this device with no internet. It can't write essays or code, or answer general knowledge questions.${m === 'claude' ? ' Switch to Claude in the panel for that.' : ' Add an Anthropic API key in Settings to let Omni Agent switch to Claude for that.'}`, m === 'claude' ? null : h('a', { class: 'btn btn-small', href: '#/settings' }, 'Open Settings'))
				: Omni.forms.readings([{ label: 'Engine', value: 'Claude', copy: false }, { label: 'Model', value: s.model }, { label: 'Effort', value: s.effort, copy: false }]));
		};
		const caps = Omni.agent.tools.map((t) => [t.name, t.description]);
		root.appendChild(h('div', { class: 'stack-lg' },
			h('form', { class: 'panel stack', onsubmit: (e) => {
				e.preventDefault();
				if (!ask.value.trim()) return ask.focus();
				Omni.toggleAgent(true);
				Omni.agent.ask(ask.value.trim());
				ask.value = '';
			} }, h('div', { class: 'field' }, h('label', { for: 'oa-ask' }, 'Ask Omni Agent'), ask), h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Send to the agent panel'), h('button', { type: 'button', class: 'btn', onclick: () => Omni.toggleAgent(true) }, 'Open the panel'))),
			h('section', { class: 'panel stack', 'aria-label': 'Mode' }, h('h2', null, 'Mode'), mode),
			h('section', { class: 'panel stack', 'aria-label': 'Abilities' }, h('h2', null, `What it can do in the ${Omni.edition} edition`), Omni.forms.table(['Tool', 'What it does'], caps), h('p', { class: 'muted', style: { fontSize: '0.86rem' } }, `run_tool reaches ${Omni.tools.filter((t) => t.run && t.ai !== false).length} of OmniTool's tools. Writes, deletes, downloads and editor changes always wait for your approval in the panel.`)),
			h('section', { class: 'panel stack msg-body', 'aria-label': 'Commands Onyx runs' }, h('h2', null, 'Commands Onyx runs'), h('div', { html: window.DOMPurify ? window.DOMPurify.sanitize(window.marked.parse(Omni.offline.HELP)) : '' })),
		));
		Omni.vendor(['marked.umd.js', 'purify.min.js']).then(() => {
			const box = root.querySelector('[aria-label="Commands Onyx runs"] div');
			if (box) box.innerHTML = window.DOMPurify.sanitize(window.marked.parse(Omni.offline.HELP));
		});
		drawMode();
		const off1 = Omni.on('secrets', drawMode);
		const off2 = Omni.on('store', (e) => e.key && (e.key.startsWith('ai.') || e.key === 'agent.engine') && drawMode());
		return () => {
			off1();
			off2();
		};
	},
});
