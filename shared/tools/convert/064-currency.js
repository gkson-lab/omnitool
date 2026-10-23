// No. 064 Currency converter: European Central Bank reference rates from the Frankfurter API, cached for an hour.
Omni.register({
	no: 64,
	id: 'currency',
	name: 'Currency converter',
	category: 'convert',
	keywords: ['currency', 'exchange', 'rate', 'money', 'usd', 'eur', 'gbp', 'forex'],
	description: 'Converts between about 30 currencies with European Central Bank reference rates (published once per working day) from api.frankfurter.dev. Needs internet.',
	action: 'Convert',
	inputs: [
		{ name: 'amount', label: 'Amount', type: 'number', step: 'any', default: 100 },
		{ name: 'from', label: 'From (code)', type: 'text', default: 'USD' },
		{ name: 'to', label: 'To (code, or several separated by commas)', type: 'text', default: 'EUR, GBP, JPY' },
	],
	async run({ amount, from, to }) {
		const base = String(from).trim().toUpperCase();
		const targets = String(to).toUpperCase().split(/[\s,]+/).filter(Boolean);
		if (!/^[A-Z]{3}$/.test(base) || !targets.length || targets.some((t) => !/^[A-Z]{3}$/.test(t))) throw new Error('Use three-letter currency codes like USD, EUR or JPY.');
		const key = `tool.currency.rates.${base}`;
		let cached = Omni.store.get(key, null);
		if (!cached || Date.now() - cached.fetched > 3600000) {
			let res;
			try {
				res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`);
			} catch {
				if (cached) cached.stale = true;
				else throw new Error('Could not reach api.frankfurter.dev. Check your internet connection.');
			}
			if (res) {
				if (res.status === 404 || res.status === 422) throw new Error(`The ECB does not publish rates for ${base}.`);
				if (!res.ok) throw new Error(`The rate service answered ${res.status}.`);
				const data = await res.json();
				cached = { date: data.date, rates: data.rates, fetched: Date.now() };
				Omni.store.set(key, cached);
			}
		}
		const rows = targets.map((t) => {
			if (t === base) return [t, Number(amount).toFixed(2), '1'];
			const r = cached.rates[t];
			if (!r) return [t, 'not published by the ECB', ''];
			return [t, (Number(amount) * r).toLocaleString(undefined, { maximumFractionDigits: 4 }), String(r)];
		});
		return {
			table: { label: `${amount} ${base}`, columns: ['Currency', 'Amount', `Rate per 1 ${base}`], rows, numeric: [1, 2] },
			note: `ECB reference rates for ${cached.date}${cached.stale ? ' (offline: showing the last rates fetched)' : ''}. Banks and card networks add their own margin.`,
		};
	},
});
