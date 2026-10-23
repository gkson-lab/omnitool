// Loads OmniTool's shared scripts in order as classic scripts, so index.html works straight from file:// with no server.
(function () {
	'use strict';
	const me = document.currentScript;
	const base = me.src.replace(/loader\.js(\?.*)?$/, '');
	const files = window.OMNI_MANIFEST;
	const extra = (me.dataset.extra || '').split(',').map((s) => s.trim()).filter(Boolean);

	function fail(file) {
		document.body.innerHTML = '';
		const box = document.createElement('div');
		box.style.cssText = 'max-width:640px;margin:10vh auto;padding:24px;font:16px/1.5 system-ui,sans-serif';
		box.innerHTML = '<h1 style="font-size:1.4rem">OmniTool could not load a file</h1><p></p><p>Keep the OmniTool folder structure intact: <code>web</code> and <code>shared</code> must sit side by side.</p>';
		box.querySelector('p').textContent = 'Missing or broken: ' + file;
		document.body.appendChild(box);
	}

	const list = [...files.map((f) => base + f), ...extra];
	let failed = false;
	list.forEach((src, i) => {
		const s = document.createElement('script');
		s.src = src;
		s.async = false;
		s.onerror = () => {
			if (!failed) fail(src);
			failed = true;
		};
		if (i === list.length - 1) {
			s.onload = () => {
				if (failed) return;
				try {
					window.Omni.start();
				} catch (err) {
					console.error(err);
					fail(err.message);
				}
			};
		}
		document.head.appendChild(s);
	});
})();
