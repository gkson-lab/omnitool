// No. 063 Morse code translator: text to Morse and back, with audio playback at a chosen speed.
(function () {
	'use strict';
	const CODE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.' };
	const BACK = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
	let audio = null;

	function play(morse, wpm) {
		stop();
		const ctx = new (window.AudioContext || window.webkitAudioContext)();
		const unit = 1.2 / wpm;
		let t = ctx.currentTime + 0.05;
		const gain = ctx.createGain();
		gain.gain.value = 0;
		gain.connect(ctx.destination);
		const osc = ctx.createOscillator();
		osc.frequency.value = 650;
		osc.connect(gain);
		for (const ch of morse) {
			if (ch === '.' || ch === '-') {
				const len = ch === '.' ? unit : unit * 3;
				gain.gain.setValueAtTime(0.25, t);
				gain.gain.setValueAtTime(0, t + len);
				t += len + unit;
			} else if (ch === ' ') t += unit * 2;
			else if (ch === '/') t += unit * 4;
		}
		osc.start();
		osc.stop(t + 0.05);
		audio = ctx;
		osc.onended = () => ctx.close();
		return t - ctx.currentTime;
	}
	function stop() {
		if (audio && audio.state !== 'closed') audio.close();
		audio = null;
	}

	Omni.register({
		no: 63,
		id: 'morse',
		name: 'Morse code translator',
		category: 'convert',
		keywords: ['morse', 'code', 'telegraph', 'sos', 'audio', 'cw'],
		description: 'Translates text to Morse code and back, and plays it as audio at the speed you choose.',
		live: true,
		inputs: [
			{ name: 'mode', label: 'Direction', type: 'seg', options: [{ value: 'encode', label: 'Text to Morse' }, { value: 'decode', label: 'Morse to text' }], default: 'encode' },
			{ name: 'text', label: 'Input', type: 'textarea', rows: 4, default: 'SOS from OmniTool' },
			{ name: 'wpm', label: 'Playback speed (words per minute)', type: 'number', min: 5, max: 40, default: 18 },
		],
		run({ mode, text, wpm }) {
			let morse;
			let plain;
			if (mode === 'encode') {
				const unknown = new Set();
				morse = text.toUpperCase().trim().split(/\s+/).map((w) => [...w].map((c) => CODE[c] || (unknown.add(c), '')).filter(Boolean).join(' ')).join(' / ');
				plain = text;
				if (unknown.size) plain += `\n(Skipped characters with no Morse code: ${[...unknown].join(' ')})`;
			} else {
				morse = text.trim().replace(/[·•]/g, '.').replace(/[–—_]/g, '-');
				plain = morse.split(/\s*\/\s*|\s{3,}/).map((w) => w.split(/\s+/).map((c) => BACK[c] || (c ? '?' : '')).join('')).join(' ');
			}
			const { h } = Omni;
			const controls = h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => play(morse, Math.max(5, Math.min(40, wpm || 18))) }, 'Play audio'), h('button', { type: 'button', class: 'btn', onclick: stop }, 'Stop'));
			return { blocks: [{ type: 'text', label: 'Morse', value: morse }, mode === 'decode' ? { type: 'text', label: 'Text', value: plain } : null, { type: 'node', node: controls }].filter(Boolean) };
		},
	});
})();
