// No. 022 Semver checker: npm-style range matching (^, ~, x, hyphen, ||) and version bumps.
(function () {
	'use strict';
	const RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

	function parse(v) {
		const m = String(v).trim().match(RE);
		if (!m) return null;
		return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split('.') : [] };
	}
	function cmpPre(a, b) {
		if (!a.length && !b.length) return 0;
		if (!a.length) return 1;
		if (!b.length) return -1;
		for (let i = 0; i < Math.max(a.length, b.length); i++) {
			if (a[i] === undefined) return -1;
			if (b[i] === undefined) return 1;
			const na = /^\d+$/.test(a[i]);
			const nb = /^\d+$/.test(b[i]);
			if (na && nb && +a[i] !== +b[i]) return +a[i] - +b[i];
			if (na !== nb) return na ? -1 : 1;
			if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
		}
		return 0;
	}
	function cmp(a, b) {
		return a.major - b.major || a.minor - b.minor || a.patch - b.patch || cmpPre(a.pre, b.pre);
	}
	const fmt = (v) => `${v.major}.${v.minor}.${v.patch}${v.pre.length ? '-' + v.pre.join('.') : ''}`;

	/** Expands one comparator set ("^1.2.3", ">=1 <2") into [op, version] pairs. */
	function comparators(set) {
		const out = [];
		const hy = set.match(/^\s*(\S+)\s+-\s+(\S+)\s*$/);
		if (hy) return [...comparators('>=' + hy[1]), ...comparators('<=' + hy[2])];
		for (const tok of set.trim().split(/\s+/).filter(Boolean)) {
			const m = tok.match(/^(\^|~|>=|<=|>|<|=)?v?(\*|x|\d+)(?:\.(\*|x|\d+))?(?:\.(\*|x|\d+))?(?:-([0-9A-Za-z.-]+))?$/i);
			if (!m) throw new Error(`Cannot read "${tok}" in the range`);
			const op = m[1] || '';
			const wild = (x) => x === undefined || /^[*x]$/i.test(x);
			const [M, mi, p] = [m[2], m[3], m[4]];
			const pre = m[5] ? m[5].split('.') : [];
			const v = (a, b, c, pr) => ({ major: a, minor: b, patch: c, pre: pr || [] });
			if (wild(M)) {
				out.push(['>=', v(0, 0, 0)]);
				continue;
			}
			const maj = +M;
			if (wild(mi)) {
				if (op === '<') out.push(['<', v(maj, 0, 0)]);
				else if (op === '>') out.push(['>=', v(maj + 1, 0, 0)]);
				else out.push(['>=', v(maj, 0, 0)], ['<', v(maj + 1, 0, 0)]);
				continue;
			}
			const min = +mi;
			if (wild(p)) {
				if (op === '^' && maj === 0) out.push(['>=', v(0, min, 0)], ['<', v(0, min + 1, 0)]);
				else if (op === '^') out.push(['>=', v(maj, min, 0)], ['<', v(maj + 1, 0, 0)]);
				else if (op === '<') out.push(['<', v(maj, min, 0)]);
				else if (op === '>') out.push(['>=', v(maj, min + 1, 0)]);
				else out.push(['>=', v(maj, min, 0)], ['<', v(maj, min + 1, 0)]);
				continue;
			}
			const base = v(maj, min, +p, pre);
			if (op === '^') {
				const upper = maj > 0 ? v(maj + 1, 0, 0) : min > 0 ? v(0, min + 1, 0) : v(0, 0, +p + 1);
				out.push(['>=', base], ['<', upper]);
			} else if (op === '~') out.push(['>=', base], ['<', v(maj, min + 1, 0)]);
			else out.push([op || '=', base]);
		}
		return out;
	}

	function satisfies(version, range) {
		const v = parse(version);
		if (!v) return false;
		return range.split('||').some((set) => {
			const comps = comparators(set);
			const ok = comps.every(([op, c]) => {
				const r = cmp(v, c);
				return { '>=': r >= 0, '<=': r <= 0, '>': r > 0, '<': r < 0, '=': r === 0 }[op];
			});
			if (!ok) return false;
			// A prerelease only matches when some comparator in the set names the same major.minor.patch with a prerelease.
			if (v.pre.length) return comps.some(([, c]) => c.pre.length && c.major === v.major && c.minor === v.minor && c.patch === v.patch);
			return true;
		});
	}

	Omni.semver = { parse, cmp, satisfies, fmt };

	Omni.register({
		no: 22,
		id: 'semver',
		name: 'Semver checker',
		category: 'code',
		keywords: ['semver', 'version', 'range', 'npm', 'caret', 'tilde', 'bump'],
		description: 'Tests versions against an npm-style range (^, ~, x, hyphen, ||) and works out the next major, minor or patch version.',
		live: true,
		inputs: [
			{ name: 'range', label: 'Range', type: 'text', mono: true, default: '^1.4.0 || >=2.1.0 <3' },
			{ name: 'versions', label: 'Versions, one per line', type: 'textarea', mono: true, rows: 7, default: '1.3.9\n1.4.0\n1.9.2\n2.0.5\n2.1.0\n3.0.0-beta.1\n3.0.0' },
		],
		run({ range, versions }) {
			const list = versions.split('\n').map((s) => s.trim()).filter(Boolean);
			const rows = list.map((v) => {
				const p = parse(v);
				return [v, p ? (satisfies(v, range) ? 'Yes' : 'No') : 'Not a valid version'];
			});
			const valid = list.filter((v) => parse(v));
			const matching = valid.filter((v) => satisfies(v, range)).sort((a, b) => cmp(parse(a), parse(b)));
			const first = valid[0] && parse(valid[0]);
			const bump = (kind) => {
				const v = { ...first, pre: [] };
				if (kind === 'major') return fmt({ ...v, major: v.major + 1, minor: 0, patch: 0 });
				if (kind === 'minor') return fmt({ ...v, minor: v.minor + 1, patch: 0 });
				return fmt({ ...v, patch: first.pre.length ? v.patch : v.patch + 1 });
			};
			return {
				readings: [
					{ label: 'Highest match', value: matching.length ? matching[matching.length - 1] : 'none' },
					{ label: 'Lowest match', value: matching.length ? matching[0] : 'none' },
					...(first ? [{ label: `Next major after ${valid[0]}`, value: bump('major') }, { label: 'Next minor', value: bump('minor') }, { label: 'Next patch', value: bump('patch') }] : []),
				],
				table: { label: `Matches ${range}`, columns: ['Version', 'Satisfies'], rows },
			};
		},
	});
})();
