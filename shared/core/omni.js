// OmniTool core: the tool registry, DOM helpers, storage and vendor loading. Shared by the web and desktop editions.
(function () {
	'use strict';

	const script = document.currentScript;
	const sharedBase = script.src.replace(/core\/omni\.js(\?.*)?$/, '');

	const Omni = {
		edition: document.documentElement.dataset.edition || 'web',
		native: window.omniNative || null,
		sharedBase,
		tools: [],
		byId: Object.create(null),
		categories: [
			{ id: 'code', name: 'Code and dev tools' },
			{ id: 'generate', name: 'Generators' },
			{ id: 'convert', name: 'Converters' },
			{ id: 'math', name: 'Calculators and math' },
			{ id: 'text', name: 'Text tools' },
			{ id: 'productivity', name: 'Productivity' },
			{ id: 'system', name: 'Network and system' },
			{ id: 'design', name: 'Design tools' },
			{ id: 'ai', name: 'AI tools' },
			{ id: 'fun', name: 'Fun' },
		],
	};
	window.Omni = Omni;

	/* ---------- Registry ---------- */

	Omni.register = function register(def) {
		if (!def.id || !def.no || !def.name || !def.category) throw new Error('Tool definitions need id, no, name and category');
		def.editions = def.editions || ['desktop', 'web'];
		if (!def.editions.includes(Omni.edition)) return;
		if (Omni.byId[def.id]) throw new Error(`Duplicate tool id ${def.id}`);
		def.keywords = def.keywords || [];
		def.inputs = def.inputs || [];
		def.code = String(def.no).padStart(3, '0');
		Omni.byId[def.id] = def;
		Omni.tools.push(def);
	};

	Omni.sortedTools = function () {
		return Omni.tools.slice().sort((a, b) => a.no - b.no);
	};

	Omni.category = function (id) {
		return Omni.categories.find((c) => c.id === id);
	};

	/* ---------- Events ---------- */

	const listeners = Object.create(null);
	Omni.on = function (name, fn) {
		(listeners[name] = listeners[name] || []).push(fn);
		return () => (listeners[name] = listeners[name].filter((f) => f !== fn));
	};
	Omni.emit = function (name, data) {
		(listeners[name] || []).slice().forEach((fn) => {
			try {
				fn(data);
			} catch (err) {
				console.error(err);
			}
		});
	};

	/* ---------- DOM helpers ---------- */

	/** Hyperscript: h('button', { class: 'btn', onclick }, 'Save'). Strings become text nodes, never HTML. */
	function h(tag, attrs, ...children) {
		const el = document.createElement(tag);
		if (attrs) {
			for (const [k, v] of Object.entries(attrs)) {
				if (v == null || v === false) continue;
				if (k === 'class') el.className = v;
				else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) p.startsWith('--') ? val != null && el.style.setProperty(p, val) : (el.style[p] = val == null ? '' : val);
				else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
				else if (k === 'html') el.innerHTML = v;
				else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
				else el.setAttribute(k, v === true ? '' : v);
			}
		}
		append(el, children);
		return el;
	}
	function append(el, children) {
		for (const c of children.flat(Infinity)) {
			if (c == null || c === false) continue;
			el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
		}
		return el;
	}

	const ICONS = {
		search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
		pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
		pinned: '<path d="M9 3h6l-1 6 4 4H6l4-4z" fill="currentColor"/><path d="M12 13v8"/>',
		check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
		copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
		close: '<path d="M6 6l12 12M18 6 6 18"/>',
		menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
		download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
		back: '<path d="M15 5l-7 7 7 7"/>',
		up: '<path d="M6 15l6-6 6 6"/>',
		down: '<path d="M6 9l6 6 6-6"/>',
		trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
	};
	function icon(name) {
		const span = document.createElement('span');
		span.className = 'icon';
		span.setAttribute('aria-hidden', 'true');
		span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
		return span;
	}

	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

	function debounce(fn, ms) {
		let t;
		return function (...args) {
			clearTimeout(t);
			t = setTimeout(() => fn.apply(this, args), ms);
		};
	}

	async function copy(text) {
		const value = String(text);
		try {
			if (Omni.native && Omni.native.clipboard) await Omni.native.clipboard.write(value);
			else await navigator.clipboard.writeText(value);
			Omni.ui.toast('Copied to the clipboard');
			return true;
		} catch {
			// Older browsers and file:// pages without clipboard permission fall back to a hidden textarea.
			const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, value);
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand('copy');
			ta.remove();
			Omni.ui.toast(ok ? 'Copied to the clipboard' : 'Copy failed: select the text and press Ctrl+C', { error: !ok });
			return ok;
		}
	}

	function download(name, data, mime) {
		const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = h('a', { href: url, download: name });
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 2000);
	}

	function dataUrlToBlob(dataUrl) {
		const [head, body] = dataUrl.split(',');
		const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
		const bin = atob(body);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new Blob([bytes], { type: mime });
	}

	function readFile(file, as) {
		return new Promise((resolve, reject) => {
			const r = new FileReader();
			r.onload = () => resolve(r.result);
			r.onerror = () => reject(new Error(`Could not read ${file.name}`));
			if (as === 'dataurl') r.readAsDataURL(file);
			else if (as === 'buffer') r.readAsArrayBuffer(file);
			else r.readAsText(file);
		});
	}

	function loadImage(src) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('That file is not an image this browser can open'));
			img.src = src;
		});
	}

	const fmt = {
		bytes(n) {
			if (!Number.isFinite(n)) return '-';
			const units = ['B', 'KB', 'MB', 'GB', 'TB'];
			let i = 0;
			while (Math.abs(n) >= 1024 && i < units.length - 1) {
				n /= 1024;
				i++;
			}
			return `${i ? n.toFixed(n < 10 ? 2 : 1) : n} ${units[i]}`;
		},
		number(n, digits) {
			if (!Number.isFinite(n)) return String(n);
			return n.toLocaleString(undefined, { maximumFractionDigits: digits == null ? 10 : digits });
		},
		duration(ms) {
			const s = Math.floor(ms / 1000);
			const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
			return (parts[0] ? parts[0] + ':' : '') + String(parts[1]).padStart(parts[0] ? 2 : 1, '0') + ':' + String(parts[2]).padStart(2, '0');
		},
		plural(n, word, plural) {
			return `${n} ${n === 1 ? word : plural || word + 's'}`;
		},
	};

	Omni.h = h;
	Omni.append = append;
	Omni.icon = icon;
	Omni.util = { escapeHtml, debounce, copy, download, dataUrlToBlob, readFile, loadImage, fmt };

	/* ---------- Storage ---------- */

	// Desktop keeps settings in desktop/data/config.json through the preload bridge; the web uses localStorage.
	const memory = Object.create(null);
	let backend;
	if (Omni.native && Omni.native.config) {
		const data = Omni.native.config.load() || {};
		Object.assign(memory, data);
		const flush = debounce(() => Promise.resolve(Omni.native.config.save(memory)).catch((err) => console.warn('Settings were not saved:', err.message)), 300);
		backend = {
			kind: 'file',
			get: (k) => memory[k],
			set: (k, v) => {
				memory[k] = v;
				flush();
			},
			remove: (k) => {
				delete memory[k];
				flush();
			},
			clear: () => {
				Object.keys(memory).forEach((k) => delete memory[k]);
				flush();
			},
		};
	} else {
		let ok = false;
		try {
			const probe = '__omnitool_probe__';
			localStorage.setItem(probe, '1');
			localStorage.removeItem(probe);
			ok = true;
		} catch {
			ok = false;
		}
		backend = {
			kind: ok ? 'local' : 'memory',
			get(k) {
				if (!ok) return memory[k];
				try {
					const raw = localStorage.getItem('omnitool:' + k);
					return raw == null ? undefined : JSON.parse(raw);
				} catch {
					return memory[k];
				}
			},
			set(k, v) {
				memory[k] = v;
				if (!ok) return;
				try {
					localStorage.setItem('omnitool:' + k, JSON.stringify(v));
				} catch (err) {
					console.warn('Could not save', k, err);
				}
			},
			remove(k) {
				delete memory[k];
				if (!ok) return;
				try {
					localStorage.removeItem('omnitool:' + k);
				} catch {
					// Storage blocked mid-session; the memory copy is already gone.
				}
			},
			clear() {
				Object.keys(memory).forEach((k) => delete memory[k]);
				if (!ok) return;
				try {
					Object.keys(localStorage)
						.filter((k) => k.startsWith('omnitool:'))
						.forEach((k) => localStorage.removeItem(k));
				} catch {
					// Nothing more to clear.
				}
			},
		};
	}

	Omni.store = {
		kind: backend.kind,
		get(key, fallback) {
			const v = backend.get(key);
			return v === undefined ? (typeof fallback === 'function' ? fallback() : fallback) : v;
		},
		set(key, value) {
			backend.set(key, value);
			Omni.emit('store', { key, value });
		},
		remove(key) {
			backend.remove(key);
		},
		clear() {
			backend.clear();
		},
		/** Per-tool namespace: ctx.store in a tool's mount(). */
		scope(prefix) {
			return {
				get: (k, f) => Omni.store.get(`${prefix}.${k}`, f),
				set: (k, v) => Omni.store.set(`${prefix}.${k}`, v),
				remove: (k) => Omni.store.remove(`${prefix}.${k}`),
			};
		},
	};

	// API keys: desktop encrypts them with Windows DPAPI (Electron safeStorage); the web keeps them in localStorage.
	Omni.secrets = {
		where() {
			if (Omni.native && Omni.native.secrets) return Omni.native.secrets.where();
			return backend.kind === 'local' ? "this browser's local storage for this page" : 'memory only (this browser blocks storage), so it is gone when the page closes';
		},
		get(name) {
			if (Omni.native && Omni.native.secrets) return Omni.native.secrets.get(name);
			return Omni.store.get('secret.' + name, null);
		},
		set(name, value) {
			if (Omni.native && Omni.native.secrets) return Omni.native.secrets.set(name, value);
			Omni.store.set('secret.' + name, value);
			return true;
		},
		clear(name) {
			if (Omni.native && Omni.native.secrets) return Omni.native.secrets.clear(name);
			Omni.store.remove('secret.' + name);
			return true;
		},
	};

	/* ---------- Vendor libraries (loaded on first use) ---------- */

	const loaded = Object.create(null);
	Omni.vendor = function vendor(names) {
		const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
		return list.reduce(
			(chain, name) =>
				chain.then(() => {
					if (!loaded[name]) {
						loaded[name] = new Promise((resolve, reject) => {
							const url = sharedBase + 'vendor/' + name;
							const node = name.endsWith('.css') ? h('link', { rel: 'stylesheet', href: url }) : h('script', { src: url });
							node.onload = resolve;
							node.onerror = () => {
								delete loaded[name];
								reject(new Error(`Could not load ${name} from shared/vendor. Keep the OmniTool folder structure intact.`));
							};
							document.head.appendChild(node);
						});
					}
					return loaded[name];
				}),
			Promise.resolve(),
		);
	};

	// CodeMirror and the modes/addons OmniTool uses, in dependency order.
	Omni.vendor.codemirror = () =>
		Omni.vendor([
			'codemirror/codemirror.css',
			'codemirror/addon/dialog.css',
			'codemirror/codemirror.js',
			'codemirror/mode/javascript.js',
			'codemirror/mode/css.js',
			'codemirror/mode/xml.js',
			'codemirror/mode/htmlmixed.js',
			'codemirror/mode/python.js',
			'codemirror/mode/markdown.js',
			'codemirror/mode/sql.js',
			'codemirror/mode/clike.js',
			'codemirror/mode/shell.js',
			'codemirror/mode/yaml.js',
			'codemirror/addon/searchcursor.js',
			'codemirror/addon/dialog.js',
			'codemirror/addon/search.js',
			'codemirror/addon/jump-to-line.js',
			'codemirror/addon/matchbrackets.js',
			'codemirror/addon/closebrackets.js',
			'codemirror/addon/active-line.js',
			'codemirror/addon/comment.js',
		]);
})();
