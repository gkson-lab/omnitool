// No. 075 Loan calculator: fixed-rate payment, total interest and an amortization schedule.
Omni.register({
	no: 75,
	id: 'loan',
	name: 'Loan calculator',
	category: 'math',
	keywords: ['loan', 'mortgage', 'interest', 'amortization', 'payment', 'emi'],
	description: 'Monthly payment, total interest and a year-by-year amortization table for a fixed-rate loan, with optional extra payments. Arithmetic only, not financial advice.',
	live: true,
	inputs: [
		{ name: 'principal', label: 'Amount borrowed', type: 'number', min: 0, step: 'any', default: 250000 },
		{ name: 'rate', label: 'Annual interest rate (%)', type: 'number', min: 0, step: 'any', default: 5.5 },
		{ name: 'years', label: 'Term (years)', type: 'number', min: 0.1, step: 'any', default: 30 },
		{ name: 'extra', label: 'Extra payment per month', type: 'number', min: 0, step: 'any', default: 0 },
	],
	run({ principal, rate, years, extra }) {
		const P = Number(principal) || 0;
		const n = Math.round((Number(years) || 0) * 12);
		if (P <= 0 || n <= 0) return { note: 'Enter an amount and a term.' };
		const r = (Number(rate) || 0) / 100 / 12;
		const pay = r ? (P * r) / (1 - (1 + r) ** -n) : P / n;
		const money = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		let bal = P;
		let month = 0;
		let interestTotal = 0;
		const yearly = [];
		let yInt = 0;
		let yPrin = 0;
		while (bal > 0.005 && month < n + 1) {
			month++;
			const interest = bal * r;
			const principalPart = Math.min(bal, pay - interest + (extra || 0));
			bal -= principalPart;
			interestTotal += interest;
			yInt += interest;
			yPrin += principalPart;
			if (month % 12 === 0 || bal <= 0.005) {
				yearly.push([Math.ceil(month / 12), money(yPrin), money(yInt), money(Math.max(0, bal))]);
				yInt = 0;
				yPrin = 0;
			}
		}
		const saved = extra ? `${n - month} months sooner` : null;
		return {
			text: money(pay + (extra || 0)),
			big: true,
			label: extra ? 'Monthly payment including the extra' : 'Monthly payment',
			readings: [{ label: 'Total interest', value: money(interestTotal) }, { label: 'Total paid', value: money(P + interestTotal) }, { label: 'Payments', value: month, copy: false }, saved ? { label: 'Paid off', value: saved, copy: false } : null].filter(Boolean),
			table: { label: 'Amortization by year', columns: ['Year', 'Principal paid', 'Interest paid', 'Balance'], rows: yearly, numeric: [0, 1, 2, 3] },
		};
	},
});
