// Onyx's command layer: turns short commands into OmniTool tool runs, without a model.
(function () {
	'use strict';

	let lastText = null; // Output of the previous step, so "save them to a file" knows what "them" is.

	const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, hundred: 100 };
	const num = (s, fallback) => {
		if (s == null) return fallback;
		const k = String(s).toLowerCase();
		return k in NUM_WORDS ? NUM_WORDS[k] : Number(k.replace(/,/g, '')) || fallback;
	};
	const unquote = (s) => String(s || '').trim().replace(/^["'`](.*)["'`]$/s, '$1');

	/** Plain text from a summarized tool result, for chaining into a save or a reply. */
	function plainText(summary) {
		const parts = [];
		for (const block of summary) {
			if (block.columns && block.rows) parts.push([block.columns.join(','), ...block.rows.map((r) => r.join(','))].join('\n'));
			else for (const [k, v] of Object.entries(block)) if (typeof v === 'string' || typeof v === 'number') parts.push(Object.keys(block).length > 1 ? `${k}: ${v}` : String(v));
		}
		return parts.join('\n');
	}

	async function runTool(api, turn, toolId, args) {
		const out = await api.execute(turn, 'run_tool', { tool_id: toolId, args });
		lastText = plainText(out.result);
		return out;
	}

	async function readCode(api, turn) {
		if (Omni.edition === 'desktop' && Omni.native) {
			const status = await Omni.native.labscode.status();
			if (status.running) {
				const file = await api.execute(turn, 'labscode_read_active_file', {});
				if (file && file.text) return { text: file.text, name: file.name, lang: file.languageId };
			}
		}
		const pad = await api.execute(turn, 'codepad_read', {});
		if (pad && pad.text) return { text: pad.text, name: pad.name, lang: pad.language };
		throw new Error(Omni.edition === 'desktop' ? 'No code found: open a file in LabsCode or type some in Code Pad (No. 002).' : 'Code Pad (No. 002) is empty. Paste some code there first.');
	}

	// Guards keep conversation out of the tools: "what is a UUID" is a question, "I forgot my password" is not a request.
	const QUESTION = /^(?:what(?: is| are| does)|whats|define|explain|meaning of|tell me about)\b/i;
	const MAKING = /\b(generate|make|create|give|get|need|want|new|random|some|another|more)\b|\d/i;
	const making = (m) => !QUESTION.test(m.input.trim()) || MAKING.test(m.input.replace(/^\s*what\s+is\s+/i, ''));
	const notQuestion = (m) => !(QUESTION.test(m.input.trim()) && /\b(an?|the)\s+\w+\s*\??$|^\W*\w+(?:\s+\w+)?\s+\w+\s*\??$/i.test(m.input.trim()));

	/* Each rule: [pattern, handler(match, api, turn), guard(match)?]. Order matters: specific before general. */
	const rules = [
		[/\b(?:save|write|store|export|download|put)\b(?:.*?\b(?:to|as|in|into)\b\s+(?:a\s+)?(?:new\s+)?(?:text\s+)?(?:file\s*)?(?:called\s+|named\s+)?(["']?[\w\-. \\/:]+?["']?))?\s*$/i, async (m, api, turn) => {
			if (!lastText) throw new Error('There is nothing to save yet. Ask for something first, for example "generate 10 UUIDs and save them to a file".');
			let name = unquote(m[1] || '').trim();
			if (!name || /^(a|the|it|them|that|this|file|disk)$/i.test(name)) name = 'omnitool-output.txt';
			if (!/\.\w{1,6}$/.test(name)) name += '.txt';
			if (Omni.edition === 'desktop' && Omni.native) await api.execute(turn, 'write_file', { path: name, content: lastText + '\n' });
			else await api.execute(turn, 'save_download', { filename: name, content: lastText + '\n' });
		}],
		[/\b(\d+|an?|one|two|three|four|five|ten|twenty|fifty|hundred)?\s*(?:random\s+|new\s+)?(uuid\s*v?7|uuidv7|uuids?|guids?|ulids?|nano\s?ids?)\b/i, async (m, api, turn) => {
			const word = m[2].toLowerCase().replace(/\s/g, '');
			const kind = /7/.test(word) ? 'uuid7' : word.startsWith('ulid') ? 'ulid' : word.startsWith('nano') ? 'nanoid' : 'uuid4';
			await runTool(api, turn, 'id-generator', { kind, count: Math.min(1000, num(m[1], 1)) });
		}, making],
		[/\bpassphrases?\b/i, async (m, api, turn) => {
			const words = (m.input.match(/(\d+)\s*words?/i) || [])[1];
			await runTool(api, turn, 'passphrase', { words: num(words, 5), count: num((m.input.match(/(\d+)\s*passphrases/i) || [])[1], 1) });
		}, making],
		[/\b(\d+)?\s*(?:strong\s+|random\s+)?passwords?\b/i, async (m, api, turn) => {
			const len = (m.input.match(/(\d+)\s*(?:chars?|characters|long|length)/i) || [])[1];
			await runTool(api, turn, 'password', { count: Math.min(100, num(m[1] && !len ? m[1] : (m.input.match(/(\d+)\s*passwords/i) || [])[1], 1)), length: num(len, 20) });
		}, (m) => /\b(generate|make|create|give|get|need|new|random|strong)\b|\d/i.test(m.input) && !/\b(forgot|forget|reset|change|my|strength|check|how strong|secure|hack|leak)\b/i.test(m.input)],
		[/\b(lorem|ipsum|placeholder text|dummy text)\b/i, async (m, api, turn) => {
			const n = (m.input.match(/(\d+)\s*(paragraphs?|sentences?|words?)/i) || []);
			await runTool(api, turn, 'lorem', { count: num(n[1], 2), unit: n[2] ? n[2].toLowerCase().replace(/s$/, '') + 's' : 'paragraphs' });
		}, making],
		[/\broll\b\s*(?:an?\s+|the\s+|some\s+)?((?:\d*d\d+(?:\s*[+-]\s*\d+)?(?:kh\d+|kl\d+)?\s*)+|dice|die)/i, async (m, api, turn) => {
			const notation = m[1] && /d/i.test(m[1]) && !/^(dice|die)$/i.test(m[1].trim()) ? m[1].trim() : '1d6';
			await runTool(api, turn, 'dice', { notation });
		}],
		[/\bflip\b\s*(\d+|a|an|one|two|three|ten)?\s*coins?/i, async (m, api, turn) => {
			await runTool(api, turn, 'coin', { count: Math.min(10000, num(m[1], 1)) });
		}],
		[/\brandom\s+(?:whole\s+)?(?:numbers?|integers?)\b(?:.*?(?:between|from)\s*(-?[\d.]+)\s*(?:and|to|-)\s*(-?[\d.]+))?/i, async (m, api, turn) => {
			const count = (m.input.match(/(\d+)\s+random/i) || [])[1];
			await runTool(api, turn, 'random-number', { min: num(m[1], 1), max: num(m[2], 100), count: num(count, 1) });
		}],
		[/\b([A-Za-z]{3})\s+(?:to|in|into)\s+([A-Za-z]{3})\b/, async (m, api, turn) => {
			const amount = (m.input.match(/(-?[\d.,]+)/) || [])[1];
			await runTool(api, turn, 'currency', { amount: num(amount, 1), from: m[1].toUpperCase(), to: m[2].toUpperCase() });
		}, (m) => !!Omni.byId.currency && CURRENCIES.test(m[1]) && CURRENCIES.test(m[2])],
		[/(-?[\d.,]+)\s*(°?\s?[a-zA-Z°µ/²³]+(?:\s[a-zA-Z]+)?)\s+(?:to|in|into|as)\s+(°?\s?[a-zA-Z°µ/²³]+(?:\s[a-zA-Z]+)?)\s*\??$/i, async (m, api, turn) => {
			await runTool(api, turn, 'unit-converter', { value: num(m[1].replace(/,/g, ''), 0), from: m[2].trim(), to: m[3].trim() });
		}, (m) => !/^(binary|bin|hex|hexadecimal|octal|oct|decimal|dec|base\s?\d+)$/.test(m[3].trim().toLowerCase())],
		[/\b(-?(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d+))\s+(?:in|to|as|into)\s+(binary|bin|hex|hexadecimal|octal|oct|decimal|dec)\b/i, async (m, api, turn) => {
			const target = { binary: '2', bin: '2', hex: '16', hexadecimal: '16', octal: '8', oct: '8', decimal: '10', dec: '10' }[m[2].toLowerCase()];
			let v = m[1].toLowerCase();
			let from = '10';
			if (v.startsWith('0x')) (from = '16'), (v = v.slice(2));
			else if (v.startsWith('0b')) (from = '2'), (v = v.slice(2));
			else if (v.startsWith('0o')) (from = '8'), (v = v.slice(2));
			await runTool(api, turn, 'base-converter', { value: v, from, to: target });
		}],
		[/\b(md5|sha-?1|sha-?256|sha-?384|sha-?512|crc-?32)\b/i, async (m, api, turn) => {
			const algo = m[1].toLowerCase().replace('-', '');
			const text = unquote(m.input.replace(/\b(hash|digest|checksum|of|with|using|the|text|string|compute|calculate|get)\b/gi, ' ').replace(m[1], ' ').replace(/\s+/g, ' ').trim());
			const r = await runTool(api, turn, 'hash', { text });
			const key = { md5: 'MD5', sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512', crc32: 'CRC32' }[algo];
			const hit = r.result.find((b) => key in b);
			if (hit) lastText = String(hit[key]);
		}, notQuestion],
		[/\bbase-?64\b/i, async (m, api, turn) => {
			const decode = /\bdecode\b/i.test(m.input);
			const text = unquote(m.input.replace(/\b(base-?64|encode|decode|as|in|to|from|the|text|string)\b/gi, ' ').replace(/\s+/g, ' ').trim());
			await runTool(api, turn, 'base64', { text, mode: decode ? 'decode' : 'encode' });
		}, notQuestion],
		[/\burl[- ]?(encode|decode)\b\s*(.+)$/i, async (m, api, turn) => {
			await runTool(api, turn, 'url-encoder', { text: unquote(m[2]), mode: m[1].toLowerCase(), scope: 'component' });
		}],
		[/\b(camel|snake|kebab|pascal|constant|title|sentence)\s*case\b\s*(?:of\s+|for\s+)?(.+)$/i, async (m, api, turn) => {
			await runTool(api, turn, 'case-converter', { text: unquote(m[2]) });
		}],
		[/\b(timestamp|epoch|unix time)\b/i, async (m, api, turn) => {
			const value = (m.input.match(/\b(\d{9,13})\b/) || [])[1];
			await runTool(api, turn, 'timestamp', { input: value || 'now' });
		}, (m) => !(QUESTION.test(m.input.trim()) && /\b(an?)\b/i.test(m.input))],
		[/\b(explain|outline|summari[sz]e|describe)\b.*\b(code|file|script|function)\b/i, async (m, api, turn) => {
			const code = await readCode(api, turn);
			const out = await runTool(api, turn, 'code-explainer', { code: code.text, language: code.lang || 'auto' });
			await turn.markdown(`Offline outline of **${code.name || 'the code'}**:\n\n${plainText(out.result)}`);
		}],
		[/\b(?:(?:find|check|look for|spot|any)\b.*\b(?:bugs?|issues|problems|errors)|review|lint)\b.*\b(code|file|script)\b/i, async (m, api, turn) => {
			const code = await readCode(api, turn);
			const out = await runTool(api, turn, 'bug-finder', { code: code.text, language: code.lang || 'auto' });
			await turn.markdown(`Offline checks for **${code.name || 'the code'}**:\n\n${plainText(out.result)}`);
		}],
		[/^\s*(?:calculate|compute|what(?:'s| is)|evaluate|eval|solve|=)?\s*([-+*/^().%,\d\s]*\d[-+*/^().%,\d\s]*|(?:sqrt|sin|cos|tan|log|ln|abs|pi|e)\b.*)\s*\??\s*$/i, async (m, api, turn) => {
			await runTool(api, turn, 'scientific', { expression: m[1].trim() });
		}],
		[/^(?:open|show|go to|launch|start)\s+(?:the\s+)?(.+?)(?:\s+tool)?\s*$/i, async (m, api, turn) => {
			const hit = Omni.fuzzy.searchTools(m[1], Omni.sortedTools())[0];
			if (!hit) throw new Error(`No tool matches "${m[1]}".`);
			await api.execute(turn, 'open_tool', { tool_id: hit.tool.id });
		}, (m) => {
			const hit = Omni.fuzzy.searchTools(m[1], Omni.sortedTools())[0];
			return !!hit && hit.score >= 90;
		}],
	];
	const CURRENCIES = /^(usd|eur|gbp|jpy|cad|aud|chf|cny|sek|nok|dkk|pln|czk|huf|inr|brl|mxn|zar|try|krw|sgd|hkd|nzd|ils|php|thb|idr|myr|ron|bgn|isk)$/i;

	const HELP = [
		'**Commands Onyx runs** with OmniTool\'s own tools:',
		'- `generate 10 uuids` (also ULID, Nano ID, UUID v7), `5 passwords 24 characters`, `a passphrase`',
		'- `convert 72 F to C`, `5 km to miles`, `100 USD to EUR`, `255 in hex`',
		'- `sha256 hello`, `base64 encode hello`, `url encode a b&c`, `snake case Hello World`',
		'- `roll 3d6+2`, `flip 10 coins`, `random number between 1 and 50`, `lorem 3 paragraphs`',
		'- `what is 2^10 / 3`, `unix timestamp`',
		Omni.edition === 'desktop' ? '- `explain the file`, `find bugs in this code` (the LabsCode file, or Code Pad)' : '- `explain the code`, `find bugs in this code` (Code Pad)',
		'- `open the qr code tool`',
		'- Chain steps with "and" or "then": `generate 10 uuids and save them to a file called ids.txt`',
	].join('\n');

	/** Splits on "then" or ";" and on "and" when it starts a new action, not inside "between 1 and 10". */
	function clauses(text) {
		return text
			.split(/\s*(?:;|\bthen\b|,?\s+and\s+(?=(?:then\s+)?(?:save|write|store|export|download|put|copy|open|hash|convert|encode|decode|generate|roll|flip|explain|find)\b))\s*/i)
			.map((s) => s.trim())
			.filter(Boolean);
	}

	/** Matches every part of a message to a command; null if any part isn't one (then it is conversation). */
	function plan(text) {
		const parts = clauses(String(text || ''));
		if (!parts.length) return null;
		const steps = [];
		for (const part of parts) {
			const step = rules.map(([re, fn, guard]) => {
				const m = part.match(re);
				return m && (!guard || guard(m)) ? { part, m, fn } : null;
			}).find(Boolean);
			if (!step) return null;
			steps.push(step);
		}
		return steps;
	}

	/** Runs a plan in the given turn, showing each tool step; the last result is shown unless the plan ended in a save. */
	async function run(steps, api, turn) {
		if (!steps) return '';
		for (const step of steps) {
			if (api.signal.aborted) return '';
			try {
				await step.fn(step.m, api, turn);
			} catch (err) {
				turn.note(err.message || String(err), true);
				return '';
			}
		}
		const last = steps[steps.length - 1].part;
		if (lastText && !/\b(save|write|store|export|download|put|open|explain|outline|bug|review|lint)\b/i.test(last)) {
			await turn.markdown('```\n' + lastText.slice(0, 4000) + (lastText.length > 4000 ? '\n...' : '') + '\n```');
		}
		return '';
	}

	Omni.offline = { plan, run, clauses, plainText, reset: () => (lastText = null), HELP };
})();
