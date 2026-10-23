// No. 006 YAML and JSON converter (js-yaml).
Omni.register({
	no: 6,
	id: 'yaml-json',
	name: 'YAML and JSON converter',
	category: 'code',
	keywords: ['yaml', 'yml', 'json', 'convert', 'config'],
	description: 'Converts YAML to JSON and JSON to YAML, with error locations.',
	vendor: ['js-yaml.min.js'],
	live: true,
	inputs: [
		{ name: 'direction', label: 'Direction', type: 'seg', options: [{ value: 'y2j', label: 'YAML to JSON' }, { value: 'j2y', label: 'JSON to YAML' }], default: 'y2j' },
		{ name: 'text', label: 'Input', type: 'textarea', mono: true, rows: 12, default: 'name: omnitool\nversion: 1.0.0\neditions:\n  - desktop\n  - web\nagent:\n  offline: true\n  model: claude-opus-5-5\n' },
		{ name: 'indent', label: 'Indent', type: 'select', options: ['2', '4'], default: '2' },
	],
	run({ direction, text, indent }) {
		const yaml = window.jsyaml;
		try {
			if (direction === 'y2j') {
				const docs = yaml.loadAll(text);
				const value = docs.length === 1 ? docs[0] : docs;
				return { text: JSON.stringify(value, null, Number(indent)), label: 'JSON', note: docs.length > 1 ? `${docs.length} YAML documents became a JSON array.` : null };
			}
			return { text: yaml.dump(JSON.parse(text), { indent: Number(indent), lineWidth: 120, noRefs: true }), label: 'YAML' };
		} catch (err) {
			const where = err.mark ? ` at line ${err.mark.line + 1}, column ${err.mark.column + 1}` : '';
			throw new Error(`Could not parse the ${direction === 'y2j' ? 'YAML' : 'JSON'}${where}: ${err.reason || err.message}`);
		}
	},
});
