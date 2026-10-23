// No. 007 XML formatter: indents or minifies XML and reports parser errors.
(function () {
	'use strict';

	function parseXml(text) {
		const doc = new DOMParser().parseFromString(text, 'application/xml');
		const err = doc.getElementsByTagName('parsererror')[0];
		if (err) throw new Error(err.textContent.replace(/\s+/g, ' ').replace(/^This page contains the following errors:\s*/i, '').replace(/Below is a rendering.*$/i, '').trim());
		return doc;
	}

	const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const escAttr = (s) => escText(s).replace(/"/g, '&quot;');

	/** Serializes a DOM node with indentation; elements holding only text stay on one line. */
	function pretty(node, indent, depth) {
		const pad = indent.repeat(depth);
		switch (node.nodeType) {
			case 9:
				return Array.from(node.childNodes).map((c) => pretty(c, indent, depth)).filter(Boolean).join('\n');
			case 1: {
				const attrs = Array.from(node.attributes).map((a) => ` ${a.name}="${escAttr(a.value)}"`).join('');
				const kids = Array.from(node.childNodes).filter((c) => !(c.nodeType === 3 && !c.nodeValue.trim()));
				if (!kids.length) return `${pad}<${node.nodeName}${attrs}/>`;
				if (kids.length === 1 && kids[0].nodeType === 3) return `${pad}<${node.nodeName}${attrs}>${escText(kids[0].nodeValue.trim())}</${node.nodeName}>`;
				return `${pad}<${node.nodeName}${attrs}>\n${kids.map((c) => pretty(c, indent, depth + 1)).join('\n')}\n${pad}</${node.nodeName}>`;
			}
			case 3:
				return pad + escText(node.nodeValue.trim());
			case 4:
				return `${pad}<![CDATA[${node.nodeValue}]]>`;
			case 7:
				return `${pad}<?${node.target} ${node.data}?>`;
			case 8:
				return `${pad}<!--${node.nodeValue}-->`;
			case 10:
				return `${pad}<!DOCTYPE ${node.name}>`;
			default:
				return '';
		}
	}

	Omni.xml = { parse: parseXml, pretty };

	Omni.register({
		no: 7,
		id: 'xml-formatter',
		name: 'XML formatter',
		category: 'code',
		keywords: ['xml', 'pretty', 'format', 'validate', 'minify', 'svg'],
		description: 'Indents or minifies XML and shows parser errors.',
		live: true,
		inputs: [
			{ name: 'xml', label: 'XML', type: 'textarea', mono: true, rows: 12, default: '<?xml version="1.0"?><catalog><tool no="1"><name>LabsCode</name><edition>desktop</edition></tool><tool no="2"><name>Code Pad</name></tool></catalog>' },
			{ name: 'indent', label: 'Indent', type: 'select', options: [{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tabs' }, { value: 'min', label: 'Minified' }], default: '2' },
		],
		run({ xml, indent }) {
			if (!xml.trim()) return { note: 'Paste XML above.' };
			const decl = (xml.match(/^\s*<\?xml[^?]*\?>/) || [''])[0].trim();
			const doc = parseXml(xml);
			let out;
			if (indent === 'min') out = (decl ? decl : '') + new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^?]*\?>/, '').replace(/>\s+</g, '><').trim();
			else out = (decl ? decl + '\n' : '') + pretty(doc, indent === 'tab' ? '\t' : ' '.repeat(Number(indent)), 0);
			return { text: out, readings: [{ label: 'Well-formed', value: 'Yes', copy: false }, { label: 'Root element', value: doc.documentElement.nodeName, copy: false }, { label: 'Elements', value: doc.getElementsByTagName('*').length, copy: false }] };
		},
	});
})();
