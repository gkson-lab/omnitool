// Color parsing and conversion (hex, rgb, hsl, hsv, cmyk, oklch) plus WCAG contrast. Used by the design tools.
(function () {
	'use strict';

	const NAMED = {
		black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
		gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a', navy: '#000080', teal: '#008080',
		olive: '#808000', maroon: '#800000', lime: '#00ff00', silver: '#c0c0c0', gold: '#ffd700', indigo: '#4b0082', violet: '#ee82ee', coral: '#ff7f50',
		salmon: '#fa8072', tomato: '#ff6347', crimson: '#dc143c', turquoise: '#40e0d0', beige: '#f5f5dc', ivory: '#fffff0', khaki: '#f0e68c', tan: '#d2b48c',
		rebeccapurple: '#663399', transparent: '#00000000',
	};

	const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

	/** Parses hex, rgb(), hsl(), hsv() and CSS names into { r, g, b, a } with r,g,b 0-255 and a 0-1. */
	function parse(input) {
		let s = String(input || '').trim().toLowerCase();
		if (NAMED[s]) s = NAMED[s];
		let m = s.match(/^#?([0-9a-f]{3,8})$/);
		if (m && [3, 4, 6, 8].includes(m[1].length)) {
			let hex = m[1];
			if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
			return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
		}
		m = s.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
		if (m) {
			const ch = (v) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v));
			return { r: clamp(ch(m[1]), 0, 255), g: clamp(ch(m[2]), 0, 255), b: clamp(ch(m[3]), 0, 255), a: m[4] ? clamp(m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]), 0, 1) : 1 };
		}
		m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/);
		if (m) return { ...hslToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])), a: m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1 };
		m = s.match(/^hsv\(\s*([\d.]+)[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?\s*\)$/);
		if (m) return { ...hsvToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])), a: 1 };
		m = s.match(/^oklch\(\s*([\d.]+)(%?)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:deg)?\s*\)$/);
		if (m) return { ...oklchToRgb(m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]), parseFloat(m[3]), parseFloat(m[4])), a: 1 };
		return null;
	}

	function toHex({ r, g, b, a }) {
		const h2 = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
		return '#' + h2(r) + h2(g) + h2(b) + (a != null && a < 1 ? h2(a * 255) : '');
	}

	function rgbToHsl({ r, g, b }) {
		r /= 255;
		g /= 255;
		b /= 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const l = (max + min) / 2;
		let h = 0;
		let s = 0;
		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
			h *= 60;
		}
		return { h, s: s * 100, l: l * 100 };
	}

	function hslToRgb(h, s, l) {
		h = ((h % 360) + 360) % 360;
		s /= 100;
		l /= 100;
		const k = (n) => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
	}

	function rgbToHsv({ r, g, b }) {
		r /= 255;
		g /= 255;
		b /= 255;
		const max = Math.max(r, g, b);
		const d = max - Math.min(r, g, b);
		let h = 0;
		if (d) h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
		return { h, s: max ? (d / max) * 100 : 0, v: max * 100 };
	}

	function hsvToRgb(h, s, v) {
		s /= 100;
		v /= 100;
		const f = (n) => {
			const k = (n + h / 60) % 6;
			return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
		};
		return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
	}

	function rgbToCmyk({ r, g, b }) {
		const rr = r / 255;
		const gg = g / 255;
		const bb = b / 255;
		const k = 1 - Math.max(rr, gg, bb);
		if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
		return { c: ((1 - rr - k) / (1 - k)) * 100, m: ((1 - gg - k) / (1 - k)) * 100, y: ((1 - bb - k) / (1 - k)) * 100, k: k * 100 };
	}

	function cmykToRgb(c, m, y, k) {
		return { r: 255 * (1 - c / 100) * (1 - k / 100), g: 255 * (1 - m / 100) * (1 - k / 100), b: 255 * (1 - y / 100) * (1 - k / 100) };
	}

	const toLinear = (c) => {
		c /= 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const fromLinear = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

	// OKLab/OKLCH per Björn Ottosson's reference matrices.
	function rgbToOklch({ r, g, b }) {
		const lr = toLinear(r);
		const lg = toLinear(g);
		const lb = toLinear(b);
		const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
		const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
		const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
		const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
		const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
		const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
		const C = Math.sqrt(A * A + B * B);
		let H = (Math.atan2(B, A) * 180) / Math.PI;
		if (H < 0) H += 360;
		return { l: L, c: C, h: C < 1e-4 ? 0 : H };
	}

	function oklchToRgb(L, C, H) {
		const A = C * Math.cos((H * Math.PI) / 180);
		const B = C * Math.sin((H * Math.PI) / 180);
		const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
		const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
		const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
		return {
			r: clamp(fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), 0, 255),
			g: clamp(fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), 0, 255),
			b: clamp(fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s), 0, 255),
		};
	}

	function luminance({ r, g, b }) {
		const ch = (v) => {
			v /= 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
	}

	/** WCAG 2.x contrast ratio; a translucent foreground is first blended over the background. */
	function contrast(fg, bg) {
		const f = fg.a != null && fg.a < 1 ? mix(bg, fg, fg.a) : fg;
		const a = luminance(f);
		const b = luminance(bg);
		return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	}

	/** Blend: t=0 gives a, t=1 gives b. */
	function mix(a, b, t) {
		return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 };
	}

	function formats(c) {
		const hsl = rgbToHsl(c);
		const hsv = rgbToHsv(c);
		const cmyk = rgbToCmyk(c);
		const ok = rgbToOklch(c);
		const r1 = (x) => Math.round(x);
		return {
			hex: toHex(c),
			rgb: c.a < 1 ? `rgb(${r1(c.r)} ${r1(c.g)} ${r1(c.b)} / ${+c.a.toFixed(3)})` : `rgb(${r1(c.r)}, ${r1(c.g)}, ${r1(c.b)})`,
			hsl: `hsl(${r1(hsl.h)}, ${r1(hsl.s)}%, ${r1(hsl.l)}%)`,
			hsv: `hsv(${r1(hsv.h)}, ${r1(hsv.s)}%, ${r1(hsv.v)}%)`,
			cmyk: `cmyk(${r1(cmyk.c)}%, ${r1(cmyk.m)}%, ${r1(cmyk.y)}%, ${r1(cmyk.k)}%)`,
			oklch: `oklch(${(ok.l * 100).toFixed(1)}% ${ok.c.toFixed(3)} ${ok.h.toFixed(1)})`,
		};
	}

	/** Text color (black or white) that reads best on this background. */
	function readableOn(bg) {
		return contrast({ r: 0, g: 0, b: 0 }, bg) >= contrast({ r: 255, g: 255, b: 255 }, bg) ? '#000000' : '#ffffff';
	}

	Omni.color = { parse, toHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, rgbToCmyk, cmykToRgb, rgbToOklch, oklchToRgb, luminance, contrast, mix, formats, readableOn, NAMED };
})();
