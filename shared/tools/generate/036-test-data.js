// No. 036 Test data generator: obviously fake rows (example.com emails, 555 numbers) for development databases.
Omni.register({
	no: 36,
	id: 'test-data',
	name: 'Test data generator',
	category: 'generate',
	keywords: ['fake', 'test data', 'mock', 'seed', 'dummy', 'json', 'csv', 'sql'],
	description: 'Rows of clearly fake records for testing: generic names, example.com emails, 555 phone numbers, invented towns. Export as JSON, CSV or SQL.',
	action: 'Generate',
	inputs: [
		{ name: 'rows', label: 'Rows', type: 'number', min: 1, max: 10000, default: 10 },
		{ name: 'format', label: 'Format', type: 'select', options: ['JSON', 'CSV', 'SQL'], default: 'JSON' },
		{ name: 'table', label: 'SQL table name', type: 'text', default: 'test_users', when: (v) => v.format === 'SQL' },
		{ name: 'f_id', label: 'id', type: 'checkbox', default: true },
		{ name: 'f_name', label: 'Name', type: 'checkbox', default: true },
		{ name: 'f_email', label: 'Email', type: 'checkbox', default: true },
		{ name: 'f_phone', label: 'Phone', type: 'checkbox', default: false },
		{ name: 'f_address', label: 'Address', type: 'checkbox', default: false },
		{ name: 'f_company', label: 'Company', type: 'checkbox', default: false },
		{ name: 'f_birthdate', label: 'Birth date', type: 'checkbox', default: false },
		{ name: 'f_active', label: 'Active flag', type: 'checkbox', default: true },
		{ name: 'f_score', label: 'Score 0 to 100', type: 'checkbox', default: false },
		{ name: 'f_uuid', label: 'UUID', type: 'checkbox', default: false },
		{ name: 'seed', label: 'Seed (optional)', type: 'text', placeholder: 'Same seed, same rows' },
	],
	run(a) {
		const W = Omni.words;
		const R = Omni.random;
		const rand = R.source(a.seed);
		const n = Math.max(1, Math.min(10000, Math.floor(a.rows || 1)));
		const rows = [];
		for (let i = 0; i < n; i++) {
			const first = R.pick(rand, W.first);
			const last = R.pick(rand, W.last);
			const r = {};
			if (a.f_id) r.id = i + 1;
			if (a.f_uuid) {
				const b = Array.from({ length: 16 }, () => R.int(rand, 0, 255));
				b[6] = (b[6] & 0x0f) | 0x40;
				b[8] = (b[8] & 0x3f) | 0x80;
				const s = b.map((x) => x.toString(16).padStart(2, '0')).join('');
				r.uuid = `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
			}
			if (a.f_name) r.name = `${first} ${last}`;
			// example.com is reserved for documentation (RFC 2606), so these addresses never reach a real person.
			if (a.f_email) r.email = `${first}.${last}${R.int(rand, 1, 99)}@example.com`.toLowerCase();
			// 555-0100 to 555-0199 are reserved fictional numbers in the North American plan.
			if (a.f_phone) r.phone = `+1 555 01${String(R.int(rand, 0, 99)).padStart(2, '0')}`;
			if (a.f_address) r.address = `${R.int(rand, 1, 999)} ${R.pick(rand, W.streets)} ${R.pick(rand, W.streetTypes)}, ${R.pick(rand, W.cities)}`;
			if (a.f_company) r.company = R.pick(rand, W.companies);
			if (a.f_birthdate) r.birthdate = new Date(Date.UTC(R.int(rand, 1950, 2006), R.int(rand, 0, 11), R.int(rand, 1, 28))).toISOString().slice(0, 10);
			if (a.f_active) r.active = R.int(rand, 0, 3) > 0;
			if (a.f_score) r.score = R.int(rand, 0, 100);
			rows.push(r);
		}
		if (!Object.keys(rows[0]).length) throw new Error('Tick at least one field.');
		const cols = Object.keys(rows[0]);
		let text;
		let ext;
		if (a.format === 'CSV') {
			text = Omni.csv.stringify([cols, ...rows.map((r) => cols.map((c) => r[c]))]);
			ext = 'csv';
		} else if (a.format === 'SQL') {
			const t = (a.table || 'test_data').replace(/[^\w.]/g, '_');
			const lit = (v) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `'${String(v).replace(/'/g, "''")}'`);
			text = rows.map((r) => `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map((c) => lit(r[c])).join(', ')});`).join('\n');
			ext = 'sql';
		} else {
			text = JSON.stringify(rows, null, 2);
			ext = 'json';
		}
		return { text, label: `${n} fake rows`, download: { name: `test-data.${ext}`, data: text + '\n', label: `Download test-data.${ext}` }, note: 'All values are invented for testing and are not real people or addresses.' };
	},
});
