// No. 005 JSON to TypeScript: interfaces from a JSON sample, merging array items so missing keys become optional.
Omni.register({
	no: 5,
	id: 'json-to-ts',
	name: 'JSON to TypeScript',
	category: 'code',
	keywords: ['json', 'typescript', 'interface', 'types', 'ts'],
	description: 'Generates TypeScript interfaces from a JSON sample. Keys missing from some array items become optional.',
	live: true,
	inputs: [
		{ name: 'json', label: 'JSON sample', type: 'textarea', mono: true, rows: 12, default: '{"id": 1, "title": "Ship 1.0", "done": false, "tags": ["release"], "owner": {"name": "Sam", "email": null}, "steps": [{"name": "build", "ms": 120}, {"name": "test"}]}' },
		{ name: 'root', label: 'Root name', type: 'text', default: 'Root' },
		{ name: 'style', label: 'Declare as', type: 'seg', options: [{ value: 'interface', label: 'interface' }, { value: 'type', label: 'type' }], default: 'interface' },
		{ name: 'exported', label: 'Add export', type: 'checkbox', default: true },
	],
	run({ json, root, style, exported }) {
		const value = JSON.parse(json);
		const decls = [];
		const names = new Set();
		const pascal = (s) => (s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase()) || 'Item').replace(/^\d/, '_$&');
		const unique = (n) => {
			let name = n;
			let i = 2;
			while (names.has(name)) name = n + i++;
			names.add(name);
			return name;
		};
		const singular = (s) => s.replace(/ies$/, 'y').replace(/(s|es)$/, '') || s;

		function typeOf(v, nameHint) {
			if (v === null) return 'null';
			if (Array.isArray(v)) {
				if (!v.length) return 'unknown[]';
				const objects = v.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
				const types = new Set(v.filter((x) => !(x && typeof x === 'object' && !Array.isArray(x))).map((x) => typeOf(x, nameHint)));
				if (objects.length) types.add(objectType(objects, pascal(singular(nameHint))));
				const t = [...types].join(' | ');
				return types.size > 1 ? `(${t})[]` : `${t}[]`;
			}
			if (typeof v === 'object') return objectType([v], pascal(nameHint));
			return typeof v;
		}
		function objectType(samples, name) {
			const final = unique(name);
			const keys = [...new Set(samples.flatMap((s) => Object.keys(s)))];
			const lines = keys.map((k) => {
				const present = samples.filter((s) => k in s);
				const types = [...new Set(present.map((s) => typeOf(s[k], k)))];
				const optional = present.length < samples.length ? '?' : '';
				const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
				return `  ${key}${optional}: ${types.join(' | ')};`;
			});
			const ex = exported ? 'export ' : '';
			decls.push(style === 'type' ? `${ex}type ${final} = {\n${lines.join('\n')}\n};` : `${ex}interface ${final} {\n${lines.join('\n')}\n}`);
			return final;
		}
		const top = typeOf(value, root || 'Root');
		if (!(value && typeof value === 'object' && !Array.isArray(value))) decls.push(`${exported ? 'export ' : ''}type ${pascal(root || 'Root')} = ${top};`);
		return { text: decls.join('\n\n'), label: 'TypeScript' };
	},
});
