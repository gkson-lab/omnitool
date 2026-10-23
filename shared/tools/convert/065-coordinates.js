// No. 065 Coordinate converter: decimal degrees to degrees, minutes, seconds and back.
Omni.register({
	no: 65,
	id: 'coordinates',
	name: 'Coordinate converter',
	category: 'convert',
	keywords: ['coordinates', 'gps', 'latitude', 'longitude', 'dms', 'decimal degrees', 'map'],
	description: 'Converts latitude and longitude between decimal degrees (51.5007, -0.1246) and degrees, minutes, seconds (51°30\'02.5"N).',
	live: true,
	inputs: [{ name: 'input', label: 'Coordinates', type: 'text', default: '51.500729, -0.124625', hint: 'Decimal "lat, lon" or DMS like 51°30\'02.6"N 0°07\'28.7"W' }],
	run({ input }) {
		const s = String(input).trim();
		const toDms = (v, pos, neg) => {
			const a = Math.abs(v);
			const d = Math.floor(a);
			const m = Math.floor((a - d) * 60);
			const sec = ((a - d) * 60 - m) * 60;
			return `${d}°${String(m).padStart(2, '0')}'${sec.toFixed(1).padStart(4, '0')}"${v >= 0 ? pos : neg}`;
		};
		let lat;
		let lon;
		const dec = s.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
		if (dec) {
			lat = Number(dec[1]);
			lon = Number(dec[2]);
		} else {
			const parts = [...s.matchAll(/(\d+(?:\.\d+)?)\s*[°d\s]\s*(?:(\d+(?:\.\d+)?)\s*['m′\s]\s*)?(?:(\d+(?:\.\d+)?)\s*["s″]?\s*)?([NSEW])/gi)];
			if (parts.length !== 2) throw new Error('Use "lat, lon" in decimals, or two DMS values ending in N/S and E/W.');
			const val = (p) => (Number(p[1]) + Number(p[2] || 0) / 60 + Number(p[3] || 0) / 3600) * (/[SW]/i.test(p[4]) ? -1 : 1);
			const [a, b] = parts;
			if (/[NS]/i.test(a[4])) {
				lat = val(a);
				lon = val(b);
			} else {
				lat = val(b);
				lon = val(a);
			}
		}
		if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Latitude must be within ±90 and longitude within ±180.');
		return {
			readings: [
				{ label: 'Decimal degrees', value: `${lat.toFixed(6)}, ${lon.toFixed(6)}` },
				{ label: 'Degrees, minutes, seconds', value: `${toDms(lat, 'N', 'S')} ${toDms(lon, 'E', 'W')}` },
				{ label: 'Degrees and decimal minutes', value: `${Math.trunc(Math.abs(lat))}° ${(Math.abs(lat % 1) * 60).toFixed(4)}' ${lat >= 0 ? 'N' : 'S'}, ${Math.trunc(Math.abs(lon))}° ${(Math.abs(lon % 1) * 60).toFixed(4)}' ${lon >= 0 ? 'E' : 'W'}` },
				{ label: 'Map link', value: `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=15/${lat.toFixed(5)}/${lon.toFixed(5)}` },
			],
		};
	},
});
