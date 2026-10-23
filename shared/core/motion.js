// Motion for OmniTool (DESIGN.md, MOTION 3): parts slide along rails, ink lines draw, ticks fill.
// Every effect answers "where did I come from" or "what just changed", and finishes instantly under reduced motion.
(function () {
	'use strict';

	const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const ok = () => !reducedQuery.matches && !document.hidden;
	const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
	const SWING = 'cubic-bezier(0.34, 1.4, 0.64, 1)';

	/* ---------- Page changes ---------- */

	let running = null;
	/**
	 * Runs `update` (a synchronous DOM change) inside a view transition when the browser has them, so elements that
	 * share a view-transition-name morph from the old page to the new one. `names` pairs old and new elements.
	 */
	function transition(update, opts) {
		const o = opts || {};
		if (!ok() || !document.startViewTransition) {
			update();
			return Promise.resolve();
		}
		if (running) running.skipTransition();
		const tagged = [];
		const tag = (el, name) => {
			if (!el) return;
			el.style.viewTransitionName = name;
			tagged.push(el);
		};
		(o.before || []).forEach(([el, name]) => tag(el, name));
		if (o.root) document.documentElement.classList.add(o.root);
		const vt = document.startViewTransition(() => {
			// The old page is captured by now; its names move to the matching elements on the new page.
			tagged.splice(0).forEach((el) => (el.style.viewTransitionName = ''));
			update();
			(o.after ? o.after() : []).forEach(([el, name]) => tag(el, name));
		});
		running = vt;
		const done = () => {
			tagged.splice(0).forEach((el) => (el.style.viewTransitionName = ''));
			if (o.root) document.documentElement.classList.remove(o.root);
			if (running === vt) running = null;
		};
		vt.finished.then(done, done);
		return vt.finished.catch(() => {});
	}

	/** Staggers the arrival of a page's main parts so they come in reading order: header, inputs, result. */
	function enter(parts) {
		if (!ok()) return;
		parts.filter(Boolean).slice(0, 8).forEach((el, i) => {
			el.style.setProperty('--enter-i', i);
			el.classList.add('enter-item');
			el.addEventListener('animationend', () => {
				el.classList.remove('enter-item');
				el.style.removeProperty('--enter-i');
			}, { once: true });
		});
	}

	/* ---------- Lists that re-rank ---------- */

	/**
	 * FLIP for keyed lists: call before re-rendering, then call the returned function after. Items with the same
	 * data-key slide from their old place; new items rise in, a few at a time.
	 */
	function flip(container, selector, opts) {
		if (!ok() || !container) return () => {};
		const duration = (opts && opts.duration) || 260;
		const before = new Map();
		container.querySelectorAll(selector).forEach((el) => before.set(el.dataset.key, el.getBoundingClientRect()));
		return () => {
			let fresh = 0;
			container.querySelectorAll(selector).forEach((el) => {
				const old = before.get(el.dataset.key);
				const now = el.getBoundingClientRect();
				if (old) {
					const dx = old.left - now.left;
					const dy = old.top - now.top;
					if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing: EASE });
				} else if (fresh < 10 && now.bottom > 0 && now.top < window.innerHeight) {
					el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay: fresh++ * 24, easing: EASE, fill: 'backwards' });
				}
			});
		};
	}

	/* ---------- Indicators that travel ---------- */

	const markers = new WeakMap();
	/** Moves a marker inside `container` onto `target` (the sidebar's current page, the palette's selection). */
	function marker(container, target, className) {
		// The marker survives its container being re-rendered, so it can slide from where it last was.
		let m = markers.get(container);
		if (!m) {
			m = { el: document.createElement('span'), rect: null };
			m.el.className = className;
			m.el.setAttribute('aria-hidden', 'true');
			markers.set(container, m);
		}
		if (m.el.parentNode !== container) container.prepend(m.el);
		if (!target) {
			m.el.style.opacity = '0';
			m.rect = null;
			return;
		}
		const rect = { top: target.offsetTop, left: target.offsetLeft, width: target.offsetWidth, height: target.offsetHeight };
		Object.assign(m.el.style, { opacity: '1', transform: `translate(${rect.left}px, ${rect.top}px)`, width: rect.width + 'px', height: rect.height + 'px' });
		if (m.rect && ok() && (m.rect.top !== rect.top || m.rect.left !== rect.left)) {
			m.el.animate(
				[{ transform: `translate(${m.rect.left}px, ${m.rect.top}px)`, width: m.rect.width + 'px', height: m.rect.height + 'px' }, { transform: `translate(${rect.left}px, ${rect.top}px)`, width: rect.width + 'px', height: rect.height + 'px' }],
				{ duration: 280, easing: EASE },
			);
		}
		m.rect = rect;
	}

	/* Segmented controls get a thumb that slides to the pressed option. One observer covers every .seg in the app. */
	function placeThumb(seg) {
		const pressed = seg.querySelector(':scope > button[aria-pressed="true"]');
		if (!seg.classList.contains('has-thumb')) {
			seg.classList.add('has-thumb');
		}
		marker(seg, pressed && pressed.offsetWidth ? pressed : null, 'seg-thumb');
	}
	const segObserver = new MutationObserver((records) => {
		const touched = new Set();
		for (const r of records) {
			if (r.type === 'attributes') {
				const seg = r.target.closest && r.target.closest('.seg');
				if (seg) touched.add(seg);
			} else {
				r.addedNodes.forEach((n) => {
					if (n.nodeType !== 1) return;
					if (n.matches('.seg')) touched.add(n);
					n.querySelectorAll('.seg').forEach((s) => touched.add(s));
				});
			}
		}
		touched.forEach((seg) => seg.isConnected && placeThumb(seg));
	});
	const segResize = new ResizeObserver((entries) => entries.forEach((e) => e.target.isConnected && placeThumb(e.target)));
	function watchSegs() {
		segObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed'] });
		document.querySelectorAll('.seg').forEach(placeThumb);
		new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => {
			if (n.nodeType !== 1) return;
			[n, ...n.querySelectorAll('.seg')].filter((x) => x.matches('.seg')).forEach((s) => segResize.observe(s));
		}))).observe(document.body, { subtree: true, childList: true });
	}

	/* ---------- Results that change ---------- */

	/** What a result area shows now, so the next render can tell what changed. */
	function capture(container) {
		const readings = new Map();
		container.querySelectorAll('.reading').forEach((r) => {
			const dt = r.querySelector('dt');
			const dd = r.querySelector('dd > span');
			if (dt && dd) readings.set(dt.textContent, dd.textContent);
		});
		const scales = new Map();
		container.querySelectorAll('.meter').forEach((m) => scales.set(m.getAttribute('aria-label'), m.querySelectorAll('.scale i.on').length));
		const texts = new Map();
		container.querySelectorAll('.out-block').forEach((b, i) => {
			const label = b.querySelector('.out-head .label');
			texts.set(label ? label.textContent : '#' + i, b.textContent);
		});
		return { readings, scales, texts, empty: !container.querySelector('.out-block') };
	}

	/** Old value slides up and out, new value slides in: shows which readings an edit changed. */
	function roll(span, oldText) {
		const cell = span.parentNode;
		const ghost = document.createElement('span');
		ghost.className = 'roll-out';
		ghost.textContent = oldText;
		ghost.setAttribute('aria-hidden', 'true');
		cell.classList.add('rolling');
		ghost.style.left = span.offsetLeft + 'px';
		ghost.style.top = span.offsetTop + 'px';
		cell.insertBefore(ghost, span);
		ghost.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }], { duration: 200, easing: EASE }).finished.finally(() => {
			ghost.remove();
			cell.classList.remove('rolling');
		});
		span.animate([{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: EASE });
	}

	/** Fills a scale tick by tick from `from` to its current reading. */
	function fill(scaleEl, from) {
		const ticks = [...scaleEl.querySelectorAll('i')];
		const to = ticks.filter((t) => t.classList.contains('on')).length;
		if (from === to) return;
		ticks.forEach((t, i) => t.classList.toggle('on', i < from));
		scaleEl.classList.add('filling');
		void scaleEl.offsetWidth;
		const step = Math.min(18, 260 / Math.max(1, Math.abs(to - from)));
		ticks.forEach((t, i) => {
			const changes = to > from ? i >= from && i < to : i >= to && i < from;
			t.style.transitionDelay = changes ? `${Math.round((to > from ? i - from : from - 1 - i) * step)}ms` : '0ms';
			t.classList.toggle('on', i < to);
		});
		setTimeout(() => {
			scaleEl.classList.remove('filling');
			ticks.forEach((t) => (t.style.transitionDelay = ''));
		}, 600);
	}

	/**
	 * After a result renders: roll changed readings, fill scales from their old level, and on a fresh run (the user
	 * pressed the button) sweep an ink line over blocks whose content changed. `chance` scrambles new draws first.
	 */
	function landed(container, before, opts) {
		if (!ok() || !before) return;
		const o = opts || {};
		container.querySelectorAll('.reading').forEach((r) => {
			const dt = r.querySelector('dt');
			const dd = r.querySelector('dd > span');
			if (!dt || !dd || !before.readings.has(dt.textContent)) return;
			const old = before.readings.get(dt.textContent);
			if (old !== dd.textContent && !o.chance) roll(dd, old);
		});
		container.querySelectorAll('.meter').forEach((m) => {
			const label = m.getAttribute('aria-label');
			fill(m.querySelector('.scale'), before.scales.has(label) ? before.scales.get(label) : 0);
		});
		if (o.fresh || before.empty) {
			container.querySelectorAll('.out-block').forEach((b, i) => {
				const label = b.querySelector('.out-head .label');
				const key = label ? label.textContent : '#' + i;
				if (before.texts.get(key) === b.textContent && !o.chance) return;
				b.classList.remove('landed');
				void b.offsetWidth;
				b.classList.add('landed');
				b.addEventListener('animationend', () => b.classList.remove('landed'), { once: true });
			});
		}
		if (o.chance && o.fresh) {
			const targets = [...container.querySelectorAll('.readout.big, .reading dd > span')].slice(0, 6);
			targets.forEach((el) => scramble(el, typeof o.chance === 'function' ? o.chance : null));
		}
	}

	/** Shows random candidates for a moment before the real draw, so a repeat result still visibly happens. */
	function scramble(el, pick) {
		const final = el.textContent;
		if (!final || final.length > 80) return;
		const randomize = pick || ((text) => text.replace(/\d/g, () => String(Math.floor(Math.random() * 10))));
		el.setAttribute('aria-busy', 'true');
		el.classList.add('scrambling');
		let frames = 0;
		const timer = setInterval(() => {
			if (++frames > 9 || !el.isConnected) {
				clearInterval(timer);
				el.textContent = final;
				el.removeAttribute('aria-busy');
				el.classList.remove('scrambling');
				el.animate([{ transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 220, easing: SWING });
				return;
			}
			el.textContent = randomize(final);
		}, 42);
	}

	/* ---------- Small confirmations ---------- */

	/** Runs an exit animation (a CSS class with an animation) before `done`, or calls it at once. */
	function exit(el, className, done) {
		if (!ok() || !el.isConnected) return done();
		el.classList.add(className);
		let finished = false;
		const end = () => {
			if (finished) return;
			finished = true;
			done();
		};
		el.addEventListener('animationend', end, { once: true });
		setTimeout(end, 260);
	}

	/** A one-shot nudge (a CSS class with an animation), restarted if it is already running. */
	function nudge(el, className) {
		if (!ok() || !el) return;
		el.classList.remove(className);
		void el.offsetWidth;
		el.classList.add(className);
		el.addEventListener('animationend', () => el.classList.remove(className), { once: true });
	}

	/** The theme spreads as a circle from the control that changed it. */
	function themeChange(event, update) {
		if (!ok() || !document.startViewTransition) return update();
		const src = event && event.currentTarget && event.currentTarget.getBoundingClientRect ? event.currentTarget.getBoundingClientRect() : null;
		const x = event && event.clientX ? event.clientX : src ? src.left + src.width / 2 : window.innerWidth / 2;
		const y = event && event.clientY ? event.clientY : src ? src.top + src.height / 2 : window.innerHeight / 2;
		const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
		const root = document.documentElement.style;
		root.setProperty('--reveal-x', x + 'px');
		root.setProperty('--reveal-y', y + 'px');
		root.setProperty('--reveal-r', r + 'px');
		return transition(update, { root: 'theme-reveal' });
	}

	Omni.motion = { ok, transition, enter, flip, marker, capture, landed, roll, fill, scramble, exit, nudge, themeChange, EASE, SWING };
	if (document.body) watchSegs();
	else document.addEventListener('DOMContentLoaded', watchSegs);
})();
