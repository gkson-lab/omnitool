// No. 109 Focus noise: white, pink or brown noise generated live with Web Audio, with an optional stop timer.
(function () {
	'use strict';
	let audio = null;
	let stopTimer = null;

	function buffer(ctx, kind) {
		const len = ctx.sampleRate * 4;
		const buf = ctx.createBuffer(2, len, ctx.sampleRate);
		for (let ch = 0; ch < 2; ch++) {
			const d = buf.getChannelData(ch);
			let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
			for (let i = 0; i < len; i++) {
				const w = Math.random() * 2 - 1;
				if (kind === 'white') d[i] = w * 0.5;
				else if (kind === 'pink') {
					// Paul Kellet's filter: approximately -3 dB per octave.
					b0 = 0.99886 * b0 + w * 0.0555179;
					b1 = 0.99332 * b1 + w * 0.0750759;
					b2 = 0.969 * b2 + w * 0.153852;
					b3 = 0.8665 * b3 + w * 0.3104856;
					b4 = 0.55 * b4 + w * 0.5329522;
					b5 = -0.7616 * b5 - w * 0.016898;
					d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
					b6 = w * 0.115926;
				} else {
					// Brown noise: integrated white noise, -6 dB per octave.
					last = (last + 0.02 * w) / 1.02;
					d[i] = last * 3.5;
				}
			}
		}
		return buf;
	}

	function stop() {
		clearTimeout(stopTimer);
		if (audio) {
			const { ctx, gain } = audio;
			gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
			setTimeout(() => ctx.close(), 1200);
		}
		audio = null;
		Omni.emit('noise');
	}

	function play(kind, volume, minutes) {
		stop();
		const ctx = new (window.AudioContext || window.webkitAudioContext)();
		const src = ctx.createBufferSource();
		src.buffer = buffer(ctx, kind);
		src.loop = true;
		const gain = ctx.createGain();
		gain.gain.value = 0;
		gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.4);
		src.connect(gain).connect(ctx.destination);
		src.start();
		audio = { ctx, gain, kind, endsAt: minutes ? Date.now() + minutes * 60000 : 0 };
		if (minutes) stopTimer = setTimeout(stop, minutes * 60000);
		Omni.emit('noise');
	}

	Omni.register({
		no: 109,
		id: 'focus-noise',
		name: 'Focus noise',
		category: 'productivity',
		keywords: ['noise', 'white noise', 'pink noise', 'brown noise', 'focus', 'sleep', 'ambient', 'sound'],
		description: 'White, pink or brown noise generated on this device, with volume and an optional stop timer. Keeps playing while you use other tools.',
		ai: false,
		mount(root, ctx) {
			const { h } = Omni;
			const kind = h('select', { id: 'fn-kind' }, h('option', { value: 'pink' }, 'Pink (balanced, rain-like)'), h('option', { value: 'brown' }, 'Brown (deep, waterfall-like)'), h('option', { value: 'white' }, 'White (bright hiss)'));
			kind.value = ctx.store.get('kind', 'pink');
			const vol = h('input', { type: 'range', id: 'fn-vol', min: 0, max: 1, step: 0.05, value: ctx.store.get('volume', 0.4) });
			const mins = h('select', { id: 'fn-mins' }, [['0', 'Until I stop it'], ['15', '15 minutes'], ['25', '25 minutes'], ['45', '45 minutes'], ['60', '1 hour'], ['120', '2 hours']].map(([v, l]) => h('option', { value: v }, l)));
			const btn = h('button', { type: 'button', class: 'btn btn-primary' });
			const status = h('p', { class: 'muted', role: 'status' });
			const draw = () => {
				btn.textContent = audio ? 'Stop' : 'Play';
				status.textContent = audio ? `Playing ${audio.kind} noise${audio.endsAt ? `, stops at ${new Date(audio.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.` : 'Stopped.';
			};
			btn.onclick = () => {
				ctx.store.set('kind', kind.value);
				ctx.store.set('volume', Number(vol.value));
				if (audio) stop();
				else play(kind.value, Number(vol.value), Number(mins.value));
			};
			vol.addEventListener('input', () => {
				ctx.store.set('volume', Number(vol.value));
				if (audio) audio.gain.gain.setTargetAtTime(Number(vol.value), audio.ctx.currentTime, 0.1);
			});
			kind.addEventListener('change', () => audio && play(kind.value, Number(vol.value), Number(mins.value)));
			root.appendChild(h('div', { class: 'panel stack' }, h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'fn-kind' }, 'Sound'), kind), h('div', { class: 'field' }, h('label', { for: 'fn-vol' }, 'Volume'), vol), h('div', { class: 'field' }, h('label', { for: 'fn-mins' }, 'Stop after'), mins)), h('div', { class: 'row' }, btn), status));
			draw();
			return Omni.on('noise', draw);
		},
	});
})();
