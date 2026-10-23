// No. 092 Readability score: Flesch reading ease, grade levels, and the sentences that drag the score down.
(function () {
	'use strict';
	/** Syllable estimate for English: vowel groups, minus a silent final e, at least one per word. */
	function syllables(word) {
		const w = word.toLowerCase().replace(/[^a-z]/g, '');
		if (!w) return 0;
		if (w.length <= 3) return 1;
		const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
		return Math.max(1, groups ? groups.length : 1);
	}

	Omni.register({
		no: 92,
		id: 'readability',
		name: 'Readability score',
		category: 'text',
		keywords: ['readability', 'flesch', 'grade level', 'plain english', 'writing', 'clarity'],
		description: 'Flesch reading ease, Flesch-Kincaid grade and Gunning fog for English text, plus the longest sentences to shorten first.',
		live: true,
		inputs: [{ name: 'text', label: 'Text', type: 'textarea', rows: 10, default: 'Click the button to save. Your notes stay on this device. Notwithstanding the aforementioned considerations, organizational stakeholders should endeavor to operationalize comprehensive documentation methodologies in order to facilitate subsequent knowledge transfer activities.' }],
		run({ text }) {
			const sentences = (text.match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter((s) => /[a-z]/i.test(s));
			const words = text.match(/[A-Za-z][A-Za-z'-]*/g) || [];
			if (words.length < 3) return { note: 'Type a few sentences of English.' };
			const syl = words.reduce((s, w) => s + syllables(w), 0);
			const complex = words.filter((w) => syllables(w) >= 3).length;
			const wps = words.length / Math.max(1, sentences.length);
			const spw = syl / words.length;
			const ease = 206.835 - 1.015 * wps - 84.6 * spw;
			const grade = 0.39 * wps + 11.8 * spw - 15.59;
			const fog = 0.4 * (wps + (100 * complex) / words.length);
			const band = ease >= 80 ? 'Easy' : ease >= 60 ? 'Plain English' : ease >= 50 ? 'Fairly difficult' : ease >= 30 ? 'Difficult' : 'Very difficult';
			const long = sentences.map((s) => [s, (s.match(/[A-Za-z][A-Za-z'-]*/g) || []).length]).filter(([, n]) => n > 20).sort((a, b) => b[1] - a[1]).slice(0, 5);
			return {
				meter: { value: Math.max(0, Math.min(100, ease)) / 100, label: `Reading ease: ${band}`, text: ease.toFixed(1) },
				readings: [{ label: 'Flesch-Kincaid grade', value: grade.toFixed(1), copy: false }, { label: 'Gunning fog', value: fog.toFixed(1), copy: false }, { label: 'Words per sentence', value: wps.toFixed(1), copy: false }, { label: 'Syllables per word', value: spw.toFixed(2), copy: false }, { label: 'Words of 3+ syllables', value: `${complex} (${Math.round((100 * complex) / words.length)}%)`, copy: false }],
				table: long.length ? { label: 'Sentences over 20 words', columns: ['Sentence', 'Words'], rows: long, numeric: [1] } : null,
				note: 'Scores are formulas built for English; syllables are estimated.',
			};
		},
	});
})();
