// No. 144 Text summarizer: Claude summarizes; offline picks the highest-scoring sentences (extractive).
Omni.aiTool({
	no: 144,
	id: 'summarizer',
	name: 'Text summarizer',
	keywords: ['summarize', 'summary', 'tldr', 'condense', 'key points', 'abstract'],
	description: 'Summarizes long text as a short paragraph or bullet points, at the length you choose.',
	action: 'Summarize',
	codeField: 'text',
	emptyText: 'Paste the text to summarize.',
	offlineLabel: 'Picks the most representative sentences from the text itself (extractive); it does not rephrase.',
	inputs: [
		{ name: 'text', label: 'Text', type: 'textarea', rows: 12, default: 'OmniTool ships as two editions. The desktop edition starts from start.bat, installs what it needs into its own folder, and embeds LabsCode, the gklabs fork of VS Code, inside a tab. It has 150 tools, including system tools such as ping, a process viewer and a static file server. The web edition opens from index.html with no server and keeps 133 of the tools; the others need access to the computer that browsers do not allow. Both editions include Omni Agent, an assistant that runs the same tools and shows each step. With an Anthropic API key it uses Claude; without one it falls back to a limited offline mode that understands short commands. Settings, notes and to-dos are stored on the device: in a config file on desktop and in local storage on the web.' },
		{ name: 'length', label: 'Length', type: 'select', options: [{ value: '2', label: 'Very short (2 sentences)' }, { value: '4', label: 'Short (4 sentences)' }, { value: '7', label: 'Medium (7 sentences)' }], default: '2' },
		{ name: 'format', label: 'Format', type: 'seg', options: [{ value: 'paragraph', label: 'Paragraph' }, { value: 'bullets', label: 'Bullet points' }], default: 'paragraph' },
	],
	system: () => 'You summarize text faithfully. Keep the key facts, numbers and names; add nothing that is not in the text. Write plainly, without filler.',
	prompt: ({ text, length, format }) => `Summarize the following in ${format === 'bullets' ? `at most ${length} bullet points` : `at most ${length} sentences, as one paragraph`}.\n\n${text}`,
	offline: ({ text, length, format }) => {
		const r = Omni.codeinfo.summarize(text, Number(length));
		if (!r.picked.length) throw new Error('The text has no full sentences to pick from.');
		const out = format === 'bullets' ? r.picked.map((s) => `- ${s}`).join('\n') : r.picked.join(' ');
		return { text: out, label: `${r.picked.length} of ${r.sentences.length} sentences` };
	},
});
