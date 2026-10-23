// No. 089 File checksum verifier: hashes a file locally and compares it with the checksum a download page lists.
Omni.register({
	no: 89,
	id: 'checksum',
	name: 'File checksum verifier',
	category: 'text',
	keywords: ['checksum', 'verify', 'file hash', 'sha256', 'md5', 'download', 'integrity'],
	description: 'Hashes a file on this device (SHA-256, SHA-1, SHA-512, MD5) and tells you whether it matches the checksum you expect.',
	action: 'Check file',
	inputs: [
		{ name: 'file', label: 'File', type: 'file' },
		{ name: 'expected', label: 'Expected checksum (optional)', type: 'text', mono: true, placeholder: 'Paste the hash from the download page' },
	],
	async run({ file, expected }) {
		if (!file) return { note: 'Choose a file.' };
		if (file.size > 1024 * 1048576) throw new Error('Files up to 1 GB can be checked in the browser.');
		const B = Omni.bytes;
		const buf = new Uint8Array(await Omni.util.readFile(file, 'buffer'));
		const sums = { 'SHA-256': await B.sha('SHA-256', buf), 'SHA-1': await B.sha('SHA-1', buf), 'SHA-512': await B.sha('SHA-512', buf), MD5: buf.length <= 256 * 1048576 ? B.md5(buf) : 'skipped above 256 MB', CRC32: B.crc32(buf) };
		const readings = Object.entries(sums).map(([label, value]) => ({ label, value }));
		const blocks = [];
		if (expected && expected.trim()) {
			const e = expected.trim().toLowerCase().replace(/^[a-z0-9-]+[:=]\s*/, '').replace(/\s.*$/, '');
			const hit = Object.entries(sums).find(([, v]) => v === e);
			blocks.push(hit ? { type: 'readings', items: [{ label: 'Verdict', value: `Match: the file's ${hit[0]} equals the expected checksum`, copy: false }] } : { type: 'error', message: 'No match. The file differs from the one the checksum was made for, or the checksum uses another algorithm.' });
		}
		return { blocks: [...blocks, { type: 'readings', items: [{ label: 'File', value: `${file.name}, ${Omni.util.fmt.bytes(file.size)}`, copy: false }, ...readings] }] };
	},
});
