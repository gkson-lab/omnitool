// No. 122 Browser and device info: parsed user agent, screen, language and which web features are available.
Omni.register({
	no: 122,
	id: 'device-info',
	name: 'Browser and device info',
	category: 'system',
	keywords: ['user agent', 'browser', 'device', 'screen', 'resolution', 'features', 'support', 'ua'],
	description: 'Parses the user agent and lists screen size, pixel ratio, language, time zone, preferences and support for common web features.',
	live: true,
	inputs: [{ name: 'ua', label: 'User agent (prefilled with yours)', type: 'textarea', rows: 3, mono: true, default: () => navigator.userAgent }],
	run({ ua }) {
		const s = ua || '';
		const browser = (() => {
			const rules = [[/Edg\/([\d.]+)/, 'Edge'], [/OPR\/([\d.]+)/, 'Opera'], [/Electron\/([\d.]+)/, 'Electron'], [/Firefox\/([\d.]+)/, 'Firefox'], [/Chrome\/([\d.]+)/, 'Chrome'], [/Version\/([\d.]+).*Safari/, 'Safari']];
			for (const [re, name] of rules) {
				const m = s.match(re);
				if (m) return `${name} ${m[1]}`;
			}
			return 'unknown';
		})();
		const os = /Windows NT 10/.test(s) ? 'Windows 10 or 11' : /Windows NT/.test(s) ? 'Windows (older)' : /Android ([\d.]+)/.test(s) ? `Android ${s.match(/Android ([\d.]+)/)[1]}` : /iPhone|iPad/.test(s) ? `iOS ${(s.match(/OS ([\d_]+)/) || ['', '?'])[1].replace(/_/g, '.')}` : /Mac OS X/.test(s) ? 'macOS' : /CrOS/.test(s) ? 'ChromeOS' : /Linux/.test(s) ? 'Linux' : 'unknown';
		const device = /Mobi|iPhone|Android(?!.*Tablet)/.test(s) ? 'phone' : /iPad|Tablet/.test(s) ? 'tablet' : 'desktop or laptop';
		const yes = (b) => (b ? 'yes' : 'no');
		const mq = (q) => window.matchMedia(q).matches;
		const canvas = document.createElement('canvas');
		return {
			readings: [
				{ label: 'Browser', value: browser },
				{ label: 'Operating system', value: os },
				{ label: 'Device type', value: device, copy: false },
				{ label: 'Screen', value: `${screen.width} x ${screen.height} at ${devicePixelRatio}x` },
				{ label: 'Window viewport', value: `${innerWidth} x ${innerHeight}`, copy: false },
				{ label: 'Color depth', value: `${screen.colorDepth} bit`, copy: false },
				{ label: 'Languages', value: (navigator.languages || [navigator.language]).join(', ') },
				{ label: 'Time zone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
				{ label: 'Logical processors', value: navigator.hardwareConcurrency || 'not reported', copy: false },
				{ label: 'Device memory (rounded)', value: navigator.deviceMemory ? `${navigator.deviceMemory} GB or more` : 'not reported', copy: false },
				{ label: 'Touch points', value: navigator.maxTouchPoints || 0, copy: false },
				{ label: 'Prefers dark mode', value: yes(mq('(prefers-color-scheme: dark)')), copy: false },
				{ label: 'Prefers reduced motion', value: yes(mq('(prefers-reduced-motion: reduce)')), copy: false },
				{ label: 'Pointer', value: mq('(pointer: coarse)') ? 'coarse (touch)' : 'fine (mouse)', copy: false },
			],
			table: {
				label: 'Web features',
				columns: ['Feature', 'Available'],
				rows: [
					['WebGL 2', yes(!!canvas.getContext('webgl2'))], ['WebGPU', yes('gpu' in navigator)], ['Web Crypto', yes(!!(window.crypto && crypto.subtle))], ['Service workers', yes('serviceWorker' in navigator)],
					['Clipboard API', yes(!!(navigator.clipboard && navigator.clipboard.writeText))], ['Notifications', yes('Notification' in window)], ['Web Speech (speak)', yes('speechSynthesis' in window)], ['EyeDropper', yes('EyeDropper' in window)],
					['WebAuthn (passkeys)', yes('PublicKeyCredential' in window)], ['Web Bluetooth', yes('bluetooth' in navigator)], ['Web USB', yes('usb' in navigator)], ['Secure context', yes(window.isSecureContext)],
				],
			},
		};
	},
});
