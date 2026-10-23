// No. 048 File and data URI converter: any file to a data: URI, and a data URI back to a file.
Omni.register({
	no: 48,
	id: 'data-uri',
	name: 'File and data URI converter',
	category: 'convert',
	keywords: ['data uri', 'data url', 'base64', 'file', 'embed', 'inline image'],
	description: 'Turns a file into a data: URI you can paste into CSS or HTML, and turns a data URI back into a downloadable file.',
	inputs: [
		{ name: 'mode', label: 'Mode', type: 'seg', options: [{ value: 'toUri', label: 'File to data URI' }, { value: 'toFile', label: 'Data URI to file' }], default: 'toUri' },
		{ name: 'file', label: 'File', type: 'file', when: (v) => v.mode === 'toUri' },
		{ name: 'uri', label: 'Data URI', type: 'textarea', mono: true, rows: 5, when: (v) => v.mode === 'toFile', placeholder: 'data:image/png;base64,...' },
		{ name: 'name', label: 'File name to save as', type: 'text', default: 'file', when: (v) => v.mode === 'toFile' },
	],
	action: 'Convert',
	async run({ mode, file, uri, name }) {
		if (mode === 'toUri') {
			if (!file) return { note: 'Choose a file.' };
			if (file.size > 20 * 1048576) throw new Error('Files over 20 MB make data URIs too large to be useful.');
			const dataUrl = await Omni.util.readFile(file, 'dataurl');
			const isImage = file.type.startsWith('image/');
			return {
				readings: [{ label: 'Type', value: file.type || 'unknown', copy: false }, { label: 'File size', value: Omni.util.fmt.bytes(file.size), copy: false }, { label: 'URI length', value: dataUrl.length.toLocaleString() + ' characters', copy: false }],
				blocks: [isImage ? { type: 'image', src: dataUrl, alt: file.name, label: 'Preview' } : null, { type: 'text', label: 'Data URI', value: dataUrl }, isImage ? { type: 'text', label: 'CSS', value: `background-image: url("${dataUrl}");` } : null].filter(Boolean),
			};
		}
		const m = String(uri).trim().match(/^data:([^;,]*)(;base64)?,(.*)$/s);
		if (!m) throw new Error('A data URI starts with data: and has a comma before the content.');
		const mime = m[1] || 'text/plain';
		const bytes = m[2] ? Omni.bytes.fromBase64(m[3]) : Omni.bytes.utf8(decodeURIComponent(m[3]));
		const ext = (mime.split('/')[1] || 'bin').split('+')[0];
		const fileName = /\.\w+$/.test(name) ? name : `${name || 'file'}.${ext}`;
		return { readings: [{ label: 'Type', value: mime, copy: false }, { label: 'Size', value: Omni.util.fmt.bytes(bytes.length), copy: false }], download: { name: fileName, data: new Blob([bytes], { type: mime }), label: `Download ${fileName}` }, image: mime.startsWith('image/') ? { src: String(uri).trim(), alt: 'Decoded image', label: 'Preview' } : null };
	},
});
