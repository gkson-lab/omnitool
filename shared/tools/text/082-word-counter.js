// No. 082 Word counter: words, characters, sentences, paragraphs, reading time and the most used words.
Omni.register({
	no: 82,
	id: 'word-counter',
	name: 'Word counter',
	category: 'text',
	keywords: ['word count', 'character count', 'count', 'reading time', 'keyword density', 'length'],
	description: 'Counts words, characters, sentences and paragraphs, estimates reading and speaking time, and lists the most used words.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Text', type: 'textarea', rows: 10, default: 'OmniTool keeps 150 small tools in one place. Each tool has a number, so you can find it fast. Type a number in the palette and the tool opens.' },
		{ name: 'limit', label: 'Character limit to check against (optional)', type: 'number', min: 1, placeholder: 'e.g. 280' },
	],
	run({ text, limit }) {
		const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
		const sentences = text.split(/[.!?]+(?=\s|$)/).filter((s) => /\p{L}/u.test(s)).length;
		const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
		const stop = new Set('the a an and or of to in is it that for on with as at by be this are was from you your not but have has had we they i he she his her its our their'.split(' '));
		const freq = {};
		words.forEach((w) => {
			const k = w.toLowerCase();
			if (!stop.has(k) && k.length > 2) freq[k] = (freq[k] || 0) + 1;
		});
		const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
		const minutes = (n, wpm) => {
			const m = n / wpm;
			return m < 1 ? `${Math.max(1, Math.round(m * 60))} sec` : `${Math.round(m * 10) / 10} min`;
		};
		const chars = [...text].length;
		const readings = [
			{ label: 'Words', value: words.length, copy: false },
			{ label: 'Characters', value: chars, copy: false },
			{ label: 'Characters without spaces', value: [...text.replace(/\s/g, '')].length, copy: false },
			{ label: 'Sentences', value: sentences, copy: false },
			{ label: 'Paragraphs', value: paragraphs, copy: false },
			{ label: 'Lines', value: text ? text.split('\n').length : 0, copy: false },
			{ label: 'Reading time (238 wpm)', value: minutes(words.length, 238), copy: false },
			{ label: 'Speaking time (150 wpm)', value: minutes(words.length, 150), copy: false },
		];
		return {
			readings,
			meter: limit ? { value: Math.min(1, chars / limit), label: `Characters used of ${limit}`, text: chars > limit ? `${chars - limit} over` : `${limit - chars} left` } : null,
			table: top.length ? { label: 'Most used words (common words left out)', columns: ['Word', 'Times', 'Share'], rows: top.map(([w, c]) => [w, c, `${((c / words.length) * 100).toFixed(1)}%`]), numeric: [1, 2] } : null,
		};
	},
});
