// No. 116 DNS lookup: the system resolver on desktop, Cloudflare DNS over HTTPS in the web edition.
Omni.register({
	no: 116,
	id: 'dns',
	name: 'DNS lookup',
	category: 'system',
	keywords: ['dns', 'lookup', 'nslookup', 'dig', 'mx', 'txt', 'cname', 'records', 'domain'],
	description: 'Looks up A, AAAA, MX, TXT, NS, CNAME and SOA records. Desktop uses your system resolver; the web edition asks Cloudflare (1.1.1.1) over HTTPS.',
	action: 'Look up',
	inputs: [
		{ name: 'name', label: 'Domain', type: 'text', default: 'example.com' },
		{ name: 'type', label: 'Record type', type: 'select', options: ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA'], default: 'A' },
	],
	async run({ name, type }) {
		const domain = String(name).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
		if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('Enter a domain like example.com.');
		if (Omni.native) {
			const r = await Omni.native.net.dns(domain, type);
			return { table: { label: `${type} records for ${domain} (system resolver)`, columns: ['Value'], rows: r.length ? r.map((x) => [x]) : [['No records of this type']] } };
		}
		let res;
		try {
			res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
		} catch {
			throw new Error('Could not reach cloudflare-dns.com. Check your internet connection.');
		}
		if (!res.ok) throw new Error(`The DNS service answered ${res.status}.`);
		const data = await res.json();
		const status = { 0: 'OK', 2: 'Server failure', 3: 'Domain does not exist (NXDOMAIN)', 5: 'Refused' }[data.Status] || `code ${data.Status}`;
		const types = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT', 28: 'AAAA', 257: 'CAA' };
		const rows = (data.Answer || []).map((a) => [types[a.type] || a.type, a.name, a.TTL, a.data]);
		return { readings: [{ label: 'Status', value: status, copy: false }, { label: 'DNSSEC validated', value: data.AD ? 'yes' : 'no', copy: false }], table: { label: `Answers (via Cloudflare DNS over HTTPS)`, columns: ['Type', 'Name', 'TTL', 'Value'], rows: rows.length ? rows : [['', '', '', 'No records of this type']], numeric: [2] } };
	},
});
