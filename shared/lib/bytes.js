// Byte helpers and hashes: UTF-8, hex, Base64, MD5, CRC32, plus SHA, HMAC and AES-GCM through WebCrypto.
(function () {
	'use strict';

	const enc = new TextEncoder();
	const dec = new TextDecoder('utf-8', { fatal: false });

	const utf8 = (s) => enc.encode(s);
	const fromUtf8 = (bytes) => dec.decode(bytes);
	const toHex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
	function fromHex(hex) {
		const clean = hex.replace(/[\s:]/g, '');
		if (clean.length % 2 || /[^0-9a-f]/i.test(clean)) throw new Error('That is not valid hex');
		return new Uint8Array(clean.match(/../g).map((x) => parseInt(x, 16)));
	}
	function toBase64(bytes) {
		let bin = '';
		const arr = new Uint8Array(bytes);
		for (let i = 0; i < arr.length; i += 0x8000) bin += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
		return btoa(bin);
	}
	function fromBase64(b64) {
		const clean = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
		const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
		let bin;
		try {
			bin = atob(padded);
		} catch {
			throw new Error('That is not valid Base64');
		}
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	}

	/* MD5 (RFC 1321). WebCrypto has no MD5, and checksums still use it. */
	function md5(bytes) {
		const data = new Uint8Array(bytes);
		const K = new Uint32Array(64);
		for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
		const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
		const len = data.length;
		const padded = new Uint8Array(((len + 8) >> 6) * 64 + 64);
		padded.set(data);
		padded[len] = 0x80;
		const bits = len * 8;
		const view = new DataView(padded.buffer);
		view.setUint32(padded.length - 8, bits >>> 0, true);
		view.setUint32(padded.length - 4, Math.floor(bits / 2 ** 32), true);
		let a0 = 0x67452301;
		let b0 = 0xefcdab89;
		let c0 = 0x98badcfe;
		let d0 = 0x10325476;
		const M = new Uint32Array(16);
		for (let off = 0; off < padded.length; off += 64) {
			for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true);
			let A = a0;
			let B = b0;
			let C = c0;
			let D = d0;
			for (let i = 0; i < 64; i++) {
				let F;
				let g;
				if (i < 16) {
					F = (B & C) | (~B & D);
					g = i;
				} else if (i < 32) {
					F = (D & B) | (~D & C);
					g = (5 * i + 1) % 16;
				} else if (i < 48) {
					F = B ^ C ^ D;
					g = (3 * i + 5) % 16;
				} else {
					F = C ^ (B | ~D);
					g = (7 * i) % 16;
				}
				F = (F + A + K[i] + M[g]) >>> 0;
				A = D;
				D = C;
				C = B;
				B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
			}
			a0 = (a0 + A) >>> 0;
			b0 = (b0 + B) >>> 0;
			c0 = (c0 + C) >>> 0;
			d0 = (d0 + D) >>> 0;
		}
		const out = new DataView(new ArrayBuffer(16));
		[a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true));
		return toHex(out.buffer);
	}

	let crcTable;
	function crc32(bytes) {
		if (!crcTable) {
			crcTable = new Uint32Array(256);
			for (let n = 0; n < 256; n++) {
				let c = n;
				for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
				crcTable[n] = c >>> 0;
			}
		}
		let crc = 0xffffffff;
		const arr = new Uint8Array(bytes);
		for (let i = 0; i < arr.length; i++) crc = crcTable[(crc ^ arr[i]) & 0xff] ^ (crc >>> 8);
		return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
	}

	function subtle() {
		if (!window.crypto || !window.crypto.subtle) throw new Error('This browser blocks WebCrypto on this page. Open OmniTool from a file:// or https:// address.');
		return window.crypto.subtle;
	}

	async function sha(algo, bytes) {
		return toHex(await subtle().digest(algo, bytes));
	}

	async function hmac(algo, keyBytes, msgBytes) {
		const key = await subtle().importKey('raw', keyBytes, { name: 'HMAC', hash: algo }, false, ['sign']);
		return new Uint8Array(await subtle().sign('HMAC', key, msgBytes));
	}

	async function deriveKey(passphrase, salt, iterations) {
		const base = await subtle().importKey('raw', utf8(passphrase), 'PBKDF2', false, ['deriveKey']);
		return subtle().deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
	}

	const ITERATIONS = 310000;
	/** AES-256-GCM with a PBKDF2 key. Output: "omni1." + base64(salt 16 | iv 12 | ciphertext). */
	async function encrypt(text, passphrase) {
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const key = await deriveKey(passphrase, salt, ITERATIONS);
		const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, utf8(text)));
		const out = new Uint8Array(salt.length + iv.length + ct.length);
		out.set(salt);
		out.set(iv, 16);
		out.set(ct, 28);
		return 'omni1.' + toBase64(out);
	}
	async function decrypt(token, passphrase) {
		const body = token.trim().replace(/^omni1\./, '');
		const raw = fromBase64(body);
		if (raw.length < 29) throw new Error('That text is too short to be OmniTool ciphertext');
		const key = await deriveKey(passphrase, raw.slice(0, 16), ITERATIONS);
		try {
			return fromUtf8(await subtle().decrypt({ name: 'AES-GCM', iv: raw.slice(16, 28) }, key, raw.slice(28)));
		} catch {
			throw new Error('Wrong passphrase, or the text was changed or cut');
		}
	}

	Omni.bytes = { utf8, fromUtf8, toHex, fromHex, toBase64, fromBase64, md5, crc32, sha, hmac, encrypt, decrypt };
})();
