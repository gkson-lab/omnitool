// No. 126 Static file server (desktop): serves a folder on this PC only (127.0.0.1) for testing pages and builds.
Omni.register({
	no: 126,
	id: 'file-server',
	name: 'Static file server',
	category: 'system',
	editions: ['desktop'],
	keywords: ['server', 'http server', 'static', 'localhost', 'serve', 'web server', 'preview'],
	description: 'Serves a folder over HTTP on localhost so you can test a static site or a build. Only this PC can reach it.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const n = Omni.native;
		let folder = ctx.store.get('folder', null);
		const folderLabel = h('code', null, folder || 'No folder chosen');
		const port = h('input', { type: 'number', id: 'fs-port', min: 1024, max: 65535, value: ctx.store.get('port', 8080) });
		const status = h('div', { 'aria-live': 'polite' });
		const btn = h('button', { type: 'button', class: 'btn btn-primary' });
		const log = h('pre', { class: 'readout', style: { maxHeight: '260px' } });
		const draw = async () => {
			const s = await n.server.status();
			btn.textContent = s.running ? 'Stop server' : 'Start server';
			status.replaceChildren(s.running ? Omni.forms.readings([{ label: 'Serving', value: s.folder }, { label: 'Address', value: s.url }, { label: 'Requests', value: s.requests, copy: false }]) : Omni.forms.stateBox('empty', null, 'Stopped.'));
			if (s.running) status.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => n.shell.openExternal(s.url) }, 'Open in browser')));
			log.textContent = s.log.join('\n') || 'Requests appear here.';
		};
		btn.onclick = async () => {
			const s = await n.server.status();
			try {
				if (s.running) await n.server.stop();
				else {
					if (!folder) return Omni.ui.toast('Choose a folder first.', { error: true });
					ctx.store.set('port', Number(port.value));
					await n.server.start(folder, Number(port.value) || 8080);
				}
			} catch (err) {
				Omni.ui.toast(err.message, { error: true, title: 'Server did not start.' });
			}
			draw();
		};
		root.appendChild(h('div', { class: 'stack-lg' },
			h('div', { class: 'panel stack' }, h('div', { class: 'row' }, h('p', null, 'Folder: ', folderLabel), h('button', { type: 'button', class: 'btn btn-small', onclick: async () => {
				const f = await n.dialog.openFolder();
				if (f) {
					folder = f;
					ctx.store.set('folder', f);
					folderLabel.textContent = f;
				}
			} }, 'Choose folder')), h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'fs-port' }, 'Port'), port), h('div', { class: 'field' }, btn)), h('p', { class: 'muted', style: { fontSize: '0.84rem' } }, 'Listens on 127.0.0.1 only. index.html is served for folders; paths outside the folder are refused. The server stops when OmniTool closes.')),
			h('section', { class: 'panel stack', 'aria-label': 'Status' }, status, h('h2', null, 'Request log'), log),
		));
		draw();
		const t = setInterval(draw, 2000);
		return () => clearInterval(t);
	},
});
