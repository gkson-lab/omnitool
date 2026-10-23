// No. 145 Regex builder: Claude writes a regex from a description; offline infers one from examples. Both are tested locally.
(function () {
	'use strict';
	const lines = (s) => String(s || '').split('\n').map((x) => x.replace(/\r$/, '')).filter((x) => x !== '');

	/** Checks a pattern against the examples in this browser, so a wrong regex shows up immediately. */
	function testTable(pattern, args) {
		let re;
		try {
			re = new RegExp(pattern.replace(/^\/|\/[a-z]*$/g, ''));
		} catch (err) {
			return { type: 'error', message: `The regex does not compile in JavaScript: ${err.message}` };
		}
		const rows = [...lines(args.examples).map((e) => [e, 'should match', re.test(e) ? 'matches' : 'MISSED']), ...lines(args.negatives).map((e) => [e, 'should not match', re.test(e) ? 'WRONG MATCH' : 'rejected'])];
		return { type: 'table', label: 'Tested against your examples', columns: ['Example', 'Expectation', 'Result'], rows };
	}

	Omni.aiTool({
		no: 145,
		id: 'regex-builder',
		name: 'Regex builder',
		keywords: ['regex', 'regular expression', 'generate regex', 'pattern', 'build regex'],
		description: 'Builds a regular expression from a plain description and example strings, then tests it against your examples.',
		action: 'Build regex',
		codeField: 'examples',
		noLoad: true,
		markdown: true,
		emptyText: 'Add at least one example that should match.',
		offlineLabel: 'Infers a pattern from the shape of your examples (digits, letters, punctuation); it ignores the description.',
		inputs: [
			{ name: 'description', label: 'What should it match? (Claude)', type: 'text', default: 'Order numbers like ORD-2026-00042', wide: true },
			{ name: 'examples', label: 'Should match, one per line', type: 'textarea', mono: true, rows: 4, default: 'ORD-2026-00042\nORD-2025-91003\nORD-2026-00001' },
			{ name: 'negatives', label: 'Should not match, one per line (optional)', type: 'textarea', mono: true, rows: 3, default: 'ORD-26-42\nord-2026-00042' },
			{ name: 'flavor', label: 'Regex flavor', type: 'select', options: ['JavaScript', 'Python', 'PCRE', 'Java', '.NET', 'Go (RE2)'], default: 'JavaScript' },
		],
		system: () => 'You write correct, readable regular expressions. Prefer anchors and explicit character classes over .*. Reply with the regex alone in a fenced code block on the first lines, then a short token-by-token explanation in Markdown.',
		prompt: ({ description, examples, negatives, flavor }) => `Write a ${flavor} regular expression that matches: ${description || '(see examples)'}\n\nIt must match:\n${lines(examples).join('\n')}\n\n${lines(negatives).length ? `It must not match:\n${lines(negatives).join('\n')}` : ''}`,
		offline: (args) => {
			const r = Omni.codeinfo.regexFromExamples(lines(args.examples), lines(args.negatives));
			return { text: r.pattern, label: 'Inferred regex', blocks: [testTable(r.pattern, args)], note: r.falseHits.length ? 'It also matches some "should not match" examples: add more varied examples to tighten it.' : null };
		},
		afterResult: (text, args, output) => {
			const pattern = Omni.aiTool.extractCode(text).split('\n')[0].trim();
			if (pattern) output.appendChild(Omni.forms.renderBlock(testTable(pattern, args)));
		},
	});
})();
