// No. 093 Text extractor: pulls emails, URLs, IP addresses, numbers, hashtags, mentions or dates out of any text.
Omni.register({
	no: 93,
	id: 'text-extractor',
	name: 'Text extractor',
	category: 'text',
	keywords: ['extract', 'emails', 'urls', 'links', 'ip address', 'numbers', 'hashtags', 'scrape', 'parse'],
	description: 'Finds every email address, URL, IP address, number, hashtag, @mention or ISO date in a block of text.',
	live: true,
	inputs: [
		{ name: 'text', label: 'Text', type: 'textarea', rows: 8, default: 'Ping ops@example.com or visit https://example.org/status?id=4. Server 192.168.1.20 failed at 2026-10-21 with 3 errors (#incident @oncall). Backup: 10.0.0.5, cost $1,240.50.' },
		{ name: 'kind', label: 'Extract', type: 'select', options: [{ value: 'email', label: 'Email addresses' }, { value: 'url', label: 'URLs' }, { value: 'ip', label: 'IP addresses (v4 and v6)' }, { value: 'number', label: 'Numbers' }, { value: 'hashtag', label: 'Hashtags' }, { value: 'mention', label: '@mentions' }, { value: 'date', label: 'ISO dates' }], default: 'email' },
		{ name: 'unique', label: 'Unique only', type: 'checkbox', default: true },
		{ name: 'sort', label: 'Sort', type: 'checkbox' },
	],
	run({ text, kind, unique, sort }) {
		const RE = {
			email: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
			url: /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g,
			ip: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b|\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b|\b(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?\b/gi,
			number: /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g,
			hashtag: /(?<![\w&])#[\p{L}\p{N}_]+/gu,
			mention: /(?<![\w.])@[\w](?:[\w.-]*\w)?/g,
			date: /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g,
		}[kind];
		let found = text.match(RE) || [];
		if (unique) found = [...new Set(found)];
		if (sort) found.sort(kind === 'number' ? (a, b) => parseFloat(a.replace(/,/g, '')) - parseFloat(b.replace(/,/g, '')) : undefined);
		return found.length ? { text: found.join('\n'), label: `${found.length} found` } : { note: 'Nothing of that kind in the text.' };
	},
});
