// No. 149 Typing speed test: words per minute and accuracy on random common words, with saved results.
Omni.register({
	no: 149,
	id: 'typing-test',
	name: 'Typing speed test',
	category: 'fun',
	keywords: ['typing', 'wpm', 'speed', 'test', 'keyboard', 'accuracy', 'practice'],
	description: 'Type random common words for 30, 60 or 120 seconds and get words per minute and accuracy. Your best results are kept.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const length = h('select', { 'aria-label': 'Test length' }, h('option', { value: '30' }, '30 seconds'), h('option', { value: '60' }, '60 seconds'), h('option', { value: '120' }, '2 minutes'));
		length.value = ctx.store.get('length', '60');
		const textEl = h('div', { 'aria-hidden': 'true', style: { fontFamily: 'var(--font-mono)', fontSize: '1.15rem', lineHeight: '2', padding: '12px 16px', borderRadius: 'var(--r-control)', background: 'var(--sunken)', minHeight: '9em', overflow: 'hidden', overflowWrap: 'anywhere' } });
		const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Type the words shown above', placeholder: 'Start typing to begin', style: { fontFamily: 'var(--font-mono)', fontSize: '1.1rem' } });
		const live = h('span', { class: 'mono' });
		const result = h('div', { 'aria-live': 'polite' });
		let words, index, typed, correctChars, totalChars, startAt, timer, done;
		const easy = Omni.words.common.filter((w) => w.length <= 7);
		const render = () => {
			textEl.replaceChildren(...words.slice(index, index + 40).map((w, i) => h('span', { style: { marginRight: '0.6em', fontWeight: i === 0 ? 700 : 400, textDecoration: i === 0 ? 'underline' : 'none', textUnderlineOffset: '6px', color: i === 0 ? 'var(--ink)' : 'var(--muted)' } }, w)));
		};
		const reset = () => {
			const rand = Omni.random.source();
			words = Array.from({ length: 400 }, () => Omni.random.pick(rand, easy));
			index = 0;
			typed = [];
			correctChars = 0;
			totalChars = 0;
			startAt = 0;
			done = false;
			clearInterval(timer);
			input.value = '';
			input.disabled = false;
			live.textContent = `${length.value} s`;
			result.replaceChildren();
			render();
		};
		const finish = () => {
			done = true;
			clearInterval(timer);
			input.disabled = true;
			const minutes = Number(length.value) / 60;
			const wpm = Math.round(correctChars / 5 / minutes);
			const acc = totalChars ? Math.round((correctChars / totalChars) * 100) : 0;
			const history = [{ wpm, acc, secs: Number(length.value), at: Date.now() }, ...ctx.store.get('history', [])].slice(0, 20);
			ctx.store.set('history', history);
			const best = Math.max(...history.map((x) => x.wpm));
			result.replaceChildren(Omni.forms.readings([{ label: 'Words per minute', value: wpm, copy: false }, { label: 'Accuracy', value: `${acc}%`, copy: false }, { label: 'Words typed', value: typed.length, copy: false }, { label: 'Your best', value: `${best} wpm`, copy: false }]), h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => (reset(), input.focus()) }, 'Try again')));
		};
		input.addEventListener('input', () => {
			if (done) return;
			if (!startAt) {
				startAt = Date.now();
				timer = setInterval(() => {
					const left = Number(length.value) - Math.floor((Date.now() - startAt) / 1000);
					live.textContent = `${Math.max(0, left)} s`;
					if (left <= 0) finish();
				}, 200);
			}
			if (input.value.endsWith(' ')) {
				const word = input.value.trim();
				const target = words[index];
				if (word) {
					typed.push(word);
					totalChars += Math.max(word.length, target.length) + 1;
					for (let i = 0; i < Math.min(word.length, target.length); i++) if (word[i] === target[i]) correctChars++;
					if (word === target) correctChars++;
					index++;
					render();
				}
				input.value = '';
			}
		});
		length.addEventListener('change', () => (ctx.store.set('length', length.value), reset()));
		root.appendChild(h('div', { class: 'panel stack', style: { maxWidth: '760px' } }, h('div', { class: 'row between' }, h('div', { class: 'row' }, length, h('button', { type: 'button', class: 'btn', onclick: () => (reset(), input.focus()) }, 'Restart')), live), textEl, input, h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Type each word and press Space. Words per minute counts five correct characters as one word.'), result));
		reset();
		return () => clearInterval(timer);
	},
});
