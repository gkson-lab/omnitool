// No. 094 Text to speech: reads text aloud with the voices installed on this device.
Omni.register({
	no: 94,
	id: 'tts',
	name: 'Text to speech',
	category: 'text',
	keywords: ['speech', 'tts', 'read aloud', 'voice', 'speak', 'narrate', 'accessibility'],
	description: 'Reads text aloud with the voices your system provides. Choose the voice, speed and pitch; pause and resume as it reads.',
	ai: false,
	mount(root, ctx) {
		const { h } = Omni;
		const synth = window.speechSynthesis;
		if (!synth) {
			root.appendChild(Omni.forms.stateBox('error', 'Speech is not available.', 'This browser does not support the Web Speech API. Try Edge or Chrome.'));
			return;
		}
		const text = h('textarea', { id: 'tts-text', rows: 8 });
		text.value = ctx.store.get('text', 'OmniTool can read this text out loud. Pick a voice, set the speed, and press Speak.');
		const voice = h('select', { id: 'tts-voice' });
		const rate = h('input', { type: 'range', id: 'tts-rate', min: 0.5, max: 2, step: 0.1, value: ctx.store.get('rate', 1) });
		const pitch = h('input', { type: 'range', id: 'tts-pitch', min: 0.5, max: 2, step: 0.1, value: ctx.store.get('pitch', 1) });
		const status = h('p', { class: 'muted', role: 'status' }, 'Ready.');
		const fillVoices = () => {
			const voices = synth.getVoices();
			if (!voices.length) {
				voice.replaceChildren(h('option', { value: '' }, 'System default'));
				return;
			}
			const saved = ctx.store.get('voice', '');
			voice.replaceChildren(...voices.map((v) => h('option', { value: v.name }, `${v.name} (${v.lang})${v.localService ? '' : ', online'}`)));
			if (voices.some((v) => v.name === saved)) voice.value = saved;
			else {
				const def = voices.find((v) => v.default) || voices.find((v) => v.lang.startsWith(navigator.language.slice(0, 2)));
				if (def) voice.value = def.name;
			}
		};
		fillVoices();
		synth.addEventListener('voiceschanged', fillVoices);
		const speak = () => {
			synth.cancel();
			if (!text.value.trim()) return;
			ctx.store.set('text', text.value);
			ctx.store.set('voice', voice.value);
			ctx.store.set('rate', rate.value);
			ctx.store.set('pitch', pitch.value);
			const u = new SpeechSynthesisUtterance(text.value);
			const v = synth.getVoices().find((x) => x.name === voice.value);
			if (v) u.voice = v;
			u.rate = Number(rate.value);
			u.pitch = Number(pitch.value);
			u.onstart = () => (status.textContent = 'Speaking.');
			u.onend = () => (status.textContent = 'Finished.');
			u.onerror = (e) => (status.textContent = e.error === 'interrupted' || e.error === 'canceled' ? 'Stopped.' : `Speech failed: ${e.error}.`);
			synth.speak(u);
		};
		root.appendChild(h('div', { class: 'panel stack' },
			h('div', { class: 'field' }, h('label', { for: 'tts-text' }, 'Text'), text),
			h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'tts-voice' }, 'Voice'), voice), h('div', { class: 'field' }, h('label', { for: 'tts-rate' }, 'Speed'), rate), h('div', { class: 'field' }, h('label', { for: 'tts-pitch' }, 'Pitch'), pitch)),
			h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: speak }, 'Speak'), h('button', { type: 'button', class: 'btn', onclick: () => (synth.speaking && !synth.paused ? (synth.pause(), (status.textContent = 'Paused.')) : (synth.resume(), (status.textContent = 'Speaking.'))) }, 'Pause or resume'), h('button', { type: 'button', class: 'btn', onclick: () => synth.cancel() }, 'Stop')),
			status,
		));
		return () => {
			synth.cancel();
			synth.removeEventListener('voiceschanged', fillVoices);
		};
	},
});
