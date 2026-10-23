// The app shell: sidebar, routing, home catalog, tool pages, command palette, settings, dialogs and toasts.
(function () {
	'use strict';
	const { h, icon, store } = Omni;
	const { fmt } = Omni.util;

	const state = {
		cleanup: null,
		route: null,
		overlays: 0,
		menuOpen: false,
		pendingArgs: null,
	};

	/* ---------- Overlays (the desktop hides LabsCode's native window while one is open) ---------- */

	function overlayOpened() {
		state.overlays++;
		Omni.emit('overlay', state.overlays);
	}
	function overlayClosed() {
		state.overlays = Math.max(0, state.overlays - 1);
		Omni.emit('overlay', state.overlays);
	}
	Omni.overlays = () => state.overlays;

	/* ---------- Toasts and dialogs ---------- */

	let toastBox;
	function toast(message, opts) {
		const o = opts || {};
		const life = o.error ? 7000 : 4000;
		const el = h('div', { class: 'toast' + (o.error ? ' error' : ''), role: o.error ? 'alert' : 'status' }, o.title ? h('strong', null, o.title + ' ') : null, message);
		el.style.setProperty('--toast-life', life + 'ms');
		toastBox.appendChild(el);
		// Pointing at a toast holds it, and its countdown line pauses with it.
		let left = life;
		let started = 0;
		let timer;
		const leave = () => Omni.motion.exit(el, 'leaving', () => el.remove());
		const arm = () => {
			started = Date.now();
			timer = setTimeout(leave, left);
		};
		el.addEventListener('mouseenter', () => {
			clearTimeout(timer);
			left -= Date.now() - started;
		});
		el.addEventListener('mouseleave', arm);
		arm();
	}

	function openDialog(build) {
		return new Promise((resolve) => {
			const dlg = h('dialog', { 'aria-modal': 'true' });
			let result;
			const close = (value) => {
				if (dlg.classList.contains('closing')) return;
				result = value;
				Omni.motion.exit(dlg, 'closing', () => dlg.close());
			};
			build(dlg, close);
			// Escape goes through the same path, so it gets the exit animation too.
			dlg.addEventListener('cancel', (e) => {
				e.preventDefault();
				close(undefined);
			});
			dlg.addEventListener('close', () => {
				dlg.remove();
				overlayClosed();
				resolve(result);
			});
			document.body.appendChild(dlg);
			overlayOpened();
			dlg.showModal();
		});
	}

	/** confirm({ title, body, confirmLabel, cancelLabel, danger }) resolves true only on the confirm button. */
	function confirm(opts) {
		return openDialog((dlg, close) => {
			const titleId = 'dlg-title-' + Date.now();
			dlg.setAttribute('aria-labelledby', titleId);
			const ok = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => close(true) }, opts.confirmLabel || 'Confirm');
			Omni.append(dlg, [
				h('div', { class: 'dialog-body stack' }, h('h2', { id: titleId }, opts.title), typeof opts.body === 'string' ? h('p', null, opts.body) : opts.body || null),
				h('div', { class: 'dialog-foot' }, h('button', { type: 'button', class: 'btn', onclick: () => close(false) }, opts.cancelLabel || 'Cancel'), ok),
			]);
			setTimeout(() => (opts.focusCancel ? dlg.querySelector('.btn') : ok).focus(), 0);
		}).then((v) => v === true);
	}

	function prompt(opts) {
		return openDialog((dlg, close) => {
			const titleId = 'dlg-title-' + Date.now();
			dlg.setAttribute('aria-labelledby', titleId);
			const input = h('input', { type: 'text', value: opts.value || '', placeholder: opts.placeholder || '', 'aria-labelledby': titleId });
			const form = h(
				'form',
				{ onsubmit: (e) => (e.preventDefault(), close(input.value)) },
				h('div', { class: 'dialog-body stack' }, h('h2', { id: titleId }, opts.title), opts.body ? h('p', { class: 'muted' }, opts.body) : null, input),
				h('div', { class: 'dialog-foot' }, h('button', { type: 'button', class: 'btn', onclick: () => close(null) }, 'Cancel'), h('button', { type: 'submit', class: 'btn btn-primary' }, opts.confirmLabel || 'Save')),
			);
			dlg.appendChild(form);
			setTimeout(() => input.select(), 0);
		}).then((v) => (v == null ? null : v));
	}

	Omni.ui = { toast, confirm, prompt, openDialog, overlayOpened, overlayClosed };

	/* ---------- Pins, recents, theme ---------- */

	const pins = () => store.get('pinned', []).filter((id) => Omni.byId[id]);
	const recents = () => store.get('recent', []).filter((id) => Omni.byId[id]);
	function togglePin(id) {
		const list = pins();
		const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
		store.set('pinned', next);
		renderNav();
		return next.includes(id);
	}
	function touchRecent(id) {
		store.set('recent', [id, ...recents().filter((x) => x !== id)].slice(0, 12));
	}

	function applyTheme() {
		const t = store.get('theme', 'system');
		if (t === 'system') document.documentElement.removeAttribute('data-theme');
		else document.documentElement.setAttribute('data-theme', t);
		Omni.emit('theme', t);
	}
	Omni.isDark = () => {
		const t = store.get('theme', 'system');
		return t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	};

	function themeSwitch() {
		const opts = [
			['system', 'System'],
			['light', 'Light'],
			['dark', 'Dark'],
		];
		const current = store.get('theme', 'system');
		const buttons = opts.map(([v, label]) =>
			h('button', { type: 'button', 'aria-pressed': String(v === current), onclick: (e) => Omni.motion.themeChange(e, () => {
				store.set('theme', v);
				applyTheme();
			}) }, label),
		);
		// Every copy of the switch (sidebar, settings) follows the stored theme.
		const off = Omni.on('theme', (t) => {
			if (!buttons[0].isConnected) return off();
			buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === t)));
		});
		return h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' }, buttons);
	}
	Omni.themeSwitch = themeSwitch;
	/** Sets the theme from code (Onyx's "dark mode"), with the same reveal as the switch. */
	Omni.setTheme = (t) => Omni.motion.themeChange(null, () => {
		store.set('theme', t);
		applyTheme();
	});

	/* ---------- Layout ---------- */

	let app, nav, view, agentBox, scrim;

	function buildShell() {
		const findBtn = h('button', { type: 'button', class: 'find-button', onclick: openPalette }, icon('search'), h('span', { class: 'label' }, 'Find a tool'), h('span', { class: 'kbd' }, 'Ctrl K'));
		const agentBtn = h('button', { type: 'button', class: 'find-button', onclick: () => toggleAgent() }, h('span', { class: 'label' }, 'Omni Agent'), h('span', { class: 'kbd' }, 'Ctrl J'));
		nav = h('nav', { class: 'nav', 'aria-label': 'Tools' });
		const sidebar = h(
			'aside',
			{ class: 'sidebar', id: 'sidebar' },
			h('div', { class: 'brand' }, h('a', { class: 'brand-name', href: '#/' }, 'OmniTool'), h('span', { class: 'brand-maker' }, 'gklabs')),
			findBtn,
			agentBtn,
			nav,
			h('div', { class: 'sidebar-foot' }, themeSwitch(), h('a', { class: 'btn btn-small btn-quiet', href: '#/settings' }, 'Settings')),
		);
		const topbar = h(
			'header',
			{ class: 'topbar' },
			h('button', { type: 'button', class: 'btn btn-small btn-quiet', 'aria-controls': 'sidebar', 'aria-expanded': 'false', id: 'menu-button', onclick: () => setMenu(!state.menuOpen) }, icon('menu'), 'Tools'),
			h('a', { class: 'brand-name', href: '#/' }, 'OmniTool'),
			h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Find a tool', onclick: openPalette }, icon('search')),
			h('button', { type: 'button', class: 'btn btn-small btn-quiet', onclick: () => toggleAgent() }, 'Agent'),
		);
		view = h('main', { class: 'view', id: 'main', tabindex: '-1' });
		agentBox = h('aside', { class: 'agent', 'aria-label': 'Omni Agent' });
		toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' });
		app = h('div', { class: 'app' }, h('a', { class: 'skip-link', href: '#main', onclick: (e) => (e.preventDefault(), view.focus()) }, 'Skip to content'), sidebar, h('div', { class: 'main' }, topbar, view), agentBox);
		document.body.replaceChildren(app, toastBox);
		if (Omni.agent) Omni.agent.mount(agentBox);
	}

	function setMenu(open) {
		if (open === state.menuOpen) return;
		state.menuOpen = open;
		app.classList.toggle('menu-open', open);
		document.getElementById('menu-button').setAttribute('aria-expanded', String(open));
		if (open) {
			scrim = h('div', { class: 'scrim', onclick: () => setMenu(false) });
			app.appendChild(scrim);
			overlayOpened();
			const first = nav.querySelector('a');
			if (first) first.focus();
		} else {
			if (scrim) scrim.remove();
			overlayClosed();
		}
	}
	const narrow = () => window.matchMedia('(max-width: 899px)').matches;
	const floatingAgent = () => window.matchMedia('(max-width: 1199px)').matches;

	function toggleAgent(force) {
		const open = force != null ? force : !app.classList.contains('agent-docked');
		const was = app.classList.contains('agent-docked');
		app.classList.toggle('agent-docked', open);
		store.set('agentOpen', open);
		if (open !== was && floatingAgent()) open ? overlayOpened() : overlayClosed();
		if (open && Omni.agent) Omni.agent.focus();
		Omni.emit('layout');
	}
	Omni.toggleAgent = toggleAgent;

	function navLink(href, label, count, current) {
		return h('a', { class: 'nav-item', href, 'aria-current': current ? 'page' : null, onclick: () => narrow() && setMenu(false) }, h('span', null, label), count != null ? h('span', { class: 'count' }, count) : null);
	}

	function renderNav() {
		if (!nav) return;
		const r = state.route || { name: 'home' };
		const tools = Omni.tools;
		const groups = [
			h(
				'div',
				{ class: 'nav-group' },
				navLink('#/', 'Catalog', tools.length, r.name === 'home'),
				Omni.byId.labscode ? navLink('#/tool/labscode', 'LabsCode', null, r.name === 'tool' && r.id === 'labscode') : null,
				navLink('#/pinned', 'Pinned', pins().length, r.name === 'pinned'),
				navLink('#/recent', 'Recent', null, r.name === 'recent'),
			),
			h(
				'div',
				{ class: 'nav-group' },
				h('div', { class: 'nav-heading', id: 'nav-cat' }, 'Categories'),
				Omni.categories.map((c) => {
					const n = tools.filter((t) => t.category === c.id).length;
					const here = (r.name === 'category' && r.id === c.id) || (r.name === 'tool' && Omni.byId[r.id] && Omni.byId[r.id].category === c.id && r.id !== 'labscode');
					return n ? navLink('#/c/' + c.id, c.name, n, here) : null;
				}),
			),
		];
		const counts = new Map([...nav.querySelectorAll('.nav-item')].map((a) => [a.getAttribute('href'), a.querySelector('.count') && a.querySelector('.count').textContent]));
		nav.replaceChildren(...groups);
		nav.querySelectorAll('.nav-item').forEach((a) => {
			const c = a.querySelector('.count');
			const was = counts.get(a.getAttribute('href'));
			if (c && was != null && was !== c.textContent) Omni.motion.nudge(c, 'bump');
		});
		Omni.motion.marker(nav, nav.querySelector('[aria-current="page"]'), 'nav-marker');
	}

	/* ---------- Routing ---------- */

	function parse(hash) {
		const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
		if (!parts[0]) return { name: 'home' };
		if (parts[0] === 'tool' && parts[1]) return { name: 'tool', id: parts[1] };
		if (parts[0] === 'c' && parts[1]) return { name: 'category', id: parts[1] };
		if (['pinned', 'recent', 'settings'].includes(parts[0])) return { name: parts[0] };
		return { name: 'missing', hash };
	}

	function go(hash) {
		if (location.hash === hash) route();
		else location.hash = hash;
	}

	/** Opens a tool page, optionally with prefilled inputs (used by Omni Agent and links). */
	Omni.open = function open(id, args, opts) {
		state.pendingArgs = args ? { args, autorun: !!(opts && opts.autorun) } : null;
		go('#/tool/' + encodeURIComponent(id));
	};

	const inView = (el) => {
		if (!el) return false;
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
	};
	const rowFor = (id) => {
		const row = view.querySelector(`.catalog a[data-key="${CSS.escape(id)}"]`);
		return inView(row) ? row : null;
	};

	/** Which elements morph between the page you leave and the one you open. */
	function morphs(from, to) {
		if (to.name === 'tool' && from.name !== 'tool') {
			const row = rowFor(to.id);
			if (!row) return {};
			return {
				before: [[row.querySelector('.no'), 'tool-no'], [row.querySelector('.name'), 'tool-name']],
				after: () => {
					const head = view.querySelector('.tool-head');
					return head ? [[head.querySelector('.tool-no .code'), 'tool-no'], [head.querySelector('h1'), 'tool-name']] : [];
				},
			};
		}
		if (from.name === 'tool' && to.name !== 'tool') {
			const head = view.querySelector('.tool-head');
			if (!inView(head)) return {};
			return {
				before: [[head.querySelector('.tool-no .code'), 'tool-no'], [head.querySelector('h1'), 'tool-name']],
				after: () => {
					const row = rowFor(from.id);
					return row ? [[row.querySelector('.no'), 'tool-no'], [row.querySelector('.name'), 'tool-name']] : [];
				},
			};
		}
		if (to.name === 'category') {
			const item = nav.querySelector(`.nav-item[href="#/c/${CSS.escape(to.id)}"] span`);
			if (!inView(item)) return {};
			return { before: [[item, 'page-title']], after: () => [[view.querySelector('h1'), 'page-title']] };
		}
		return {};
	}

	/** The parts of a page that arrive in reading order. */
	function enterParts(inner) {
		const body = inner.querySelector('.tool-body');
		if (body) return [inner.querySelector('.tool-head'), ...[...body.children].flatMap((c) => (c.classList.contains('io') ? [...c.children] : [c]))];
		return [...inner.children].flatMap((c) => (c.children.length > 1 && !c.matches('.catalog, .tool-head, .home-search, .panel, form') ? [...c.children].slice(0, 4) : [c]));
	}

	function route() {
		const from = state.route;
		const r = parse(location.hash);
		if (!from) return renderRoute(r);
		const m = morphs(from, r);
		Omni.motion.transition(() => renderRoute(r), { before: (m.before || []).filter(([el]) => el), after: () => (m.after ? m.after().filter(([el]) => el) : []) });
	}

	function renderRoute(r) {
		if (state.cleanup) {
			try {
				state.cleanup();
			} catch (err) {
				console.error(err);
			}
			state.cleanup = null;
		}
		state.route = r;
		renderNav();
		if (narrow() && state.menuOpen) setMenu(false);
		const inner = h('div', { class: 'view-inner' });
		view.replaceChildren(inner);
		view.scrollTop = 0;
		try {
			if (r.name === 'home') renderHome(inner);
			else if (r.name === 'category') renderCategory(inner, r.id);
			else if (r.name === 'pinned') renderList(inner, 'Pinned tools', pins(), 'Nothing pinned yet. Open a tool and press Pin to keep it here and at the top of the catalog.');
			else if (r.name === 'recent') renderList(inner, 'Recent tools', recents(), 'Tools you open show up here, newest first.');
			else if (r.name === 'settings') Omni.settingsView(inner);
			else if (r.name === 'tool') renderTool(inner, r.id);
			else renderMissing(inner);
		} catch (err) {
			console.error(err);
			inner.replaceChildren(Omni.forms.stateBox('error', 'This page failed to load.', err.message));
		}
		if (!inner.classList.contains('flush')) Omni.motion.enter(enterParts(inner));
		Omni.emit('route', r);
		// Move focus to the new page's heading so screen readers announce it, unless the person is typing to the agent.
		const heading = inner.querySelector('h1');
		if (heading && r.name !== 'home' && !agentBox.contains(document.activeElement)) {
			heading.setAttribute('tabindex', '-1');
			heading.focus({ preventScroll: true });
		}
	}

	function catalogRows(tools) {
		return h(
			'ul',
			{ class: 'catalog' },
			tools.map((t) => h('li', null, h('a', { href: '#/tool/' + t.id, 'data-key': t.id }, h('span', { class: 'no' }, t.code), h('span', { class: 'name' }, t.name), h('span', { class: 'desc' }, t.description || '')))),
		);
	}

	function section(title, count, body) {
		return h('section', { class: 'catalog-section' }, h('h2', null, title, count != null ? h('span', { class: 'count' }, count) : null), body);
	}

	function renderHome(root) {
		const all = Omni.sortedTools();
		const results = h('div');
		const input = h('input', {
			type: 'search',
			placeholder: 'Name, keyword or number, for example uuid, hex or 044',
			'aria-label': 'Find a tool',
			'aria-describedby': 'home-hint',
			oninput: () => draw(),
			onkeydown: (e) => {
				if (e.key === 'Enter') {
					const first = results.querySelector('a');
					if (first) location.hash = first.getAttribute('href');
				}
			},
		});
		const pinned = pins().map((id) => Omni.byId[id]);
		const recent = recents().map((id) => Omni.byId[id]).slice(0, 6);
		const catalog = h('div');
		const draw = () => {
			const q = input.value.trim();
			const settle = Omni.motion.flip(results, '.catalog a');
			if (q) {
				const hits = Omni.fuzzy.searchTools(q, all).slice(0, 24).map((r) => r.tool);
				results.replaceChildren(hits.length ? section(`Matches for "${q}"`, hits.length, catalogRows(hits)) : Omni.forms.stateBox('empty', `No tool matches "${q}".`, 'Try a shorter word, a category name, or ask Omni Agent (Ctrl J).'));
				catalog.hidden = true;
			} else {
				results.replaceChildren();
				catalog.hidden = false;
			}
			settle();
		};
		const editionNote = Omni.edition === 'web'
			? `${all.length} tools in this web edition. The desktop edition adds ${150 - all.length} that need your computer, such as LabsCode, ping and the process viewer.`
			: `All ${all.length} tools. Ctrl K finds any of them from anywhere.`;
		Omni.append(root, [
			h('div', { class: 'home-search' }, h('h1', null, 'Find a tool'), input, h('p', { class: 'muted', id: 'home-hint' }, editionNote)),
			results,
			Omni.append(catalog, [
				pinned.length ? section('Pinned', pinned.length, catalogRows(pinned)) : null,
				recent.length ? section('Recently used', null, catalogRows(recent)) : null,
				Omni.categories.map((c) => {
					const list = all.filter((t) => t.category === c.id);
					return list.length ? section(c.name, list.length, catalogRows(list)) : null;
				}),
			]),
		]);
		input.focus({ preventScroll: true });
	}

	function renderCategory(root, id) {
		const cat = Omni.category(id);
		if (!cat) return renderMissing(root);
		const list = Omni.sortedTools().filter((t) => t.category === id);
		Omni.append(root, [h('div', { class: 'tool-head' }, h('div', null, h('div', { class: 'tool-no' }, fmt.plural(list.length, 'tool')), h('h1', null, cat.name))), catalogRows(list)]);
	}

	function renderList(root, title, ids, emptyText) {
		const list = ids.map((id) => Omni.byId[id]);
		Omni.append(root, [h('div', { class: 'tool-head' }, h('div', null, h('h1', null, title))), list.length ? catalogRows(list) : Omni.forms.stateBox('empty', null, emptyText, h('a', { class: 'btn btn-small', href: '#/' }, 'Browse the catalog'))]);
	}

	function renderMissing(root) {
		Omni.append(root, [h('h1', null, 'Page not found'), h('p', { class: 'muted', style: { marginTop: '8px' } }, 'That link points to a page OmniTool does not have.'), h('p', { style: { marginTop: '16px' } }, h('a', { class: 'btn', href: '#/' }, 'Back to the catalog'))]);
	}

	function renderTool(root, id) {
		const tool = Omni.byId[id];
		if (!tool) {
			Omni.append(root, [
				h('h1', null, 'Tool not available'),
				h('p', { class: 'muted', style: { marginTop: '8px' } }, Omni.edition === 'web' ? 'This tool needs the desktop edition (see FEATURES.md for why), or the link is wrong.' : 'No tool has that id.'),
				h('p', { style: { marginTop: '16px' } }, h('a', { class: 'btn', href: '#/' }, 'Back to the catalog')),
			]);
			return;
		}
		touchRecent(id);
		document.title = `${tool.name} · OmniTool`;
		const pending = state.pendingArgs;
		state.pendingArgs = null;
		const ctx = {
			tool,
			args: pending ? pending.args : null,
			autorun: pending ? pending.autorun : false,
			store: store.scope('tool.' + tool.id),
			native: Omni.native,
			edition: Omni.edition,
		};
		if (tool.layout === 'flush') {
			root.className = 'view-inner flush';
			state.cleanup = tool.mount(root, ctx) || null;
			return;
		}
		if (tool.layout === 'wide') root.classList.add('wide');
		const pinBtn = h('button', { type: 'button', class: 'btn btn-small btn-quiet', 'aria-pressed': String(pins().includes(id)) });
		const drawPin = () => {
			const on = pins().includes(id);
			pinBtn.setAttribute('aria-pressed', String(on));
			pinBtn.replaceChildren(icon(on ? 'pinned' : 'pin'), on ? 'Pinned' : 'Pin');
		};
		pinBtn.onclick = () => {
			const on = togglePin(id);
			drawPin();
			if (on) Omni.motion.nudge(pinBtn, 'pin-swing');
		};
		drawPin();
		const body = h('div', { class: 'tool-body' });
		const bar = h('div', { class: 'tool-bar' }, h('button', { type: 'button', 'aria-label': `Back to the top of ${tool.name}`, onclick: () => view.scrollTo({ top: 0, behavior: Omni.motion.ok() ? 'smooth' : 'auto' }) }, h('span', { class: 'no' }, `No. ${tool.code}`), h('span', null, tool.name), h('span', { class: 'up' }, 'Back to top')));
		Omni.append(root, [
			bar,
			h('div', { class: 'tool-head' }, h('div', null, h('div', { class: 'tool-no' }, 'No. ', h('span', { class: 'code' }, tool.code), ` · ${Omni.category(tool.category).name}`), h('h1', null, tool.name), tool.description ? h('p', { class: 'tool-desc' }, tool.description) : null), h('div', { class: 'tool-actions' }, pinBtn)),
			body,
		]);
		try {
			state.cleanup = tool.mount ? tool.mount(body, ctx) || null : Omni.forms.renderTool(tool, body, ctx);
		} catch (err) {
			console.error(err);
			body.replaceChildren(Omni.forms.stateBox('error', `${tool.name} failed to open.`, err.message));
		}
		const watch = new IntersectionObserver(([e]) => bar.classList.toggle('shown', !e.isIntersecting && e.boundingClientRect.top < 0), { root: view });
		watch.observe(root.querySelector('.tool-head'));
		const toolCleanup = state.cleanup;
		state.cleanup = () => {
			watch.disconnect();
			if (toolCleanup) toolCleanup();
		};
	}

	/* ---------- Command palette ---------- */

	let paletteOpen = false;
	function openPalette() {
		if (paletteOpen) return;
		paletteOpen = true;
		const all = Omni.sortedTools();
		let selected = 0;
		let items = [];
		const list = h('ul', { class: 'palette-list', role: 'listbox', id: 'palette-list', 'aria-label': 'Tools' });
		const input = h('input', { type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list', 'aria-label': 'Find a tool or command', placeholder: 'Find a tool, or type ? to ask Omni Agent' });
		const commands = [
			{ label: 'Open settings', run: () => go('#/settings'), keywords: 'settings api key preferences' },
			{ label: 'Switch theme', run: () => Omni.motion.themeChange(null, () => {
				const order = ['system', 'light', 'dark'];
				store.set('theme', order[(order.indexOf(store.get('theme', 'system')) + 1) % 3]);
				applyTheme();
				renderNav();
				toast(`Theme: ${store.get('theme')}`);
			}), keywords: 'dark light theme mode' },
			{ label: 'Show or hide Omni Agent', run: () => toggleAgent(), keywords: 'agent ai chat assistant' },
			{ label: 'Go to the catalog', run: () => go('#/'), keywords: 'home catalog all tools' },
		];
		const draw = () => {
			const q = input.value;
			if (q.startsWith('?')) {
				items = [{ kind: 'ask', label: q.slice(1).trim() ? `Ask Omni Agent: ${q.slice(1).trim()}` : 'Type a question for Omni Agent after the ?', q: q.slice(1).trim() }];
			} else {
				const recent = recents();
				const ranked = q.trim()
					? Omni.fuzzy.searchTools(q, all).slice(0, 40)
					: [...recent.map((id) => ({ tool: Omni.byId[id], indices: [] })), ...all.filter((t) => !recent.includes(t.id)).map((t) => ({ tool: t, indices: [] }))].slice(0, 40);
				items = ranked.map((r) => ({ kind: 'tool', ...r }));
				const lower = q.trim().toLowerCase();
				if (lower) commands.filter((c) => c.label.toLowerCase().includes(lower) || c.keywords.includes(lower)).forEach((c) => items.push({ kind: 'command', ...c }));
			}
			selected = Math.min(selected, Math.max(0, items.length - 1));
			const settle = Omni.motion.flip(list, 'li');
			list.replaceChildren(
				...(items.length
					? items.map((it, i) =>
						h(
							'li',
							{ role: 'option', id: 'pal-' + i, 'data-key': it.kind === 'tool' ? it.tool.id : it.kind + ':' + it.label, 'aria-selected': String(i === selected), onclick: () => choose(i), onmousemove: () => i !== selected && select(i) },
							it.kind === 'tool' ? [h('span', { class: 'no' }, it.tool.code), h('span', null, Omni.fuzzy.highlight(it.tool.name, it.indices)), h('span', { class: 'cat' }, Omni.category(it.tool.category).name)] : [h('span', { class: 'no' }, it.kind === 'ask' ? '?' : '>'), h('span', null, it.label), h('span', { class: 'cat' }, it.kind === 'ask' ? 'Omni Agent' : 'Command')],
						),
					)
					: [h('li', { role: 'option', 'aria-disabled': 'true' }, h('span'), h('span', { class: 'muted' }, 'No matches. Start with ? to ask Omni Agent instead.'), h('span'))]),
			);
			input.setAttribute('aria-activedescendant', items.length ? 'pal-' + selected : '');
			settle();
			Omni.motion.marker(list, items.length ? list.querySelectorAll('li')[selected] : null, 'palette-marker');
		};
		const select = (i) => {
			selected = i;
			list.querySelectorAll('li').forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
			input.setAttribute('aria-activedescendant', 'pal-' + i);
			const li = list.querySelectorAll('li')[i];
			if (li) li.scrollIntoView({ block: 'nearest' });
			Omni.motion.marker(list, li, 'palette-marker');
		};
		let closeFn;
		const choose = (i) => {
			const it = items[i];
			if (!it) return;
			closeFn();
			if (it.kind === 'tool') go('#/tool/' + it.tool.id);
			else if (it.kind === 'command') it.run();
			else if (it.kind === 'ask' && it.q) {
				toggleAgent(true);
				Omni.agent && Omni.agent.ask(it.q);
			}
		};
		input.addEventListener('input', () => {
			selected = 0;
			draw();
		});
		input.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				select(Math.min(items.length - 1, selected + 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				select(Math.max(0, selected - 1));
			} else if (e.key === 'Enter') {
				e.preventDefault();
				choose(selected);
			}
		});
		openDialog((dlg, close) => {
			closeFn = () => close();
			dlg.classList.add('palette');
			dlg.setAttribute('aria-label', 'Find a tool');
			Omni.append(dlg, [
				h('div', { class: 'palette-input' }, icon('search'), input),
				list,
				h('div', { class: 'palette-foot' }, h('span', null, h('span', { class: 'kbd' }, 'Enter'), ' open'), h('span', null, h('span', { class: 'kbd' }, 'Up'), ' ', h('span', { class: 'kbd' }, 'Down'), ' move'), h('span', null, h('span', { class: 'kbd' }, 'Esc'), ' close'), h('span', null, h('span', { class: 'kbd' }, '?'), ' ask the agent')),
			]);
			draw();
			setTimeout(() => input.focus(), 0);
			dlg.addEventListener('click', (e) => e.target === dlg && close());
		}).then(() => {
			paletteOpen = false;
		});
	}
	Omni.openPalette = openPalette;

	/* ---------- Keyboard ---------- */

	function onKey(e) {
		const mod = e.ctrlKey || e.metaKey;
		if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			openPalette();
		} else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
			e.preventDefault();
			toggleAgent();
		} else if (e.key === 'Escape' && state.menuOpen) {
			setMenu(false);
			document.getElementById('menu-button').focus();
		} else if (e.key === 'Escape' && app.classList.contains('agent-docked') && floatingAgent() && !document.querySelector('dialog[open]')) {
			toggleAgent(false);
		}
	}

	/* ---------- Start ---------- */

	Omni.start = function start() {
		applyTheme();
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Omni.emit('theme', store.get('theme', 'system')));
		buildShell();
		window.addEventListener('hashchange', route);
		document.addEventListener('keydown', onKey);
		window.addEventListener('resize', Omni.util.debounce(() => {
			if (!narrow() && state.menuOpen) setMenu(false);
			Omni.emit('layout');
		}, 120));
		if (store.get('agentOpen', false) && !floatingAgent()) toggleAgent(true);
		route();
	};
})();
