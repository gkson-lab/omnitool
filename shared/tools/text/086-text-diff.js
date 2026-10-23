// No. 086 Text diff: word or character level differences shown inline, for prose rather than code.
Omni.register({
	no: 86,
	id: 'text-diff',
	name: 'Text diff',
	category: 'text',
	keywords: ['diff', 'compare', 'text', 'changes', 'words', 'track changes', 'redline'],
	description: 'Compares two pieces of writing word by word (or letter by letter) and marks what was added and removed inline.',
	vendor: ['diff.min.js'],
	live: true,
	inputs: [
		{ name: 'a', label: 'Original', type: 'textarea', rows: 6, default: 'The quick brown fox jumps over the lazy dog. It was a sunny day.' },
		{ name: 'b', label: 'Changed', type: 'textarea', rows: 6, default: 'The quick red fox leaped over the lazy dog. It was a cold, sunny day.' },
		{ name: 'level', label: 'Compare by', type: 'seg', options: [{ value: 'words', label: 'Words' }, { value: 'chars', label: 'Characters' }, { value: 'sentences', label: 'Sentences' }], default: 'words' },
		{ name: 'ignoreCase', label: 'Ignore case', type: 'checkbox' },
	],
	run({ a, b, level, ignoreCase }) {
		const D = window.Diff;
		const parts = level === 'chars' ? D.diffChars(a, b, { ignoreCase }) : level === 'sentences' ? D.diffSentences(a, b) : D.diffWordsWithSpace(a, b, { ignoreCase });
		const { h } = Omni;
		const view = h('div', { class: 'readout', style: { fontFamily: 'var(--font-sans)', fontStretch: '100%', fontSize: '0.95rem', lineHeight: '1.8' }, tabindex: '0' }, parts.map((p) => (p.added ? h('ins', { class: 'diff-add' }, p.value) : p.removed ? h('del', { class: 'diff-del' }, p.value) : p.value)));
		const added = parts.filter((p) => p.added).reduce((s, p) => s + (level === 'chars' ? p.value.length : p.value.trim().split(/\s+/).filter(Boolean).length), 0);
		const removed = parts.filter((p) => p.removed).reduce((s, p) => s + (level === 'chars' ? p.value.length : p.value.trim().split(/\s+/).filter(Boolean).length), 0);
		const unit = level === 'chars' ? 'characters' : 'words';
		return {
			readings: [{ label: `Added ${unit}`, value: added, copy: false }, { label: `Removed ${unit}`, value: removed, copy: false }, { label: 'Identical', value: !added && !removed ? 'Yes' : 'No', copy: false }],
			node: Omni.forms.block('Changes (added are underlined green, removed are underlined red)', view),
		};
	},
});
