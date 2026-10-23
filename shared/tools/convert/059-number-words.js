// No. 059 Number to words: English words for integers up to the quintillions, decimals and check-style amounts.
(function () {
	'use strict';
	const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
	const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
	const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'];

	function under1000(n) {
		const parts = [];
		if (n >= 100) {
			parts.push(ONES[Math.floor(n / 100)] + ' hundred');
			n %= 100;
		}
		if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
		else if (n > 0 || !parts.length) parts.push(ONES[n]);
		return parts.join(' ');
	}

	function integerWords(big) {
		if (big === 0n) return 'zero';
		const groups = [];
		let n = big;
		while (n > 0n) {
			groups.push(Number(n % 1000n));
			n /= 1000n;
		}
		if (groups.length > SCALES.length) throw new Error('Numbers up to the quintillions are supported.');
		return groups.map((g, i) => (g ? under1000(g) + (SCALES[i] ? ' ' + SCALES[i] : '') : '')).filter(Boolean).reverse().join(' ');
	}

	Omni.register({
		no: 59,
		id: 'number-words',
		name: 'Number to words',
		category: 'convert',
		keywords: ['number', 'words', 'spell', 'check', 'cheque', 'amount', 'english'],
		description: 'Writes numbers out in English words, including decimals and check-style amounts.',
		live: true,
		inputs: [
			{ name: 'value', label: 'Number', type: 'text', default: '1234567.89' },
			{ name: 'style', label: 'Style', type: 'seg', options: [{ value: 'plain', label: 'Plain' }, { value: 'check', label: 'Check amount' }], default: 'plain' },
			{ name: 'currency', label: 'Currency word', type: 'text', default: 'dollars', when: (v) => v.style === 'check' },
		],
		run({ value, style, currency }) {
			const m = String(value).replace(/[,_\s]/g, '').match(/^(-?)(\d+)(?:\.(\d+))?$/);
			if (!m) throw new Error('Type a number like 1234 or 1234.56.');
			const sign = m[1] ? 'minus ' : '';
			const whole = integerWords(BigInt(m[2]));
			let text;
			if (style === 'check') {
				const cents = (m[3] || '').padEnd(2, '0').slice(0, 2);
				text = `${sign}${whole} ${currency || 'dollars'} and ${cents}/100`;
				text = text.charAt(0).toUpperCase() + text.slice(1);
			} else text = sign + whole + (m[3] ? ' point ' + m[3].split('').map((d) => ONES[+d]).join(' ') : '');
			return { text, label: 'In words' };
		},
	});
})();
