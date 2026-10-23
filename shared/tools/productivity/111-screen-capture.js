// No. 111 Screen capture (desktop): grabs a screen or window as PNG; you choose where it is saved.
Omni.register({
	no: 111,
	id: 'screen-capture',
	name: 'Screen capture',
	category: 'productivity',
	editions: ['desktop'],
	keywords: ['screenshot', 'screen capture', 'snip', 'png', 'window'],
	description: 'Captures a whole screen or one window as a PNG. Preview it, copy it to the clipboard, or save it where you choose.',
	ai: false,
	mount(root) {
		const { h, icon } = Omni;
		const n = Omni.native;
		const grid = h('div', { class: 'swatches', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' } });
		const result = h('div', { 'aria-live': 'polite' });
		const delay = h('select', { id: 'cap-delay' }, h('option', { value: '0' }, 'No delay'), h('option', { value: '3' }, '3 seconds'), h('option', { value: '5' }, '5 seconds'));
		const load = async () => {
			grid.replaceChildren(Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, 'Listing screens and windows')));
			try {
				const sources = await n.capture.sources();
				grid.replaceChildren(...sources.map((s) => h('button', { type: 'button', class: 'swatch', onclick: () => grab(s) }, h('img', { src: s.thumbnail, alt: '', style: { width: '100%', height: '120px', objectFit: 'contain', background: 'var(--sunken)' } }), h('span', { class: 'swatch-label' }, s.name))));
			} catch (err) {
				grid.replaceChildren(Omni.forms.stateBox('error', 'Could not list screens.', err.message));
			}
		};
		const grab = async (s) => {
			const wait = Number(delay.value);
			result.replaceChildren(Omni.forms.stateBox('loading', null, h('span', { class: 'loading-text' }, wait ? `Capturing ${s.name} in ${wait} seconds` : `Capturing ${s.name}`)));
			if (wait) await new Promise((r) => setTimeout(r, wait * 1000));
			try {
				const png = await n.capture.grab(s.id);
				const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
				result.replaceChildren(
					Omni.forms.block(`${s.name}`, h('div', { class: 'preview-box' }, h('img', { src: png, alt: `Capture of ${s.name}` }))),
					h('div', { class: 'row', style: { marginTop: '12px' } },
						h('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
							const path = await n.dialog.saveFile({ defaultPath: `capture-${stamp}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] });
							if (!path) return;
							await n.fs.writeBase64(path, png.split(',')[1]);
							Omni.ui.toast(`Saved ${path}`);
						} }, 'Save PNG'),
						h('button', { type: 'button', class: 'btn', onclick: () => (n.clipboard.writeImage(png), Omni.ui.toast('Image copied to the clipboard')) }, icon('copy'), 'Copy image'),
					),
				);
			} catch (err) {
				result.replaceChildren(Omni.forms.stateBox('error', 'Capture failed.', err.message));
			}
		};
		root.appendChild(h('div', { class: 'stack-lg' },
			h('div', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Choose what to capture'), h('div', { class: 'row' }, h('label', { for: 'cap-delay', class: 'field-label' }, 'Delay'), delay, h('button', { type: 'button', class: 'btn btn-small', onclick: load }, 'Refresh list'))), grid),
			h('section', { class: 'panel', 'aria-label': 'Capture' }, result),
		));
		result.appendChild(Omni.forms.stateBox('empty', null, 'Pick a screen or window above.'));
		load();
	},
});
