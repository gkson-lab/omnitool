// No. 043 Unit converter: ten quantities, with names and abbreviations understood ("72 F", "5 miles", "3 GiB").
(function () {
	'use strict';
	// Each unit: [id, label, factor to the base unit, ...aliases]. Temperature is handled separately.
	const Q = {
		length: { label: 'Length', base: 'm', units: [['nm', 'nanometers', 1e-9, 'nanometer'], ['um', 'micrometers', 1e-6, 'micron', 'µm'], ['mm', 'millimeters', 1e-3, 'millimeter', 'millimetre'], ['cm', 'centimeters', 1e-2, 'centimeter', 'centimetre'], ['m', 'meters', 1, 'meter', 'metre', 'metres'], ['km', 'kilometers', 1e3, 'kilometer', 'kilometre', 'kms'], ['in', 'inches', 0.0254, 'inch', '"'], ['ft', 'feet', 0.3048, 'foot', "'"], ['yd', 'yards', 0.9144, 'yard'], ['mi', 'miles', 1609.344, 'mile'], ['nmi', 'nautical miles', 1852, 'nautical mile']] },
		mass: { label: 'Mass', base: 'kg', units: [['mg', 'milligrams', 1e-6, 'milligram'], ['g', 'grams', 1e-3, 'gram', 'gr'], ['kg', 'kilograms', 1, 'kilogram', 'kilo', 'kilos'], ['t', 'tonnes', 1000, 'tonne', 'metric ton'], ['oz', 'ounces', 0.028349523125, 'ounce'], ['lb', 'pounds', 0.45359237, 'pound', 'lbs'], ['st', 'stone', 6.35029318, 'stones'], ['ton', 'US tons', 907.18474, 'short ton', 'tons']] },
		temperature: { label: 'Temperature', base: 'c', units: [['c', 'Celsius', null, 'celsius', '°c', 'degc', 'centigrade'], ['f', 'Fahrenheit', null, 'fahrenheit', '°f', 'degf'], ['k', 'Kelvin', null, 'kelvin', '°k']] },
		volume: { label: 'Volume', base: 'l', units: [['ml', 'milliliters', 1e-3, 'milliliter', 'millilitre', 'cc'], ['l', 'liters', 1, 'liter', 'litre', 'litres'], ['m3', 'cubic meters', 1000, 'm³', 'cubic meter'], ['tsp', 'teaspoons (US)', 0.00492892159375, 'teaspoon'], ['tbsp', 'tablespoons (US)', 0.01478676478125, 'tablespoon'], ['floz', 'fluid ounces (US)', 0.0295735295625, 'fl oz', 'fluid ounce'], ['cup', 'cups (US)', 0.2365882365, 'cups'], ['pt', 'pints (US)', 0.473176473, 'pint', 'pints'], ['qt', 'quarts (US)', 0.946352946, 'quart'], ['gal', 'gallons (US)', 3.785411784, 'gallon', 'gallons'], ['impgal', 'gallons (UK)', 4.54609, 'imperial gallon', 'uk gallon'], ['ft3', 'cubic feet', 28.316846592, 'ft³', 'cubic foot']] },
		area: { label: 'Area', base: 'm2', units: [['mm2', 'square millimeters', 1e-6, 'mm²'], ['cm2', 'square centimeters', 1e-4, 'cm²'], ['m2', 'square meters', 1, 'm²', 'sqm', 'square meter'], ['ha', 'hectares', 1e4, 'hectare'], ['km2', 'square kilometers', 1e6, 'km²'], ['in2', 'square inches', 0.00064516, 'in²', 'sq in'], ['ft2', 'square feet', 0.09290304, 'ft²', 'sq ft', 'sqft'], ['yd2', 'square yards', 0.83612736, 'yd²'], ['acre', 'acres', 4046.8564224, 'acres'], ['mi2', 'square miles', 2589988.110336, 'mi²', 'sq mi']] },
		speed: { label: 'Speed', base: 'mps', units: [['mps', 'meters per second', 1, 'm/s'], ['kmh', 'kilometers per hour', 1 / 3.6, 'km/h', 'kph'], ['mph', 'miles per hour', 0.44704, 'mi/h'], ['kn', 'knots', 0.514444, 'knot', 'kt'], ['fps', 'feet per second', 0.3048, 'ft/s']] },
		data: { label: 'Data size', base: 'B', units: [['bit', 'bits', 0.125, 'bits', 'b'], ['B', 'bytes', 1, 'byte', 'bytes'], ['KB', 'kilobytes (1000)', 1e3, 'kb', 'kilobyte'], ['KiB', 'kibibytes (1024)', 1024, 'kib'], ['MB', 'megabytes', 1e6, 'mb', 'megabyte'], ['MiB', 'mebibytes', 1048576, 'mib'], ['GB', 'gigabytes', 1e9, 'gb', 'gigabyte'], ['GiB', 'gibibytes', 1073741824, 'gib'], ['TB', 'terabytes', 1e12, 'tb', 'terabyte'], ['TiB', 'tebibytes', 1099511627776, 'tib'], ['PB', 'petabytes', 1e15, 'pb']] },
		time: { label: 'Time', base: 's', units: [['ms', 'milliseconds', 1e-3, 'millisecond'], ['s', 'seconds', 1, 'second', 'sec', 'secs'], ['min', 'minutes', 60, 'minute', 'mins'], ['h', 'hours', 3600, 'hour', 'hr', 'hrs'], ['d', 'days', 86400, 'day'], ['wk', 'weeks', 604800, 'week', 'weeks'], ['mo', 'months (30.44 days)', 2629800, 'month', 'months'], ['yr', 'years (365.25 days)', 31557600, 'year', 'years']] },
		pressure: { label: 'Pressure', base: 'pa', units: [['pa', 'pascals', 1, 'pascal', 'Pa'], ['kpa', 'kilopascals', 1e3, 'kPa'], ['bar', 'bar', 1e5, 'bars'], ['psi', 'psi', 6894.757293168, 'pounds per square inch'], ['atm', 'atmospheres', 101325, 'atmosphere'], ['mmhg', 'mmHg', 133.322387415, 'torr']] },
		energy: { label: 'Energy', base: 'j', units: [['j', 'joules', 1, 'joule', 'J'], ['kj', 'kilojoules', 1e3, 'kJ'], ['cal', 'calories', 4.184, 'calorie'], ['kcal', 'kilocalories', 4184, 'Cal', 'food calories'], ['wh', 'watt-hours', 3600, 'Wh'], ['kwh', 'kilowatt-hours', 3.6e6, 'kWh'], ['ev', 'electronvolts', 1.602176634e-19, 'eV'], ['btu', 'BTU', 1055.05585262, 'British thermal unit']] },
	};

	/** Finds a unit by id, label or alias. Exact case wins first, so "B" is bytes and "b" is bits; then any case and plurals. */
	function find(name) {
		const raw = String(name).trim();
		const s = raw.toLowerCase().replace(/^degrees?\s+/, '').replace(/\s+/g, ' ');
		for (const [qid, q] of Object.entries(Q)) for (const u of q.units) if (u[0] === raw) return { q: qid, u };
		for (const [qid, q] of Object.entries(Q)) for (const u of q.units) {
			const names = [u[0], u[1], ...u.slice(3)].map((x) => String(x).toLowerCase());
			if (names.includes(s) || names.includes(s.replace(/s$/, ''))) return { q: qid, u };
		}
		return null;
	}

	function toBase(q, u, v) {
		if (q === 'temperature') return u[0] === 'c' ? v : u[0] === 'f' ? ((v - 32) * 5) / 9 : v - 273.15;
		return v * u[2];
	}
	function fromBase(q, u, v) {
		if (q === 'temperature') return u[0] === 'c' ? v : u[0] === 'f' ? (v * 9) / 5 + 32 : v + 273.15;
		return v / u[2];
	}
	const show = (x) => Omni.math.format(x, 10);

	function convert(value, from, to) {
		const a = find(from);
		const b = find(to);
		if (!a) throw new Error(`Unknown unit "${from}".`);
		if (!b) throw new Error(`Unknown unit "${to}".`);
		if (a.q !== b.q) throw new Error(`Cannot convert ${Q[a.q].label.toLowerCase()} (${a.u[1]}) to ${Q[b.q].label.toLowerCase()} (${b.u[1]}).`);
		return { result: fromBase(a.q, b.u, toBase(a.q, a.u, value)), a, b };
	}

	Omni.units = { Q, find, convert };

	Omni.register({
		no: 43,
		id: 'unit-converter',
		name: 'Unit converter',
		category: 'convert',
		keywords: ['unit', 'convert', 'length', 'weight', 'mass', 'temperature', 'volume', 'area', 'speed', 'data', 'time', 'pressure', 'energy', 'metric', 'imperial'],
		description: 'Length, mass, temperature, volume, area, speed, data size, time, pressure and energy.',
		inputs: [
			{ name: 'value', label: 'Value', type: 'number', default: 1 },
			{ name: 'from', label: 'From unit', type: 'text', default: 'mi' },
			{ name: 'to', label: 'To unit', type: 'text', default: 'km' },
		],
		run({ value, from, to }) {
			const { result, a, b } = convert(Number(value), from, to);
			return { text: `${show(Number(value))} ${a.u[1]} = ${show(result)} ${b.u[1]}`, readings: [{ label: 'Result', value: show(result) }, { label: 'Quantity', value: Q[a.q].label, copy: false }] };
		},
		mount(root, ctx) {
			const { h } = Omni;
			const st = ctx.store.get('state', { q: 'length', from: 'mi', to: 'km', value: '1' });
			if (ctx.args) {
				const a = find(ctx.args.from || '');
				if (a) Object.assign(st, { q: a.q, from: a.u[0], to: (find(ctx.args.to || '') || { u: [a.u[0]] }).u[0], value: String(ctx.args.value ?? st.value) });
			}
			const qSel = h('select', { id: 'uc-q' }, Object.entries(Q).map(([k, q]) => h('option', { value: k }, q.label)));
			const value = h('input', { type: 'number', id: 'uc-v', step: 'any', value: st.value });
			const from = h('select', { id: 'uc-from' });
			const to = h('select', { id: 'uc-to' });
			const out = h('div', { 'aria-live': 'polite' });
			const fill = (sel, keep) => {
				sel.replaceChildren(...Q[qSel.value].units.map((u) => h('option', { value: u[0] }, `${u[1]} (${u[0]})`)));
				if (keep && Q[qSel.value].units.some((u) => u[0] === keep)) sel.value = keep;
			};
			const draw = () => {
				ctx.store.set('state', { q: qSel.value, from: from.value, to: to.value, value: value.value });
				const v = Number(value.value);
				if (value.value === '' || !Number.isFinite(v)) {
					out.replaceChildren(Omni.forms.stateBox('empty', null, 'Type a number.'));
					return;
				}
				const q = Q[qSel.value];
				const main = convert(v, from.value, to.value).result;
				const fu = q.units.find((u) => u[0] === from.value);
				Omni.forms.renderOutput({
					text: `${show(v)} ${fu[1]} = ${show(main)} ${q.units.find((u) => u[0] === to.value)[1]}`,
					big: true,
					label: 'Result',
					table: { label: `${show(v)} ${fu[1]} in every ${q.label.toLowerCase()} unit`, columns: ['Unit', 'Value'], rows: q.units.map((u) => [`${u[1]} (${u[0]})`, show(convert(v, from.value, u[0]).result)]), numeric: [1] },
				}, out);
			};
			qSel.value = st.q;
			fill(from, st.from);
			fill(to, st.to);
			qSel.addEventListener('change', () => {
				fill(from, Q[qSel.value].units[0][0]);
				fill(to, Q[qSel.value].units[Math.min(1, Q[qSel.value].units.length - 1)][0]);
				draw();
			});
			[value, from, to].forEach((el) => el.addEventListener('input', draw));
			const swap = h('button', { type: 'button', class: 'btn', onclick: () => {
				const f = from.value;
				from.value = to.value;
				to.value = f;
				draw();
			} }, 'Swap');
			root.appendChild(h('div', { class: 'io' },
				h('div', { class: 'panel' }, h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'uc-q' }, 'Quantity'), qSel), h('div', { class: 'field' }, h('label', { for: 'uc-v' }, 'Value'), value), h('div', { class: 'field' }, h('label', { for: 'uc-from' }, 'From'), from), h('div', { class: 'field' }, h('label', { for: 'uc-to' }, 'To'), to), h('div', { class: 'field' }, swap))),
				h('section', { class: 'panel', 'aria-label': 'Result' }, out),
			));
			draw();
		},
	});
})();
