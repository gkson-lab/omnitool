// No. 031 ID generator: UUID v4 and v7, ULID and Nano ID, in bulk.
(function () {
	'use strict';
	const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
	const fmtUuid = (b) => {
		const s = hex(b);
		return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
	};

	function uuid4() {
		const b = Omni.random.bytes(16);
		b[6] = (b[6] & 0x0f) | 0x40;
		b[8] = (b[8] & 0x3f) | 0x80;
		return fmtUuid(b);
	}

	/** UUID v7: 48-bit Unix milliseconds, then random bits, so IDs sort by creation time. */
	let lastMs = 0;
	let seq = 0;
	function uuid7() {
		const b = Omni.random.bytes(16);
		let ms = Date.now();
		// Several IDs in one millisecond keep their order through a 12-bit counter in rand_a.
		if (ms <= lastMs) {
			seq++;
			if (seq > 0xfff) {
				lastMs++;
				seq = 0;
			}
			ms = lastMs;
		} else {
			lastMs = ms;
			seq = b[6] & 0x0f;
		}
		for (let i = 5; i >= 0; i--) {
			b[i] = ms % 256;
			ms = Math.floor(ms / 256);
		}
		b[6] = 0x70 | ((seq >> 8) & 0x0f);
		b[7] = seq & 0xff;
		b[8] = (b[8] & 0x3f) | 0x80;
		return fmtUuid(b);
	}

	const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	function ulid() {
		let t = Date.now();
		let time = '';
		for (let i = 0; i < 10; i++) {
			time = CROCKFORD[t % 32] + time;
			t = Math.floor(t / 32);
		}
		const r = Omni.random.bytes(16);
		return time + Array.from(r, (x) => CROCKFORD[x & 31]).join('');
	}

	const NANO = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
	function nanoid(size) {
		// 64-character alphabet, so masking a byte to 6 bits is unbiased.
		return Array.from(Omni.random.bytes(size || 21), (x) => NANO[x & 63]).join('');
	}

	Omni.ids = { uuid4, uuid7, ulid, nanoid };

	Omni.register({
		no: 31,
		id: 'id-generator',
		name: 'ID generator',
		category: 'generate',
		keywords: ['uuid', 'guid', 'ulid', 'nanoid', 'id', 'unique', 'identifier', 'v4', 'v7'],
		description: 'UUID v4 and v7, ULID and Nano ID, one at a time or thousands at once.',
		action: 'Generate',
		inputs: [
			{ name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'uuid4', label: 'UUID v4 (random)' }, { value: 'uuid7', label: 'UUID v7 (time-ordered)' }, { value: 'ulid', label: 'ULID' }, { value: 'nanoid', label: 'Nano ID' }], default: 'uuid4' },
			{ name: 'count', label: 'How many', type: 'number', min: 1, max: 10000, default: 5 },
			{ name: 'size', label: 'Nano ID length', type: 'number', min: 4, max: 64, default: 21, when: (v) => v.kind === 'nanoid' },
			{ name: 'upper', label: 'Uppercase', type: 'checkbox', when: (v) => v.kind.startsWith('uuid') },
			{ name: 'braces', label: 'Wrap in { }', type: 'checkbox', when: (v) => v.kind.startsWith('uuid') },
		],
		run({ kind, count, size, upper, braces }) {
			const n = Math.max(1, Math.min(10000, Math.floor(count || 1)));
			const make = { uuid4, uuid7, ulid, nanoid: () => nanoid(size || 21) }[kind];
			let list = Array.from({ length: n }, make);
			if (kind.startsWith('uuid')) list = list.map((x) => (upper ? x.toUpperCase() : x)).map((x) => (braces ? `{${x}}` : x));
			const text = list.join('\n');
			return { text, label: `${n} ${kind === 'uuid4' ? 'UUID v4' : kind === 'uuid7' ? 'UUID v7' : kind === 'ulid' ? 'ULID' : 'Nano ID'}${n === 1 ? '' : 's'}`, download: n > 1 ? { name: `${kind}s.txt`, data: text + '\n', label: 'Download as a text file' } : null };
		},
	});
})();
