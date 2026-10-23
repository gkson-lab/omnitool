// No. 024 HTML, CSS and JS playground: three editors and a sandboxed live preview with its console.
Omni.register({
	no: 24,
	id: 'playground',
	name: 'HTML, CSS and JS playground',
	category: 'code',
	keywords: ['html', 'css', 'javascript', 'playground', 'codepen', 'preview', 'sandbox'],
	description: 'Write HTML, CSS and JavaScript and see the page update live in a sandboxed frame, with its console output.',
	layout: 'wide',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const docs = ctx.store.get('docs', {
			html: '<main>\n  <h1>Hello</h1>\n  <button id="b">Count: 0</button>\n</main>\n',
			css: 'body { font-family: system-ui, sans-serif; padding: 24px; }\nbutton { padding: 8px 14px; font-size: 1rem; }\n',
			js: 'let n = 0;\nconst b = document.getElementById("b");\nb.addEventListener("click", () => {\n  n += 1;\n  b.textContent = `Count: ${n}`;\n  console.log("clicked", n);\n});\n',
		});
		let tab = 'html';
		const editors = {};
		const frame = h('iframe', { class: 'sandbox', sandbox: 'allow-scripts allow-modals', title: 'Preview', style: { minHeight: '420px' } });
		const consoleOut = h('pre', { class: 'readout', style: { maxHeight: '180px' } }, '');
		const auto = h('input', { type: 'checkbox', id: 'pg-auto', checked: ctx.store.get('auto', true), onchange: () => ctx.store.set('auto', auto.checked) });
		const token = Math.random().toString(36).slice(2);
		// The bridge script forwards console calls and errors from the sandbox; it runs before the user's code.
		const bridge = `<script>(function(){var t=${JSON.stringify(token)};function send(k,a){try{parent.postMessage({omniPg:t,kind:k,text:Array.prototype.map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}}['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o.apply(console,arguments)}});addEventListener('error',function(e){send('error',[e.message+' (line '+e.lineno+')'])});})();<\/script>`;
		const render = () => {
			consoleOut.textContent = '';
			frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8">${bridge}<style>${docs.css}</style></head><body>${docs.html}<script>${docs.js.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`;
		};
		const onMessage = (e) => {
			if (!e.data || e.data.omniPg !== token || e.source !== frame.contentWindow) return;
			consoleOut.textContent += `${e.data.kind === 'log' ? '' : e.data.kind + ': '}${e.data.text}\n`;
			consoleOut.scrollTop = consoleOut.scrollHeight;
		};
		window.addEventListener('message', onMessage);
		const persist = Omni.util.debounce(() => ctx.store.set('docs', docs), 300);
		const live = Omni.util.debounce(() => auto.checked && render(), 500);
		const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Editor' });
		const boxes = { html: h('div'), css: h('div', { hidden: true }), js: h('div', { hidden: true }) };
		const drawTabs = () => tabs.replaceChildren(...['html', 'css', 'js'].map((k) => h('button', { type: 'button', role: 'tab', 'aria-pressed': String(k === tab), 'aria-selected': String(k === tab), onclick: () => {
			tab = k;
			Object.entries(boxes).forEach(([n, b]) => (b.hidden = n !== k));
			editors[k] && editors[k].refresh();
			drawTabs();
		} }, k.toUpperCase())));
		drawTabs();
		root.appendChild(h('div', { class: 'io split' },
			h('div', { class: 'panel stack' }, h('div', { class: 'row between' }, tabs, h('div', { class: 'row' }, h('div', { class: 'field check' }, auto, h('label', { for: 'pg-auto' }, 'Update as I type')), h('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: render }, 'Run'))), boxes.html, boxes.css, boxes.js),
			h('div', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Preview'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.util.download('page.html', frame.srcdoc.replace(bridge, ''), 'text/html') }, 'Download page')), frame, h('div', null, h('div', { class: 'out-head' }, h('span', { class: 'label' }, 'Console')), consoleOut)),
		));
		const modes = { html: 'html', css: 'css', js: 'javascript' };
		Promise.all(Object.keys(boxes).map((k) => Omni.editor.create(boxes[k], { value: docs[k], mode: modes[k], height: '420px', label: `${k.toUpperCase()} editor`, onRun: render, onChange: (v) => {
			docs[k] = v;
			persist();
			live();
		} }).then((ed) => (editors[k] = ed)))).then(render);
		return () => window.removeEventListener('message', onMessage);
	},
});
