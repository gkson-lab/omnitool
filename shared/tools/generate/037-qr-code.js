// No. 037 QR code generator (qrcode-generator): text, links and Wi-Fi logins, as PNG or SVG.
Omni.register({
	no: 37,
	id: 'qr-code',
	name: 'QR code generator',
	category: 'generate',
	keywords: ['qr', 'qrcode', 'barcode', 'wifi', 'link', 'scan'],
	description: 'QR codes for text, links or Wi-Fi logins, with error correction level and size. Download as PNG or SVG.',
	vendor: ['qrcode.js'],
	live: true,
	inputs: [
		{ name: 'kind', label: 'Content', type: 'seg', options: [{ value: 'text', label: 'Text or link' }, { value: 'wifi', label: 'Wi-Fi' }], default: 'text' },
		{ name: 'text', label: 'Text or link', type: 'textarea', rows: 3, default: 'https://github.com/gkson-lab/labscode', when: (v) => v.kind === 'text' },
		{ name: 'ssid', label: 'Network name', type: 'text', when: (v) => v.kind === 'wifi' },
		{ name: 'wpass', label: 'Password', type: 'password', remember: false, when: (v) => v.kind === 'wifi' },
		{ name: 'security', label: 'Security', type: 'select', options: ['WPA', 'WEP', 'nopass'], default: 'WPA', when: (v) => v.kind === 'wifi' },
		{ name: 'level', label: 'Error correction', type: 'select', options: [{ value: 'L', label: 'Low (7%)' }, { value: 'M', label: 'Medium (15%)' }, { value: 'Q', label: 'Quartile (25%)' }, { value: 'H', label: 'High (30%)' }], default: 'M' },
		{ name: 'scale', label: 'Pixels per module', type: 'number', min: 2, max: 30, default: 8 },
	],
	run({ kind, text, ssid, wpass, security, level, scale }) {
		const esc = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');
		const data = kind === 'wifi' ? `WIFI:T:${security};S:${esc(ssid)};${security === 'nopass' ? '' : `P:${esc(wpass)};`};` : text;
		if (!data || (kind === 'wifi' && !ssid)) return { note: kind === 'wifi' ? 'Enter the network name.' : 'Type something to encode.' };
		window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
		const qr = window.qrcode(0, level);
		qr.addData(data, 'Byte');
		try {
			qr.make();
		} catch {
			throw new Error('Too much data for a QR code at this error level. Shorten it or lower the error correction.');
		}
		const n = qr.getModuleCount();
		const s = Math.max(2, Math.min(30, scale || 8));
		const quiet = 4;
		const size = (n + quiet * 2) * s;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, size, size);
		ctx.fillStyle = '#000000';
		let path = '';
		for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) {
			ctx.fillRect((c + quiet) * s, (r + quiet) * s, s, s);
			path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
		}
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + quiet * 2} ${n + quiet * 2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
		return {
			image: { src: canvas.toDataURL('image/png'), alt: `QR code for ${kind === 'wifi' ? 'Wi-Fi network ' + ssid : data.slice(0, 80)}`, name: 'qr-code.png', label: `QR code, ${n} by ${n} modules, ${size} px` },
			download: { name: 'qr-code.svg', data: svg, mime: 'image/svg+xml', label: 'Download SVG' },
			note: kind === 'wifi' ? 'Phones join the network when they scan this.' : null,
		};
	},
});
