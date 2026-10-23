// No. 008 XML and JSON converter. Attributes become "@name", text "#text", repeated elements arrays.
Omni.register({
	no: 8,
	id: 'xml-json',
	name: 'XML and JSON converter',
	category: 'code',
	keywords: ['xml', 'json', 'convert'],
	description: 'Converts XML to JSON and back. Attributes are "@name" keys, text is "#text", repeated tags become arrays.',
	live: true,
	inputs: [
		{ name: 'direction', label: 'Direction', type: 'seg', options: [{ value: 'x2j', label: 'XML to JSON' }, { value: 'j2x', label: 'JSON to XML' }], default: 'x2j' },
		{ name: 'text', label: 'Input', type: 'textarea', mono: true, rows: 12, default: '<order id="17"><item sku="A1">Cable</item><item sku="B2">Adapter</item><paid>true</paid></order>' },
		{ name: 'root', label: 'Root tag (JSON to XML)', type: 'text', default: 'root', when: (v) => v.direction === 'j2x' },
	],
	run({ direction, text, root }) {
		if (direction === 'x2j') {
			const doc = Omni.xml.parse(text);
			const toObj = (el) => {
				const obj = {};
				for (const a of el.attributes) obj['@' + a.name] = a.value;
				const kids = Array.from(el.children);
				const textValue = Array.from(el.childNodes).filter((n) => n.nodeType === 3 || n.nodeType === 4).map((n) => n.nodeValue).join('').trim();
				for (const k of kids) {
					const v = toObj(k);
					if (k.nodeName in obj) obj[k.nodeName] = [].concat(obj[k.nodeName], [v]);
					else obj[k.nodeName] = v;
				}
				if (!kids.length && !el.attributes.length) return textValue;
				if (textValue) obj['#text'] = textValue;
				return obj;
			};
			return { text: JSON.stringify({ [doc.documentElement.nodeName]: toObj(doc.documentElement) }, null, 2), label: 'JSON' };
		}
		const data = JSON.parse(text);
		const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		const tag = (n) => String(n).replace(/[^\w.-]/g, '_').replace(/^(\d|xml)/i, '_$1');
		const build = (name, v, pad) => {
			if (Array.isArray(v)) return v.map((x) => build(name, x, pad)).join('\n');
			if (v && typeof v === 'object') {
				const attrs = Object.entries(v).filter(([k]) => k.startsWith('@')).map(([k, x]) => ` ${tag(k.slice(1))}="${esc(x)}"`).join('');
				const kids = Object.entries(v).filter(([k]) => !k.startsWith('@') && k !== '#text');
				const t = v['#text'] != null ? esc(v['#text']) : '';
				if (!kids.length) return `${pad}<${tag(name)}${attrs}>${t}</${tag(name)}>`;
				return `${pad}<${tag(name)}${attrs}>${t}\n${kids.map(([k, x]) => build(k, x, pad + '  ')).join('\n')}\n${pad}</${tag(name)}>`;
			}
			return `${pad}<${tag(name)}>${v == null ? '' : esc(v)}</${tag(name)}>`;
		};
		const keys = data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [];
		const xml = keys.length === 1 && !Array.isArray(data[keys[0]]) ? build(keys[0], data[keys[0]], '') : build(root || 'root', data, '');
		return { text: '<?xml version="1.0" encoding="UTF-8"?>\n' + xml, label: 'XML' };
	},
});
