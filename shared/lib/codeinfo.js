// Offline code analysis for the AI tools' limited mode: outlines, common-mistake checks, doc and test skeletons,
// commit messages from diffs, extractive summaries and regex inference. Heuristics, labeled as such in the UI.
(function () {
	'use strict';

	function detect(code, hint) {
		if (hint && hint !== 'auto') return hint;
		const c = code.slice(0, 20000);
		if (/^\s*[[{]/.test(c) && (() => { try { JSON.parse(c); return true; } catch { return false; } })()) return 'json';
		if (/^\s*<(!doctype|html|div|body|head|section|svg|\?xml)/i.test(c)) return /^\s*<\?xml|<svg/i.test(c) ? 'xml' : 'html';
		if (/^\s*(def |class \w+.*:|from \w[\w.]* import |import \w+\s*$|if __name__ ==)/m.test(c) && !/[{};]\s*$/m.test(c.split('\n').slice(0, 30).join('\n'))) return 'python';
		if (/\b(interface \w+|type \w+ =|: (string|number|boolean)\b|<\w+>\(|enum \w+)/.test(c)) return 'typescript';
		if (/\b(function|const|let|var|=>|require\(|import .* from|export (default|const|function))\b/.test(c)) return 'javascript';
		if (/^\s*(select|insert|update|delete|create table|with)\b/im.test(c)) return 'sql';
		if (/^[^{}\n]+\{[^}]*:[^}]*;?\s*\}/m.test(c) && !/\bfunction\b/.test(c)) return 'css';
		if (/\b(public|private) (static )?(class|void|int)\b/.test(c)) return /\bnamespace\b|\busing System/.test(c) ? 'csharp' : 'java';
		if (/#include\s*</.test(c)) return 'c';
		return 'text';
	}

	const isPy = (lang) => lang === 'python';
	const isJs = (lang) => lang === 'javascript' || lang === 'typescript';

	/** Same-length copy of code with string contents and comments blanked, so regexes only see code. */
	function mask(code, lang) {
		const out = code.split('');
		const blank = (from, to) => {
			for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
		};
		let i = 0;
		while (i < code.length) {
			const c = code[i];
			const two = code.slice(i, i + 2);
			if (!isPy(lang) && two === '//') {
				const end = code.indexOf('\n', i);
				blank(i, end === -1 ? code.length : end);
				i = end === -1 ? code.length : end;
			} else if (!isPy(lang) && two === '/*') {
				const end = code.indexOf('*/', i + 2);
				blank(i, end === -1 ? code.length : end + 2);
				i = end === -1 ? code.length : end + 2;
			} else if (isPy(lang) && c === '#') {
				const end = code.indexOf('\n', i);
				blank(i, end === -1 ? code.length : end);
				i = end === -1 ? code.length : end;
			} else if (isPy(lang) && (code.startsWith('"""', i) || code.startsWith("'''", i))) {
				const q = code.slice(i, i + 3);
				const end = code.indexOf(q, i + 3);
				blank(i + 3, end === -1 ? code.length : end);
				i = end === -1 ? code.length : end + 3;
			} else if (c === '"' || c === "'" || c === '`') {
				let j = i + 1;
				while (j < code.length && code[j] !== c) {
					if (code[j] === '\\') j++;
					if (code[j] === '\n' && c !== '`') break;
					j++;
				}
				blank(i + 1, j);
				i = j + 1;
			} else i++;
		}
		return out.join('');
	}

	const lineOf = (code, index) => code.slice(0, index).split('\n').length;

	/** End index of the block that starts at `open` (a "{"), counting braces in masked code. */
	function braceEnd(masked, open) {
		let depth = 0;
		for (let i = open; i < masked.length; i++) {
			if (masked[i] === '{') depth++;
			else if (masked[i] === '}' && --depth === 0) return i;
		}
		return masked.length - 1;
	}

	function pyBlockEnd(lines, startLine) {
		const indent = (l) => l.match(/^\s*/)[0].length;
		const base = indent(lines[startLine]);
		let end = startLine;
		for (let k = startLine + 1; k < lines.length; k++) {
			if (!lines[k].trim()) continue;
			if (indent(lines[k]) <= base) break;
			end = k;
		}
		return end;
	}

	const BRANCH = /\b(if|for|while|case|catch|elif|except|and|or)\b|&&|\|\||\?(?!\.)/g;

	/** Functions, classes, imports and per-function complexity. */
	function outline(code, langHint) {
		const lang = detect(code, langHint);
		const masked = mask(code, lang);
		const lines = code.split('\n');
		const out = { lang, lines: lines.length, blank: 0, comment: 0, imports: [], functions: [], classes: [], todos: [] };
		lines.forEach((l, i) => {
			const t = l.trim();
			if (!t) out.blank++;
			else if (/^(\/\/|#|\/\*|\*|--|<!--)/.test(t)) out.comment++;
			const todo = l.match(/\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/);
			if (todo) out.todos.push({ line: i + 1, text: `${todo[1]}: ${todo[2].trim()}`.trim() });
		});
		if (isPy(lang)) {
			const mlines = masked.split('\n');
			mlines.forEach((l, i) => {
				let m;
				if ((m = l.match(/^\s*(?:from\s+([\w.]+)\s+)?import\s+([\w., ]+)/))) out.imports.push(m[1] || m[2].trim());
				if ((m = l.match(/^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/))) {
					const end = pyBlockEnd(mlines, i);
					const body = mlines.slice(i, end + 1).join('\n');
					out.functions.push({ name: m[2], params: m[3].split(',').map((p) => p.trim()).filter(Boolean), line: i + 1, length: end - i + 1, complexity: 1 + (body.match(BRANCH) || []).length, method: m[1].length > 0 });
				}
				if ((m = l.match(/^\s*class\s+(\w+)/))) out.classes.push({ name: m[1], line: i + 1 });
			});
		} else if (isJs(lang) || ['java', 'csharp', 'c'].includes(lang)) {
			let m;
			const imp = /(?:import\s+[^'"]*?from\s+|import\s+|require\(\s*)['"]([^'"]+)['"]/g;
			while ((m = imp.exec(code))) out.imports.push(m[1]);
			const patterns = [
				/(?:^|[^.\w])(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(([^)]*)\)/g,
				/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\s*\w*\s*)?\(([^)]*)\)\s*(?:=>|\{)/g,
				/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(\w+)\s*=>/g,
				/^\s*(?:(?:public|private|protected|static|async|override|get|set)\s+)*(?!if\b|for\b|while\b|switch\b|catch\b|return\b|function\b)(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>[\]|, ]+)?\s*\{/gm,
			];
			const seen = new Set();
			for (const re of patterns) {
				while ((m = re.exec(masked))) {
					const at = m.index + m[0].indexOf(m[1]);
					if (seen.has(at) || ['if', 'for', 'while', 'switch', 'catch'].includes(m[1])) continue;
					seen.add(at);
					const open = masked.indexOf('{', m.index + m[0].length - 1);
					const arrowExpr = !m[0].includes('{') && open - (m.index + m[0].length) > 3;
					const end = open === -1 || arrowExpr ? m.index + m[0].length : braceEnd(masked, open);
					const body = masked.slice(m.index, end + 1);
					out.functions.push({ name: m[1], params: (m[2] || '').split(',').map((p) => p.trim()).filter(Boolean), line: lineOf(code, at), length: lineOf(code, end) - lineOf(code, at) + 1, complexity: 1 + (body.match(BRANCH) || []).length, method: re === patterns[3] });
				}
			}
			out.functions.sort((a, b) => a.line - b.line);
			const cls = /\bclass\s+(\w+)/g;
			while ((m = cls.exec(masked))) out.classes.push({ name: m[1], line: lineOf(code, m.index) });
		}
		out.code = out.lines - out.blank - out.comment;
		return out;
	}

	function explain(code, langHint) {
		const o = outline(code, langHint);
		const parts = [`Language: ${o.lang}. ${o.lines} lines (${o.code} code, ${o.comment} comment, ${o.blank} blank).`];
		if (o.imports.length) parts.push(`Depends on: ${[...new Set(o.imports)].slice(0, 20).join(', ')}.`);
		if (o.classes.length) parts.push(`Classes: ${o.classes.map((c) => `${c.name} (line ${c.line})`).join(', ')}.`);
		if (o.functions.length) {
			parts.push(`Functions (${o.functions.length}):`);
			o.functions.slice(0, 40).forEach((f) => parts.push(`- ${f.name}(${f.params.join(', ')}) at line ${f.line}, ${f.length} lines, ${f.complexity > 10 ? 'many branches' : f.complexity > 4 ? 'some branches' : 'straight-line'} (complexity ${f.complexity})`));
			const hardest = o.functions.slice().sort((a, b) => b.complexity - a.complexity)[0];
			if (hardest && hardest.complexity > 4) parts.push(`Start reading at ${hardest.name} (line ${hardest.line}): it has the most decision points.`);
		} else parts.push('No function definitions found; the code runs top to bottom.');
		if (o.todos.length) parts.push(`Open markers: ${o.todos.map((t) => `line ${t.line} ${t.text}`).join('; ')}.`);
		return { outline: o, text: parts.join('\n') };
	}

	/** Common-mistake checks by regex on masked code (strings and comments ignored). */
	function findIssues(code, langHint) {
		const lang = detect(code, langHint);
		const masked = mask(code, lang);
		const mlines = masked.split('\n');
		const lines = code.split('\n');
		const issues = [];
		const add = (line, severity, message) => issues.push({ line, severity, message });
		const rules = isJs(lang)
			? [
				[/[^=!<>]==[^=]|!=[^=]/, 'warning', 'Loose equality (== or !=) converts types; use === or !==.'],
				[/\b(if|while)\s*\([^()]*[^=!<>]=[^=][^()]*\)/, 'error', 'Assignment inside a condition; did you mean === ?'],
				[/\bparseInt\s*\([^,()]*\)/, 'warning', 'parseInt without a radix; pass 10 to avoid surprises.'],
				[/\bdebugger\b/, 'error', 'debugger statement left in.'],
				[/\bconsole\.(log|debug)\s*\(/, 'info', 'console.log left in.'],
				[/catch\s*\([^)]*\)\s*\{\s*\}/, 'warning', 'Empty catch block swallows the error.'],
				[/\beval\s*\(/, 'error', 'eval runs arbitrary code; avoid it.'],
				[/\bvar\s+/, 'info', 'var is function-scoped; prefer let or const.'],
				[/===?\s*NaN\b|NaN\s*===?/, 'error', 'Nothing equals NaN; use Number.isNaN().'],
				[/\bfor\s*\(\s*(const|let|var)\s+\w+\s+in\s+/, 'warning', 'for...in walks keys, including inherited ones; for arrays use for...of.'],
				[/\.forEach\(\s*async\b/, 'warning', 'forEach does not wait for async callbacks; use for...of with await.'],
				[/\bnew\s+Array\(\s*\d+\s*\)\.map\b/, 'warning', 'new Array(n).map skips empty slots; use Array.from({ length: n }, fn).'],
				[/typeof\s+[\w.]+\s*===?\s*['"]?\s*(undefind|undefned|fuction|funtion|stirng|numbr)/, 'error', 'Misspelled typeof result.'],
			]
			: isPy(lang)
				? [
					[/^\s*except\s*:/, 'warning', 'Bare except catches everything, including KeyboardInterrupt.'],
					[/def\s+\w+\s*\([^)]*=\s*(\[\]|\{\}|set\(\))/, 'error', 'Mutable default argument is shared between calls; default to None.'],
					[/\bis\s+(not\s+)?(\d+|['"])/, 'error', '"is" compares identity, not value; use == for numbers and strings.'],
					[/[=!]=\s*None\b/, 'warning', 'Compare with None using "is None" or "is not None".'],
					[/^\s*print\s*\(/, 'info', 'print() left in; consider logging.'],
					[/except\s+\w*\s*(as\s+\w+)?\s*:\s*pass\b|except.*:\s*$\s*pass/, 'warning', 'Exception silently ignored.'],
					[/\bassert\s*\(.+,.+\)\s*$/, 'error', 'assert with a tuple is always true; drop the parentheses.'],
					[/\beval\s*\(|\bexec\s*\(/, 'error', 'eval/exec runs arbitrary code.'],
					[/open\s*\([^)]*\)(?!\s*as)/, 'info', 'open() outside a with block may leave the file open.'],
				]
				: [];
		mlines.forEach((l, i) => {
			for (const [re, severity, message] of rules) if (re.test(l)) add(i + 1, severity, message);
		});
		lines.forEach((l, i) => {
			if (/\b(TODO|FIXME|HACK)\b/.test(l)) add(i + 1, 'info', `Marker: ${l.trim().slice(0, 100)}`);
			if (l.length > 160) add(i + 1, 'info', `Line is ${l.length} characters long.`);
		});
		const indents = lines.map((l) => l.match(/^[ \t]*/)[0]);
		if (indents.some((x) => x.includes('\t')) && indents.some((x) => / {2}/.test(x))) add(1, 'warning', 'Mixed tabs and spaces for indentation.');
		const o = outline(code, lang);
		o.functions.filter((f) => f.length > 80).forEach((f) => add(f.line, 'info', `${f.name} is ${f.length} lines long; consider splitting it.`));
		o.functions.filter((f) => f.complexity > 15).forEach((f) => add(f.line, 'warning', `${f.name} has ${f.complexity} decision points; it is hard to test.`));
		return { lang, issues: issues.sort((a, b) => a.line - b.line) };
	}

	/** Inserts JSDoc or docstring skeletons above functions that lack one. */
	function docSkeletons(code, langHint) {
		const lang = detect(code, langHint);
		const o = outline(code, lang);
		const lines = code.split('\n');
		let added = 0;
		const fns = o.functions.slice().sort((a, b) => b.line - a.line);
		for (const f of fns) {
			const idx = f.line - 1;
			const indent = lines[idx].match(/^\s*/)[0];
			const clean = (p) => p.replace(/[:=].*$/, '').replace(/^\.\.\.|[*?]/g, '').trim();
			if (isPy(lang)) {
				const next = (lines[idx + 1] || '').trim();
				if (/^("""|''')/.test(next)) continue;
				const inner = indent + '    ';
				const params = f.params.map(clean).filter((p) => p && p !== 'self' && p !== 'cls');
				const doc = [`${inner}"""${humanize(f.name)}.`, ''];
				if (params.length) doc.push(`${inner}Args:`, ...params.map((p) => `${inner}    ${p}: Describe ${p}.`), '');
				doc.push(`${inner}Returns:`, `${inner}    Describe the return value.`, `${inner}"""`);
				let at = idx + 1;
				while (at < lines.length && !/:\s*$/.test(lines[at - 1])) at++;
				lines.splice(at, 0, ...doc);
				added++;
			} else {
				const prev = (lines[idx - 1] || '').trim();
				if (prev.endsWith('*/')) continue;
				const params = f.params.map(clean).filter(Boolean);
				const doc = [`${indent}/**`, `${indent} * ${humanize(f.name)}.`, ...params.map((p) => `${indent} * @param {*} ${p.replace(/[{}[\]]/g, '') || 'options'} Describe ${p}.`), `${indent} * @returns {*} Describe the return value.`, `${indent} */`];
				lines.splice(idx, 0, ...doc);
				added++;
			}
		}
		return { lang, added, code: lines.join('\n') };
	}

	function humanize(name) {
		const words = name.replace(/^_+/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
		return words.charAt(0).toUpperCase() + words.slice(1);
	}

	function testSkeletons(code, langHint, moduleName) {
		const lang = detect(code, langHint);
		const o = outline(code, lang);
		const fns = o.functions.filter((f) => !f.method && !f.name.startsWith('_'));
		if (!fns.length) return { lang, count: 0, code: '' };
		if (isPy(lang)) {
			const mod = (moduleName || 'module').replace(/\.py$/, '');
			return {
				lang,
				count: fns.length,
				code: [`import pytest`, `from ${mod} import ${fns.map((f) => f.name).join(', ')}`, '', ...fns.flatMap((f) => [
					`def test_${f.name}_typical_input():`,
					`    # Arrange: values for ${f.params.filter((p) => p !== 'self').join(', ') || 'no arguments'}`,
					`    result = ${f.name}(${f.params.filter((p) => p !== 'self').map(() => '...').join(', ')})`,
					`    assert result == ...  # expected value`,
					'',
					`def test_${f.name}_edge_case():`,
					`    with pytest.raises(Exception):`,
					`        ${f.name}(${f.params.filter((p) => p !== 'self').map(() => 'None').join(', ')})`,
					'',
				])].join('\n'),
			};
		}
		const mod = (moduleName || './module').replace(/\.(m?js|ts)$/, '');
		return {
			lang,
			count: fns.length,
			code: [`import { describe, it, expect } from 'vitest';`, `import { ${fns.map((f) => f.name).join(', ')} } from '${mod.startsWith('.') ? mod : './' + mod}';`, '', ...fns.flatMap((f) => [
				`describe('${f.name}', () => {`,
				`  it('returns the expected value for a typical input', () => {`,
				`    expect(${f.name}(${f.params.map(() => 'undefined').join(', ')})).toEqual(undefined); // replace inputs and expected value`,
				`  });`,
				'',
				`  it('handles an edge case', () => {`,
				`    // empty input, zero, a very large value, or invalid types`,
				`  });`,
				`});`,
				'',
			])].join('\n'),
		};
	}

	/** Conventional Commits message from a unified diff, based on which files changed and how. */
	function commitFromDiff(diff) {
		const files = [];
		let cur = null;
		for (const line of diff.split('\n')) {
			const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/) || line.match(/^\+\+\+ b\/(.+)$/);
			if (line.startsWith('diff --git') && m) {
				cur = { path: m[2], add: 0, del: 0, isNew: false, isDeleted: false };
				files.push(cur);
			} else if (!cur && line.startsWith('+++ ') && m) {
				cur = { path: m[1], add: 0, del: 0, isNew: false, isDeleted: false };
				files.push(cur);
			} else if (cur) {
				if (/^new file mode/.test(line) || line === '--- /dev/null') cur.isNew = true;
				else if (/^deleted file mode/.test(line) || line === '+++ /dev/null') cur.isDeleted = true;
				else if (line.startsWith('+') && !line.startsWith('+++')) cur.add++;
				else if (line.startsWith('-') && !line.startsWith('---')) cur.del++;
			}
		}
		if (!files.length) throw new Error('No files found. Paste the output of git diff (or git diff --staged).');
		const all = (re) => files.every((f) => re.test(f.path));
		const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
		let type = 'chore';
		if (all(/\.(md|mdx|txt|rst)$|(^|\/)docs?\//i)) type = 'docs';
		else if (all(/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.\w+$/i)) type = 'test';
		else if (all(/^\.github\/workflows\/|\.gitlab-ci|azure-pipelines/)) type = 'ci';
		else if (all(/(package(-lock)?\.json|yarn\.lock|pnpm-lock|requirements\.txt|pyproject\.toml|Cargo\.(toml|lock)|\.gitignore|\.editorconfig)$/)) type = 'build';
		else if (files.some((f) => f.isNew) || /\b(function|def|class|export)\b/.test(added)) type = 'feat';
		if (/\b(fix|bug|crash|error|wrong|null|undefined|typo)\b/i.test(added) && type !== 'docs') type = 'fix';
		const dirs = files.map((f) => f.path.split('/').slice(0, -1));
		let scope = '';
		if (dirs.every((d) => d.length && d[0] === dirs[0][0])) scope = dirs[0][dirs[0].length > 1 && dirs.every((d) => d[1] === dirs[0][1]) ? 1 : 0];
		const names = files.map((f) => f.path.split('/').pop());
		const verb = files.every((f) => f.isNew) ? 'add' : files.every((f) => f.isDeleted) ? 'remove' : type === 'fix' ? 'fix' : 'update';
		const subject = `${verb} ${names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} other files`}`;
		const body = files.map((f) => `- ${f.path}: ${f.isNew ? 'new, ' : f.isDeleted ? 'deleted, ' : ''}+${f.add} -${f.del}`);
		return { type, scope, subject, message: `${type}${scope ? `(${scope})` : ''}: ${subject}\n\n${body.join('\n')}`, files };
	}

	const STOP = new Set('a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its just may might more most no not of on or our she so some such than that the their them then there these they this to too us was we were what when which who will with would you your'.split(' '));

	/** Extractive summary: the n highest-scoring sentences, kept in their original order. */
	function summarize(text, n) {
		const sentences = (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map((s) => s.trim()).filter((s) => s.split(' ').length > 2);
		if (sentences.length <= n) return { sentences, picked: sentences };
		const freq = {};
		for (const w of text.toLowerCase().match(/[a-z']+/g) || []) if (!STOP.has(w) && w.length > 2) freq[w] = (freq[w] || 0) + 1;
		const max = Math.max(1, ...Object.values(freq));
		const scored = sentences.map((s, i) => {
			const ws = (s.toLowerCase().match(/[a-z']+/g) || []).filter((w) => !STOP.has(w));
			const score = ws.reduce((a, w) => a + (freq[w] || 0) / max, 0) / Math.sqrt(Math.max(4, ws.length)) + (i === 0 ? 0.3 : 0);
			return { s, i, score };
		});
		const picked = scored.slice().sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
		return { sentences, picked };
	}

	const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
	function classOf(ch) {
		if (/\d/.test(ch)) return 'd';
		if (/[a-z]/.test(ch)) return 'l';
		if (/[A-Z]/.test(ch)) return 'u';
		if (/\s/.test(ch)) return 's';
		return 'p:' + ch;
	}
	const CLASS_RE = { d: '\\d', l: '[a-z]', u: '[A-Z]', s: '\\s', a: '[A-Za-z]', w: '\\w' };

	/** Runs of one character class: "AB-12" -> [{c:'u',n:2},{c:'p:-',n:1},{c:'d',n:2}]. */
	function runs(s) {
		const out = [];
		for (const ch of s) {
			const c = classOf(ch);
			const last = out[out.length - 1];
			if (last && last.c === c) last.n++;
			else out.push({ c, n: 1 });
		}
		return out;
	}

	/** Infers a regex from positive examples (and checks it against negatives). */
	function regexFromExamples(positives, negatives) {
		const pos = positives.filter(Boolean);
		if (!pos.length) throw new Error('Give at least one example that should match.');
		let shapes = pos.map(runs);
		// Letters of mixed case collapse to one class when examples disagree on case.
		const sameShape = (sh) => sh.every((s) => s.length === sh[0].length && s.every((r, i) => r.c === sh[0][i].c || (/^[lu]$/.test(r.c) && /^[lu]$/.test(sh[0][i].c))));
		let pattern;
		if (sameShape(shapes)) {
			pattern = shapes[0]
				.map((r, i) => {
					const ns = shapes.map((s) => s[i].n);
					const cs = new Set(shapes.map((s) => s[i].c));
					const lo = Math.min(...ns);
					const hi = Math.max(...ns);
					const cls = r.c.startsWith('p:') ? esc(r.c.slice(2)) : CLASS_RE[cs.size > 1 ? 'a' : r.c];
					const q = lo === hi ? (lo === 1 ? '' : `{${lo}}`) : hi - lo > 6 ? '+' : `{${lo},${hi}}`;
					return r.c.startsWith('p:') && lo === hi ? esc(r.c.slice(2).repeat(lo)) : cls + q;
				})
				.join('');
		} else {
			pattern = pos.map(esc).join('|');
			pattern = pos.length > 1 ? `(?:${pattern})` : pattern;
		}
		const re = new RegExp(`^${pattern}$`);
		const misses = pos.filter((p) => !re.test(p));
		const falseHits = (negatives || []).filter((n) => n && re.test(n));
		return { pattern: `^${pattern}$`, misses, falseHits };
	}

	/** Offline refactors on identifiers outside strings and comments. */
	function refactor(code, langHint, ops) {
		const lang = detect(code, langHint);
		let out = code;
		const notes = [];
		if (ops.rename && ops.rename.from && ops.rename.to) {
			const masked = mask(out, lang);
			const re = new RegExp(`(?<![\\w$.])${esc(ops.rename.from)}(?![\\w$])`, 'g');
			let m;
			const hits = [];
			while ((m = re.exec(masked))) hits.push(m.index);
			for (const at of hits.reverse()) out = out.slice(0, at) + ops.rename.to + out.slice(at + ops.rename.from.length);
			notes.push(`Renamed ${hits.length} use${hits.length === 1 ? '' : 's'} of ${ops.rename.from} to ${ops.rename.to} (strings and comments untouched).`);
		}
		if (ops.varToLet && isJs(lang)) {
			const masked = mask(out, lang);
			let count = 0;
			out = out.replace(/\bvar\s+(\w+)/g, (all, name, offset) => {
				if (masked.slice(offset, offset + 3) !== 'var') return all;
				const rest = masked.slice(offset + all.length);
				const reassigned = new RegExp(`(?<![\\w$.])${esc(name)}\\s*(=(?!=)|\\+\\+|--|[-+*/%&|^]=)`).test(rest) || new RegExp(`(\\+\\+|--)${esc(name)}\\b`).test(rest);
				count++;
				return `${reassigned ? 'let' : 'const'} ${name}`;
			});
			notes.push(`Changed ${count} var declaration${count === 1 ? '' : 's'} to const or let.`);
		}
		if (ops.removeConsole) {
			const before = out.split('\n').length;
			out = out.split('\n').filter((l) => !/^\s*console\.(log|debug|info)\s*\(.*\);?\s*$/.test(l) && !/^\s*print\s*\(.*\)\s*$/.test(isPy(lang) ? l : '')).join('\n');
			notes.push(`Removed ${before - out.split('\n').length} logging line${before - out.split('\n').length === 1 ? '' : 's'}.`);
		}
		return { lang, code: out, notes };
	}

	Omni.codeinfo = { detect, mask, outline, explain, findIssues, docSkeletons, testSkeletons, commitFromDiff, summarize, regexFromExamples, refactor, humanize };
})();
