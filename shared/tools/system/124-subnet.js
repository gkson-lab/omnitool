// No. 124 Subnet calculator: network, broadcast, host range and masks for an IPv4 address in CIDR form.
Omni.register({
	no: 124,
	id: 'subnet',
	name: 'Subnet calculator',
	category: 'system',
	keywords: ['subnet', 'cidr', 'ip', 'netmask', 'network', 'broadcast', 'ipv4', 'calculator'],
	description: 'For an IPv4 address with a prefix (192.168.1.10/24) shows the network, broadcast, usable host range, masks and how it splits into smaller subnets.',
	live: true,
	inputs: [
		{ name: 'cidr', label: 'Address/prefix', type: 'text', mono: true, default: '192.168.10.77/26' },
		{ name: 'split', label: 'Split into subnets of prefix (optional)', type: 'number', min: 1, max: 32 },
	],
	run({ cidr, split }) {
		const m = String(cidr).trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2})|\s+(\d{1,3}(?:\.\d{1,3}){3}))?$/);
		if (!m) throw new Error('Use a.b.c.d/prefix, for example 10.0.0.5/16, or an address and a mask.');
		const toInt = (s) => s.split('.').reduce((n, o) => {
			const v = Number(o);
			if (v > 255) throw new Error(`${o} is not a valid octet.`);
			return n * 256 + v;
		}, 0);
		const toIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
		const ip = toInt(m[1]);
		let prefix = m[2] != null ? Number(m[2]) : 32;
		if (m[3]) {
			const mask = toInt(m[3]);
			prefix = (mask >>> 0).toString(2).replace(/0+$/, '').length;
			if (((0xffffffff << (32 - prefix)) >>> 0) !== mask >>> 0 && prefix !== 0) throw new Error('That mask is not contiguous.');
		}
		if (prefix > 32) throw new Error('The prefix goes from 0 to 32.');
		const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
		const net = (ip & mask) >>> 0;
		const bcast = (net | (~mask >>> 0)) >>> 0;
		const size = 2 ** (32 - prefix);
		const usable = prefix >= 31 ? size : size - 2;
		const first = prefix >= 31 ? net : net + 1;
		const last = prefix >= 31 ? bcast : bcast - 1;
		const o1 = ip >>> 24;
		const priv = o1 === 10 || (o1 === 172 && ((ip >>> 16) & 255) >= 16 && ((ip >>> 16) & 255) <= 31) || (o1 === 192 && ((ip >>> 16) & 255) === 168) ? 'private (RFC 1918)' : o1 === 127 ? 'loopback' : o1 === 169 && ((ip >>> 16) & 255) === 254 ? 'link-local' : o1 === 100 && ((ip >>> 16) & 255) >= 64 && ((ip >>> 16) & 255) <= 127 ? 'carrier-grade NAT' : o1 >= 224 && o1 <= 239 ? 'multicast' : 'public';
		const blocks = [];
		if (split) {
			const p = Number(split);
			if (p < prefix) throw new Error(`Subnets of /${p} are bigger than this /${prefix} network.`);
			const count = 2 ** (p - prefix);
			if (count > 1024) throw new Error(`That makes ${count} subnets; choose a prefix that gives 1024 or fewer.`);
			const step = 2 ** (32 - p);
			blocks.push({ type: 'table', label: `${count} subnets of /${p}`, columns: ['Subnet', 'First host', 'Last host', 'Broadcast'], rows: Array.from({ length: count }, (_, i) => {
				const n = net + i * step;
				const b = n + step - 1;
				return [`${toIp(n)}/${p}`, toIp(p >= 31 ? n : n + 1), toIp(p >= 31 ? b : b - 1), toIp(b)];
			}) });
		}
		return {
			readings: [
				{ label: 'Network', value: `${toIp(net)}/${prefix}` }, { label: 'Broadcast', value: toIp(bcast) }, { label: 'First usable host', value: toIp(first) }, { label: 'Last usable host', value: toIp(last) },
				{ label: 'Usable hosts', value: usable.toLocaleString() }, { label: 'Subnet mask', value: toIp(mask) }, { label: 'Wildcard mask', value: toIp(~mask >>> 0) }, { label: 'Address type', value: priv, copy: false },
				{ label: 'Binary mask', value: mask.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1.') },
			],
			blocks,
		};
	},
});
