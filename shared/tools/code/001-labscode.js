// No. 001 LabsCode: OmniTool's copy of LabsCode (the gklabs VS Code fork) docked inside this tab.
Omni.register({
	no: 1,
	id: 'labscode',
	name: 'LabsCode editor',
	category: 'code',
	editions: ['desktop'],
	keywords: ['editor', 'vscode', 'code', 'ide', 'explorer', 'terminal'],
	description: 'The full LabsCode editor: explorer, tabs, highlighting, search, terminal, settings and LabsCode Extras.',
	layout: 'flush',
	ai: false,
	mount(root) {
		const { h } = Omni;
		const lc = Omni.native.labscode;
		const statusText = h('span', { class: 'muted', role: 'status' });
		const actions = h('div', { class: 'row' });
		const hostArea = h('div', { class: 'labscode-host' });
		const body = h('div', { class: 'labscode-host', style: { overflow: 'auto' } });
		const bar = h('div', { class: 'labscode-bar' }, h('span', { class: 'title' }, 'LabsCode'), statusText, actions);
		root.appendChild(h('div', { class: 'labscode-view' }, bar, hostArea));
		let status = null;
		let alive = true;

		// Tell the main process where the editor should sit, in CSS pixels of this page.
		const sync = () => {
			if (!alive) return;
			const r = hostArea.getBoundingClientRect();
			const visible = !!status && status.mode === 'embedded' && Omni.overlays() === 0 && document.visibilityState === 'visible';
			lc.setRect({ x: r.left, y: r.top, w: r.width, h: r.height }, visible);
		};
		const ro = new ResizeObserver(sync);
		ro.observe(hostArea);

		const progress = h('div', { class: 'progress-line', style: { maxWidth: '520px' } }, h('i', { style: { width: '0%' } }));
		const progressText = h('p', { class: 'muted' });
		const btn = (label, onclick, primary) => h('button', { type: 'button', class: 'btn btn-small' + (primary ? ' btn-primary' : ''), onclick }, label);

		const openFolder = async () => {
			const folder = await Omni.native.dialog.openFolder();
			if (folder) lc.openFolder(folder);
		};

		function draw(s) {
			status = s;
			actions.replaceChildren();
			let message = null;
			if (s.installing) {
				statusText.textContent = 'Installing';
				message = h('div', { class: 'panel stack', style: { maxWidth: '640px' } }, h('h2', null, 'Installing LabsCode'), progressText, progress);
			} else if (!s.installed) {
				statusText.textContent = 'Not installed';
				message = h(
					'div',
					{ class: 'panel stack', style: { maxWidth: '640px' } },
					h('h2', null, 'LabsCode is not installed yet'),
					h('p', null, `OmniTool downloads LabsCode ${s.release} (about ${s.downloadMB} MB) from github.com/gkson-lab/labscode into desktop\\vendor. Nothing is installed outside the OmniTool folder.`),
					s.error ? h('p', { class: 'error-text' }, s.error) : null,
					h('div', { class: 'row' }, btn(`Download and install (${s.downloadMB} MB)`, () => lc.install(), true)),
				);
			} else if (s.starting) {
				statusText.textContent = 'Starting';
				message = Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, 'Starting LabsCode. The first start takes a few seconds'));
			} else if (s.running && s.mode === 'embedded') {
				statusText.textContent = s.bridge ? 'Running · Omni Agent can read the active file' : 'Running · connecting Omni Agent';
				actions.append(btn('Open folder', openFolder), btn('Open in its own window', () => lc.undock()));
			} else if (s.running && s.mode === 'window') {
				statusText.textContent = 'Running in its own window';
				message = h('div', { class: 'panel stack', style: { maxWidth: '640px' } }, h('h2', null, 'LabsCode is open in its own window'), s.embedSupported ? null : h('p', { class: 'muted' }, s.embedUnavailableReason), h('div', { class: 'row' }, s.embedSupported ? btn('Bring it inside OmniTool', () => lc.dock(), true) : null, btn('Open folder', openFolder)));
			} else {
				statusText.textContent = s.error && /closed/.test(s.error) ? 'Closed' : 'Stopped';
				message = h('div', { class: 'panel stack', style: { maxWidth: '640px' } }, h('h2', null, s.error && /closed/.test(s.error) ? 'LabsCode was closed' : 'LabsCode is not running'), s.error && !/closed/.test(s.error) ? h('p', { class: 'error-text' }, s.error) : null, h('div', { class: 'row' }, btn('Start LabsCode', () => lc.start(), true), btn('Open a folder in LabsCode', openFolder)));
			}
			body.replaceChildren(message ? h('div', { style: { padding: '32px' } }, message) : '');
			if (message) hostArea.replaceChildren(body);
			else hostArea.replaceChildren();
			sync();
		}

		const offStatus = lc.onStatus((s) => alive && draw(s));
		const offProgress = lc.onProgress((p) => {
			if (p.message) progressText.textContent = p.message;
			if (p.total) {
				progress.firstChild.style.width = `${Math.floor((p.received / p.total) * 100)}%`;
				progressText.textContent = `Downloading: ${Math.floor(p.received / 1048576)} of ${Math.floor(p.total / 1048576)} MB`;
			}
		});
		const offOverlay = Omni.on('overlay', sync);
		const offLayout = Omni.on('layout', () => requestAnimationFrame(sync));
		window.addEventListener('resize', sync);
		document.addEventListener('visibilitychange', sync);

		lc.status().then((s) => {
			draw(s);
			if (s.installed && !s.running && !s.starting && !/closed/.test(s.error || '')) lc.start();
		});

		return () => {
			alive = false;
			ro.disconnect();
			offStatus();
			offProgress();
			offOverlay();
			offLayout();
			window.removeEventListener('resize', sync);
			document.removeEventListener('visibilitychange', sync);
			lc.setRect(null, false);
		};
	},
});
