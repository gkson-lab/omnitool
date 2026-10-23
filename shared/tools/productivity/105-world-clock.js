// No. 105 World clock: live clocks for the time zones you pick, with offsets from your own.
Omni.register({
	no: 105,
	id: 'world-clock',
	name: 'World clock',
	category: 'productivity',
	keywords: ['world clock', 'time zones', 'clock', 'utc', 'remote team', 'local time'],
	description: 'Live clocks for the time zones you choose, with each one\'s date and offset from your own time.',
	ai: false,
	mount(root, ctx) {
		const { h, icon } = Omni;
		let zones = ctx.store.get('zones', ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']);
		const all = Omni.tz.zones();
		const pick = h('input', { type: 'text', id: 'wc-add', list: 'wc-zones', placeholder: 'Type a city or region, e.g. Berlin' });
		const datalist = h('datalist', { id: 'wc-zones' }, all.map((z) => h('option', { value: z })));
		const list = h('ul', { class: 'list', 'aria-label': 'Clocks' });
		const offsetMin = (z, at) => {
			const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at).map((x) => [x.type, x.value]));
			return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - at.getTime()) / 60000);
		};
		const draw = () => {
			const now = new Date();
			const mine = -now.getTimezoneOffset();
			list.replaceChildren(...[Omni.tz.local, ...zones.filter((z) => z !== Omni.tz.local)].map((z) => {
				const diff = (offsetMin(z, now) - mine) / 60;
				const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: z, hour: 'numeric', hourCycle: 'h23' }).format(now));
				return h('li', null,
					h('div', { class: 'grow' }, h('strong', null, z.replace(/_/g, ' ')), z === Omni.tz.local ? h('span', { class: 'chip', style: { marginLeft: '6px' } }, 'You') : null, h('div', { class: 'muted', style: { fontSize: '0.82rem' } }, `${new Intl.DateTimeFormat(undefined, { timeZone: z, weekday: 'long', day: 'numeric', month: 'short' }).format(now)} · ${Omni.tz.offset(now.getTime(), z)}${z === Omni.tz.local ? '' : ` · ${diff === 0 ? 'same as you' : `${diff > 0 ? '+' : ''}${diff} h from you`}`} · ${hour >= 9 && hour < 18 ? 'working hours' : hour >= 22 || hour < 7 ? 'night' : 'outside working hours'}`)),
					h('span', { class: 'mono', style: { fontSize: '1.5rem' } }, new Intl.DateTimeFormat(undefined, { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)),
					z === Omni.tz.local ? null : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove ${z}`, onclick: () => ((zones = zones.filter((x) => x !== z)), ctx.store.set('zones', zones), draw()) }, icon('close')),
				);
			}));
		};
		const add = (e) => {
			e.preventDefault();
			const v = pick.value.trim();
			const z = all.find((x) => x.toLowerCase() === v.toLowerCase()) || all.find((x) => x.toLowerCase().includes(v.toLowerCase().replace(/\s+/g, '_')));
			if (!z) return Omni.ui.toast(`No time zone matches "${v}".`, { error: true });
			if (!zones.includes(z)) zones.push(z);
			ctx.store.set('zones', zones);
			pick.value = '';
			draw();
		};
		root.appendChild(h('div', { class: 'stack-lg' }, h('form', { class: 'panel row', onsubmit: add }, h('div', { class: 'field', style: { flex: '1' } }, h('label', { for: 'wc-add' }, 'Add a time zone'), pick, datalist), h('button', { type: 'submit', class: 'btn btn-primary', style: { alignSelf: 'flex-end' } }, 'Add clock')), h('section', { class: 'panel', 'aria-label': 'Clocks' }, list)));
		draw();
		const tick = setInterval(draw, 1000);
		return () => clearInterval(tick);
	},
});
