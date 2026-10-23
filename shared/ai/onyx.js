// Onyx: Omni Agent's local engine. A small intent model (TF-IDF over example phrases, typo-tolerant), a little memory,
// a glossary, a tool finder and OmniTool's offline commands. Runs on this device: no network, no model download.
(function () {
	'use strict';

	/* ---------- Text ---------- */

	const CONTRACTIONS = [
		[/\bwhat's\b|\bwhats\b/g, 'what is'], [/\bi'm\b|\bim\b/g, 'i am'], [/\bcan't\b|\bcant\b/g, 'can not'], [/\bwon't\b/g, 'will not'],
		[/n't\b/g, ' not'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'], [/'d\b/g, ' would'], [/\b(it|that|there|how|who|where|when)'s\b/g, '$1 is'],
		[/\blet's\b/g, 'let us'], [/\bu\b/g, 'you'], [/\bur\b/g, 'your'], [/\br\b/g, 'are'], [/\bpls\b|\bplz\b/g, 'please'], [/\bthx\b|\bthnx\b/g, 'thanks'],
		[/\bwanna\b/g, 'want to'], [/\bgonna\b/g, 'going to'], [/\bgotta\b/g, 'got to'], [/\bhru\b/g, 'how are you'], [/\bwyd\b/g, 'what are you doing'],
		[/\bidk\b/g, 'i do not know'], [/\bomg\b/g, 'oh'], [/\bya\b/g, 'you'], [/\bcuz\b|\bcos\b/g, 'because'],
		[/\bchat ?gpt\b/g, 'chatgpt'], [/\bgoodnight\b|\bgood nite\b|\bnite\b/g, 'good night'], [/\bback up\b/g, 'backup'], [/\bgoodbye\b/g, 'good bye'], [/\bthank u\b/g, 'thank you'],
	];
	const STOP = new Set(['a', 'an', 'the', 'um', 'uh', 'so', 'just', 'really', 'very', 'please', 'well', 'quite', 'actually', 'kind', 'of', 'to', 'be', 'me', 'my', 'and']);

	function normalize(raw) {
		let t = String(raw).toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
		// "Onyx" as a form of address carries no meaning; elsewhere ("what is onyx") it means me.
		t = t.replace(/^(\W*(?:hey|hi|hello|ok|okay|yo)?\W*)onyx\b[\s,!:.]*/, '$1').replace(/[\s,]+onyx\W*$/, '').replace(/\bonyx\b/g, 'you');
		for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
		return t.replace(/'/g, '').replace(/[^a-z0-9%+\-*/^.=\s]/g, ' ').replace(/\s+/g, ' ').trim();
	}

	function stem(w) {
		if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
		if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
		if (w.length > 4 && w.endsWith('ly')) return w.slice(0, -2);
		if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
		return w;
	}

	const words = (text) => normalize(text).replace(/[^a-z0-9\s]/g, ' ').split(' ').filter(Boolean);
	const tokens = (text) => words(text).filter((w) => !STOP.has(w)).map(stem);

	/* ---------- Intent model ---------- */

	let model = null;
	/** Builds TF-IDF vectors (words and word pairs) for every example phrase of every intent. */
	function build() {
		const docs = [];
		for (const intent of Omni.onyxData.INTENTS) for (const ex of intent.examples) docs.push({ id: intent.id, feats: features(tokens(ex)) });
		const df = new Map();
		docs.forEach((d) => new Set(d.feats).forEach((f) => df.set(f, (df.get(f) || 0) + 1)));
		const idf = new Map([...df].map(([f, n]) => [f, Math.log((docs.length + 1) / (n + 1)) + 1]));
		docs.forEach((d) => (d.vec = vector(d.feats, idf)));
		const vocab = new Map();
		docs.forEach((d) => d.feats.filter((f) => !f.includes('_')).forEach((f) => vocab.set(f, (vocab.get(f) || 0) + 1)));
		model = { docs, idf, vocab };
	}

	function features(toks) {
		const out = [...toks];
		for (let i = 0; i < toks.length - 1; i++) out.push(toks[i] + '_' + toks[i + 1]);
		return out;
	}

	function vector(feats, idf) {
		const v = new Map();
		feats.forEach((f) => v.set(f, (v.get(f) || 0) + (idf.get(f) || 0)));
		const norm = Math.hypot(...v.values()) || 1;
		v.forEach((x, f) => v.set(f, x / norm));
		return v;
	}

	function distance(a, b) {
		if (Math.abs(a.length - b.length) > 2) return 3;
		const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
		for (let j = 1; j <= b.length; j++) d[0][j] = j;
		for (let i = 1; i <= a.length; i++) {
			for (let j = 1; j <= b.length; j++) {
				d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
				if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
			}
		}
		return d[a.length][b.length];
	}

	/** Maps a misspelled word to the closest word Onyx knows ("helo" to "hello"), if one is close enough. */
	function correct(tok) {
		if (model.vocab.has(tok) || tok.length < 4 || /\d/.test(tok)) return tok;
		const limit = tok.length >= 7 ? 2 : 1;
		let best = tok;
		let bestD = limit + 1;
		let bestN = 0;
		for (const [w, n] of model.vocab) {
			const dd = distance(tok, w);
			const better = dd < bestD || (dd === bestD && (w.endsWith(tok.slice(-1)) && !best.endsWith(tok.slice(-1)) || (w.endsWith(tok.slice(-1)) === best.endsWith(tok.slice(-1)) && n > bestN)));
			if (better) {
				best = w;
				bestD = dd;
				bestN = n;
			}
		}
		return bestD <= limit ? best : tok;
	}

	/** Scores every intent for a message; returns them best first as { id, score }. */
	function classify(text) {
		if (!model) build();
		const toks = tokens(text).map(correct);
		if (!toks.length) return [];
		const v = vector(features(toks), model.idf);
		const maxIdf = Math.max(...model.idf.values());
		const weight = (t) => model.idf.get(t) || maxIdf;
		const total = toks.reduce((n, t) => n + weight(t), 0);
		const best = new Map();
		for (const d of model.docs) {
			let s = 0;
			v.forEach((x, f) => d.vec.has(f) && (s += x * d.vec.get(f)));
			if (!s) continue;
			const covered = toks.reduce((n, t) => n + (d.vec.has(t) ? weight(t) : 0), 0);
			s *= Math.sqrt(covered / total);
			if (s > (best.get(d.id) || 0)) best.set(d.id, s);
		}
		return [...best].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
	}

	/* ---------- Tool finder ---------- */

	let toolIndex = null;
	/** Finds the tools a sentence like "I need to pretty print some JSON" is about, by weighted word overlap. */
	function findTools(text) {
		if (!toolIndex) {
			const df = new Map();
			const entries = Omni.tools.map((t) => {
				const name = new Set(tokens(t.name));
				const keys = new Set(t.keywords.flatMap(tokens));
				const desc = new Set(tokens(t.description || ''));
				new Set([...name, ...keys, ...desc]).forEach((w) => df.set(w, (df.get(w) || 0) + 1));
				return { t, name, keys, desc };
			});
			toolIndex = { entries, idf: (w) => Math.log((entries.length + 1) / ((df.get(w) || 0) + 1)) };
		}
		const IGNORE = new Set(['need', 'want', 'how', 'can', 'you', 'i', 'do', 'some', 'help', 'tool', 'for', 'with', 'this', 'that', 'there', 'thing', 'something', 'make', 'get', 'use', 'like', 'would', 'should', 'could', 'have', 'got', 'in', 'on', 'at', 'what', 'which', 'way', 'way']);
		const q = [...new Set(tokens(text))].filter((w) => !IGNORE.has(w) && w.length > 1);
		if (!q.length) return [];
		return toolIndex.entries
			.map((e) => {
				let s = 0;
				let hits = 0;
				for (const w of q) {
					const weight = toolIndex.idf(w);
					if (e.name.has(w)) s += weight * 2;
					else if (e.keys.has(w)) s += weight * 1.6;
					else if (e.desc.has(w)) s += weight * 0.8;
					else continue;
					hits++;
				}
				return { tool: e.t, score: s, hits };
			})
			.filter((r) => r.score >= 2.4 && r.hits >= Math.min(2, q.length))
			.sort((a, b) => b.score - a.score || a.tool.no - b.tool.no)
			.slice(0, 3);
	}

	/* ---------- Memory and conversation ---------- */

	const MEMORY_KEY = 'onyx.memory';
	const memory = () => Object.assign({ name: null, facts: [], met: null }, Omni.store.get(MEMORY_KEY, {}));
	const saveMemory = (m) => Omni.store.set(MEMORY_KEY, m);

	const fresh = () => ({ lastAnswer: null, pending: null, expect: null, lastIntent: null, lastReply: '', lastKind: null, lastCommand: null, why: null, recent: {}, bags: {}, misses: 0 });
	let convo = fresh();

	const part = () => {
		const h = new Date().getHours();
		return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
	};

	/** Picks a variant, avoiding the ones used most recently under the same key. */
	function pick(key, list) {
		const recent = convo.recent[key] || [];
		const options = list.filter((x) => !recent.includes(x));
		const choice = (options.length ? options : list)[Math.floor(Math.random() * (options.length || list.length))];
		convo.recent[key] = [choice, ...recent].slice(0, Math.max(1, Math.floor(list.length / 2)));
		return choice;
	}

	/** Deals from a shuffled bag, so every joke (or tip, or fact) comes up once before any repeats. */
	function draw(key, list) {
		if (!convo.bags[key] || !convo.bags[key].length) convo.bags[key] = Omni.random.shuffle(Omni.random.source(), list.map((_, i) => i));
		convo.lastKind = key;
		return list[convo.bags[key].pop()];
	}

	const fill = (text, mem) => String(text).replace(/\{name\}/g, mem.name ? `, ${mem.name}` : '');

	const YES = /^(y|yes|yeah|yep|yup|sure|ok|okay|please|yes please|go ahead|do it|please do|definitely|absolutely|of course|sounds good|why not|alright|sure thing|go for it)\b[\s!.]*$/i;
	const NO = /^(n|no|nope|nah|no thanks|no thank you|not now|maybe later|never mind|nevermind|cancel|stop|don't|dont)\b[\s!.]*$/i;
	const CRISIS = /\b(kill myself|killing myself|suicid|end my life|want to die|wanna die|don'?t want to live|hurt myself|self[- ]harm)\b/i;
	const FOREIGN = /^(hola|bonjour|salut|hallo|ciao|ol[aá]|konnichiwa|namaste|privet|merci|gracias|danke|obrigad[oa])\b|[Ѐ-ӿ֐-ۿऀ-ॿ぀-ヿ一-鿿가-힯]/i;
	const NOT_NAMES = new Set(['fine', 'good', 'ok', 'okay', 'tired', 'sad', 'happy', 'bored', 'here', 'back', 'done', 'sorry', 'busy', 'great', 'well', 'not', 'just', 'so', 'very', 'ready', 'hungry', 'stressed', 'angry', 'confused', 'lost', 'new', 'onyx', 'a', 'an', 'the', 'no', 'yes', 'cool', 'hi', 'hello', 'hey', 'yo', 'hiya', 'what', 'why', 'who', 'how', 'help', 'thanks', 'thank', 'nothing', 'none', 'nope', 'nah', 'idk', 'whatever', 'later', 'bye', 'test', 'nobody', 'me', 'you', 'i', 'my', 'is', 'are', 'can', 'do', 'tell', 'lol', 'haha', 'sure', 'maybe', 'please']);

	/** A name from "my name is Sam", "call me Sam", "I'm Sam" (capitalized), or a bare answer to "what should I call you?". */
	function nameFrom(raw, expecting) {
		const clean = (n) => n && n.replace(/[^A-Za-z'\- ]/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
		let m = raw.match(/\b(?:my name is|my name's|call me|i go by|you can call me|i am called|i'm called|name's)\s+([A-Za-z][A-Za-z'-]{0,30}(?:\s+[A-Za-z][A-Za-z'-]{0,30})?)/i);
		if (m && !NOT_NAMES.has(m[1].toLowerCase().split(' ')[0])) return clean(m[1]);
		m = raw.match(/^(?:hi,?\s+|hello,?\s+|hey,?\s+)?(?:i am|i'm|im)\s+([A-Z][a-z'-]{1,30})\s*[.!]?$/);
		if (m && !NOT_NAMES.has(m[1].toLowerCase())) return clean(m[1]);
		if (expecting && !/onyx/i.test(raw)) {
			m = raw.trim().match(/^(?:it's\s+|its\s+|just\s+)?([A-Za-z][A-Za-z'-]{0,30}(?:\s+[A-Za-z][A-Za-z'-]{0,30})?)[.!]?$/);
			if (m && !NOT_NAMES.has(m[1].toLowerCase().split(' ')[0])) return clean(m[1]);
		}
		return null;
	}

	/** "twelve times 7", "15% of 80", "5 plus 3" become something the scientific calculator reads. */
	function wordsToMath(text) {
		let t = ' ' + text.toLowerCase().replace(/\?+\s*$/, '') + ' ';
		if (!/\d/.test(t)) return null;
		t = t.replace(/^\s*(what is|whats|what's|calculate|compute|how much is|solve|work out|evaluate)\s+/, ' ');
		t = t.replace(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s+of\s+(\d+(?:\.\d+)?)/g, '($1/100*$2)');
		t = t.replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\b(times|multiplied by|x)\b/g, '*').replace(/\b(divided by|over)\b/g, '/');
		t = t.replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3').replace(/\bto the power of\b/g, '^').replace(/\bsquare root of\b/g, 'sqrt');
		t = t.trim();
		return /^[-+*/^().\d\s]+$|^sqrt[\s(]*[\d.]+\)?$/.test(t) && /[-+*/^]|sqrt/.test(t) ? t : null;
	}

	/** Small things Onyx does with words: count letters or words, reverse, spell, change case, numbers in words. */
	function wordTrick(text) {
		const q = (s) => s.trim().replace(/^["'“]|["'”.?!]$/g, '').trim();
		let m;
		if ((m = text.match(/^how many (?:letters|characters|chars) (?:are )?(?:in|does) (.+?)(?: have)?\??$/i))) {
			const w = q(m[1]);
			const letters = (w.match(/\p{L}/gu) || []).length;
			return `"${w}" has ${letters} letter${letters === 1 ? '' : 's'}${letters !== w.length ? ` (${w.length} characters with spaces and symbols)` : ''}.`;
		}
		if ((m = text.match(/^how many (?:times (?:does|is) )?(?:the letter )?["']?(\p{L})["']? (?:appear )?(?:are )?in (.+?)\??$/iu)) && !/^(times|words?)$/i.test(m[1])) {
			const n = (q(m[2]).toLowerCase().match(new RegExp(m[1].toLowerCase(), 'g')) || []).length;
			return `"${m[1]}" appears ${n} time${n === 1 ? '' : 's'} in "${q(m[2])}".`;
		}
		if ((m = text.match(/^(?:count|how many) (?:the )?words (?:are )?in (.+)$/i))) {
			const n = q(m[1]).split(/\s+/).filter(Boolean).length;
			return `That's ${n} word${n === 1 ? '' : 's'}.`;
		}
		if ((m = text.match(/^(?:reverse|say|spell|write) (.+?) backwards?$/i)) || (m = text.match(/^reverse (.+)$/i))) return `${[...q(m[1])].reverse().join('')}`;
		if ((m = text.match(/^(?:how do you )?spell (?:out )?(.+?)\??$/i)) && !/\d/.test(m[1])) return [...q(m[1]).toUpperCase()].filter((c) => c.trim()).join('-');
		if ((m = text.match(/^(?:uppercase|upper case|capitali[sz]e|make uppercase) (.+)$/i))) return q(m[1]).toUpperCase();
		if ((m = text.match(/^(?:lowercase|lower case|make lowercase) (.+)$/i))) return q(m[1]).toLowerCase();
		if ((m = text.match(/^(?:title case) (.+)$/i))) return q(m[1]).toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
		if ((m = text.match(/^(?:write|say|spell|how do you (?:write|say)) (-?[\d,]+) (?:in|as) words\??$/i)) || (m = text.match(/^(-?[\d,]+) in words\??$/i))) {
			const words = Omni.onyxMath && Omni.onyxMath.numberToWords(Number(m[1].replace(/,/g, '')));
			return words ? `${m[1]} is "${words}".` : 'That number is too big for me to write out.';
		}
		if ((m = text.match(/^is (.+?) a palindrome\??$/i))) {
			const w = q(m[1]).toLowerCase().replace(/[^\p{L}\d]/gu, '');
			return w === [...w].reverse().join('') ? `Yes, "${q(m[1])}" reads the same backwards.` : `No, "${q(m[1])}" backwards is "${[...q(m[1])].reverse().join('')}".`;
		}
		return null;
	}

	/* ---------- Deciding the reply ---------- */

	const answer = (text, extra) => Object.assign({ text }, extra || {});
	const asksMeaning = /^(?:what(?: is| are| does)|whats|define|definition of|explain|meaning of|tell me about|what do you mean by|whats an?)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+mean|\s+stand for)?\s*[?.!]*$/i;

	function glossary(term) {
		const t = term.toLowerCase().replace(/[?.!]/g, '').replace(/^(?:an?|the)\s+/, '').trim();
		const hit = Omni.onyxData.GLOSSARY.find((g) => g.terms.includes(t) || g.terms.includes(t.replace(/s$/, '')));
		if (!hit) return null;
		const text = typeof hit.text === 'function' ? hit.text() : hit.text;
		convo.lastKind = null;
		if (hit.tool && Omni.byId[hit.tool]) return answer(`${text}\n\n${Omni.onyxData.toolLink(hit.tool)} works with it.`, { offer: { kind: 'open', id: hit.tool, ask: 'Want me to open it?' } });
		if (hit.tool) return answer(`${text}\n\nThe tool for it is in the desktop edition.`);
		return answer(text);
	}

	/** What to do with an affirmative answer to an offer. */
	async function accept(offer) {
		if (offer.kind === 'open') return answer(`Opening ${Omni.onyxData.toolLink(offer.id)}.`, { action: 'open:' + offer.id });
		if (offer.kind === 'settings') return answer('Opening Settings.', { action: 'settings' });
		if (offer.kind === 'forget') {
			Omni.store.remove(MEMORY_KEY);
			return answer('Done. I\'ve forgotten your name and everything you asked me to keep.');
		}
		if (offer.kind === 'games') {
			const games = ['game-2048', 'minesweeper', 'snake', 'typing-test'].filter((id) => Omni.byId[id]);
			const id = games[Math.floor(Math.random() * games.length)];
			return answer(`Let's go with ${Omni.onyxData.toolLink(id)}.`, { action: 'open:' + id });
		}
		if (offer.kind === 'joke') return answer(draw('joke', Omni.onyxData.JOKES));
		if (offer.kind === 'command') {
			convo.lastCommand = offer.command;
			convo.lastKind = 'command';
			return answer('', { command: offer.command });
		}
		return answer('Okay.');
	}

	/**
	 * Decides Onyx's reply to one message. Returns { text, offer?, action?, command? }; `command` means the text should
	 * run through OmniTool's offline commands. Pure apart from memory writes, so tests can call it directly.
	 */
	async function respond(raw) {
		const r = await decide(raw);
		// The next message is read against this reply: its yes/no offer, or the name it asked for.
		if (r) {
			convo.pending = r.offer || null;
			convo.expect = r.expect || null;
			convo.lastReply = r.text + (r.offer ? `

${r.offer.ask}` : '');
		}
		return r;
	}

	async function decide(raw) {
		const text = String(raw || '').trim();
		if (!text) return null;
		const mem = memory();
		const norm = normalize(text);
		const pending = convo.pending;
		const expect = convo.expect;
		convo.pending = null;
		convo.expect = null;

		if (CRISIS.test(text)) {
			return answer('I\'m really sorry you\'re feeling this way. I\'m only a small program, so please talk to a person who can help right now: in the US you can call or text **988** (Suicide & Crisis Lifeline), and anywhere else your local emergency number or a line listed at **findahelpline.com** will reach someone. If you\'re in danger, call emergency services. You don\'t have to go through this alone.');
		}
		if (FOREIGN.test(norm) || FOREIGN.test(text)) return answer('I only understand English, sorry.');

		if (pending) {
			if (YES.test(text)) return accept(pending);
			if (NO.test(text)) return answer(pending.kind === 'forget' ? 'Okay, I\'ll keep it.' : 'Okay.');
		}

		const name = nameFrom(text, expect === 'name');
		if (name) {
			if (/^onyx$/i.test(name)) return answer('That\'s my name. What should I call you?', { expect: 'name' });
			saveMemory(Object.assign(mem, { name, met: mem.met || new Date().toISOString() }));
			return answer(mem.met && mem.name !== name ? `Got it, ${name}. I'll remember that on this device.` : `Nice to meet you, ${name}. I'll remember your name on this device.`);
		}

		const rem = text.match(/^(?:please\s+)?(?:can you\s+|could you\s+)?remember(?:\s+that)?\s+(.{3,200})$/i);
		if (rem) {
			const fact = rem[1].replace(/[.!]+$/, '').replace(/\bmy\b/gi, 'your').replace(/\bi am\b/gi, 'you are').replace(/\bi\b/g, 'you');
			mem.facts = [{ text: fact, at: new Date().toISOString() }, ...mem.facts].slice(0, 30);
			saveMemory(mem);
			return answer(`I'll remember: ${fact}.`);
		}

		// "Hi Onyx, what can you do?" gets a short greeting in front of the real answer.
		let greet = '';
		let body = text;
		const g = text.match(/^(hi|hello|hey|heya|hiya|yo|howdy|good (?:morning|afternoon|evening))(?:\s+there)?(?:\s+onyx)?[\s,!.]+(.+)$/i);
		if (g && g[2].trim().length > 1 && !/^(onyx|you|there)[\s!.?]*$/i.test(g[2].trim())) {
			greet = `${g[1][0].toUpperCase()}${g[1].slice(1).toLowerCase()}${mem.name ? ', ' + mem.name : ''}. `;
			body = g[2];
		}
		const withGreet = (r) => (r && greet ? Object.assign({}, r, { text: greet + r.text }) : r);

		const decision = /^(?:should i|shall i|do i)\s+(.+?)\s+or\s+(.+?)\??$/i.exec(body) || /^(?:pick|choose)(?: one)?(?: between|:)?\s+(.+?)\s+(?:or|and)\s+(.+?)\??$/i.exec(body);
		if (decision) {
			const options = [decision[1], ...decision[2].split(/,\s*|\s+or\s+/)].map((s) => s.trim()).filter(Boolean);
			const choice = options[Math.floor(Math.random() * options.length)];
			return withGreet(answer(`Go with **${choice}**. I picked at random, so if your stomach disagrees, listen to it.`));
		}
		const word = wordTrick(body);
		if (word) return withGreet(answer(word));
		// Arithmetic is answered directly, and the answer is kept so "times 3" or "that squared" can follow.
		const sum = Omni.onyxMath && Omni.onyxMath.answer(body, convo.lastAnswer);
		if (sum) {
			if (sum.value != null) convo.lastAnswer = sum.value;
			convo.lastKind = null;
			return withGreet(answer(sum.text));
		}
		const pickNum = body.match(/\bpick (?:a|one) number (?:between|from) (-?\d+) (?:and|to) (-?\d+)/i);
		const math = wordsToMath(body);
		const commandText = pickNum ? `random number between ${pickNum[1]} and ${pickNum[2]}` : math || body;
		if (Omni.offline.plan(commandText)) {
			convo.lastCommand = commandText;
			convo.lastKind = 'command';
			return withGreet(answer('', { command: commandText }));
		}

		const ranked = classify(body);
		const top = ranked[0] || { id: null, score: 0 };
		const meaning = body.match(asksMeaning);
		if (meaning && !(top.score > 0.75 && ['identity', 'omnitool', 'meaning', 'date', 'time', 'weather', 'news'].includes(top.id))) {
			const gl = glossary(meaning[1]);
			if (gl) return withGreet(gl);
		}
		if (top.score >= 0.5 || (top.score >= 0.38 && top.score - ((ranked[1] && ranked[1].score) || 0) >= 0.12)) {
			const intent = Omni.onyxData.INTENTS.find((i) => i.id === top.id);
			const ctx = {
				text: normalize(body), raw: body, mem, part: part(), tools: Omni.tools.length, hasKey: (await Omni.ai.mode()) === 'claude',
				last: convo.lastIntent, lastKind: convo.lastKind, lastReply: convo.lastReply, why: convo.why, mayAskName: !convo.askedName,
				pick, draw,
				again: () => {
					if (convo.lastKind === 'command' && convo.lastCommand) return { text: '', command: convo.lastCommand };
					if (['joke', 'tip', 'fact'].includes(convo.lastKind)) return draw(convo.lastKind, Omni.onyxData[{ joke: 'JOKES', tip: 'TIPS', fact: 'FACTS' }[convo.lastKind]]);
					return 'Another what? I can do jokes, tips, facts, or repeat the last command.';
				},
			};
			let r = typeof intent.reply === 'function' ? intent.reply(ctx) : pick(intent.id, intent.reply);
			if (typeof r === 'string') r = answer(r);
			if (!['again', 'repeat', 'why', 'ack'].includes(intent.id) && !['joke', 'tip', 'fact'].includes(intent.id)) convo.lastKind = null;
			convo.lastIntent = intent.id;
			if (r.expect === 'name') convo.askedName = true;
			r.text = fill(r.text, mem);
			return withGreet(r);
		}
		if (meaning) {
			const gl = glossary(meaning[1]);
			if (gl) return withGreet(gl);
		}

		const found = /^(who|when|where|why)\b/i.test(body.trim()) ? [] : findTools(body);
		if (found.length) {
			const [first, second] = found;
			const more = second && second.score > first.score * 0.6 ? ` ${Omni.onyxData.toolLink(second.tool.id)} is close too.` : '';
			return withGreet(answer(`That sounds like ${Omni.onyxData.toolLink(first.tool.id)}: ${first.tool.description}${more}`, { offer: { kind: 'open', id: first.tool.id, ask: 'Want me to open it?' } }));
		}

		convo.misses++;
		if (/^(who|what|when|where|why|how|which|is|are|does|do|did|can|could|will|would)\b/i.test(body) || /\?\s*$/.test(body)) {
			return withGreet(answer(pick('dunno', [
				'I don\'t know that one. I only know about OmniTool and a few small things, and I can\'t look anything up.',
				'That\'s outside what I know. I\'m a small local assistant: no internet, no encyclopedia.',
				'No idea, honestly. Ask me about OmniTool, or tell me what you\'re trying to do and I\'ll find a tool.',
			]) + (convo.misses > 1 ? ' Type **help** to see what I can do.' : '')));
		}
		return withGreet(answer(pick('miss', [
			'I didn\'t catch that. Try rephrasing, or type **help** to see what I can do.',
			'I\'m not sure what you mean. You can ask me things like "what is a JWT" or "I need to convert a timestamp".',
			'That one went past me. Type **help** for the things I understand.',
		])));
	}

	/* ---------- Talking in the agent panel ---------- */

	async function say(turn, text) {
		if (!text) return;
		// Short replies appear word by word over at most half a second; reduced motion shows them at once.
		const parts = text.split(/(\s+)/);
		if (Omni.motion && Omni.motion.ok() && parts.length > 2) {
			const chunk = Math.max(2, Math.ceil(parts.length / 18));
			for (let i = 0; i < parts.length; i += chunk) {
				turn.text(parts.slice(i, i + chunk).join(''));
				await new Promise((r) => setTimeout(r, 22));
			}
		} else turn.text(text);
		await turn.endText();
	}

	async function act(action, api) {
		if (!action) return;
		if (action === 'new-chat') return setTimeout(() => api.newChat(), 600);
		if (action.startsWith('theme:')) return Omni.setTheme(action.slice(6));
		if (action.startsWith('open:')) return Omni.open(action.slice(5));
		if (action === 'settings') return (location.hash = '#/settings');
		if (action.startsWith('engine:')) return Omni.store.set('agent.engine', action.slice(7));
	}

	/** Answers one message in the agent panel: words, steps for commands, and a yes/no offer when there is one. */
	async function handle(text, api) {
		const turn = api.addTurn('Onyx');
		let r = await respond(text);
		if (!r) return;
		if (r.command) {
			const reply = await Omni.offline.run(Omni.offline.plan(r.command), api, turn);
			r = Object.assign({}, r, { text: [r.text, reply].filter(Boolean).join('\n\n') });
		}
		const offer = r.offer ? `\n\n${r.offer.ask}` : '';
		await say(turn, r.text + offer);
		convo.lastReply = r.text + offer;
		convo.misses = r.text && !/didn't catch|not sure what you mean|went past me/.test(r.text) ? 0 : convo.misses;
		await act(r.action, api);
	}

	Omni.onyx = {
		respond,
		handle,
		classify: (text) => classify(text),
		findTools,
		normalize,
		memory,
		reset: () => {
			convo = fresh();
			Omni.offline.reset();
		},
	};
})();
