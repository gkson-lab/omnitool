// Fuzzy matching for the command palette and the home search: subsequence matches that favor word starts and runs.
(function () {
	'use strict';

	/** Returns { score, indices } when every query character appears in order in text, else null. */
	function match(query, text) {
		const q = query.toLowerCase();
		const t = text.toLowerCase();
		if (!q) return { score: 0, indices: [] };
		// A contiguous hit is the strongest signal; check it before the subsequence walk.
		const direct = t.indexOf(q);
		if (direct !== -1) {
			const atWord = direct === 0 || /[\s\-_./(]/.test(t[direct - 1]);
			return { score: 100 + q.length * 6 + (atWord ? 30 : 0) - direct * 0.5 - (t.length - q.length) * 0.1, indices: range(direct, q.length) };
		}
		let score = 0;
		let ti = 0;
		let prev = -2;
		const indices = [];
		for (let qi = 0; qi < q.length; qi++) {
			const c = q[qi];
			if (c === ' ') continue;
			let found = -1;
			for (; ti < t.length; ti++) {
				if (t[ti] === c) {
					found = ti;
					break;
				}
			}
			if (found === -1) return null;
			const wordStart = found === 0 || /[\s\-_./(]/.test(t[found - 1]);
			score += 1 + (wordStart ? 8 : 0) + (found === prev + 1 ? 5 : 0) - Math.min(4, (found - prev - 1) * 0.15);
			indices.push(found);
			prev = found;
			ti = found + 1;
		}
		return { score, indices };
	}

	function range(start, n) {
		return Array.from({ length: n }, (_, i) => start + i);
	}

	/** Ranks tools for a query; a bare number like "44" or "044" finds that catalog number first. */
	function searchTools(query, tools) {
		const q = query.trim();
		if (!q) return tools.map((tool) => ({ tool, score: 0, indices: [] }));
		const results = [];
		const asNumber = /^(no\.?\s*)?\d{1,3}$/i.test(q) ? Number(q.replace(/\D/g, '')) : null;
		for (const tool of tools) {
			let best = null;
			const name = match(q, tool.name);
			if (name) best = { score: name.score * 1.2, indices: name.indices };
			for (const kw of tool.keywords) {
				const m = match(q, kw);
				if (m && (!best || m.score * 0.8 > best.score)) best = { score: m.score * 0.8, indices: [] };
			}
			const desc = tool.description && tool.description.toLowerCase().includes(q.toLowerCase());
			if (desc && (!best || best.score < 40)) best = { score: 40, indices: best ? best.indices : [] };
			if (asNumber !== null) {
				if (tool.no === asNumber) best = { score: 1000, indices: [] };
				else if (tool.code.startsWith(q.replace(/\D/g, ''))) best = best || { score: 20, indices: [] };
			}
			if (best) results.push({ tool, score: best.score, indices: best.indices });
		}
		return results.sort((a, b) => b.score - a.score || a.tool.no - b.tool.no);
	}

	/** Builds a DOM fragment of text with matched characters wrapped for emphasis. */
	function highlight(text, indices) {
		const frag = document.createDocumentFragment();
		const set = new Set(indices);
		let run = '';
		let inHit = false;
		const flush = () => {
			if (!run) return;
			frag.appendChild(inHit ? Omni.h('span', { class: 'hit' }, run) : document.createTextNode(run));
			run = '';
		};
		for (let i = 0; i < text.length; i++) {
			const hit = set.has(i);
			if (hit !== inHit) {
				flush();
				inHit = hit;
			}
			run += text[i];
		}
		flush();
		return frag;
	}

	Omni.fuzzy = { match, searchTools, highlight };
})();
