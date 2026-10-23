// Called by start.bat: prepares LabsCode before the app opens. Exit code 2 means "start without the editor".
'use strict';
const path = require('path');
const { runSetup, RELEASE } = require('./native/labscode-setup');

const desktopDir = path.resolve(__dirname, '..');

if (process.argv.includes('--skip-labscode')) {
	console.log('  Skipping LabsCode (--skip-labscode). The LabsCode tab can install it later.');
	process.exit(0);
}

let lastDraw = 0;
function progress(received, total) {
	const now = Date.now();
	if (now - lastDraw < 250 && received < total) return;
	lastDraw = now;
	const pct = total ? Math.floor((received / total) * 100) : 0;
	const filled = Math.floor(pct / 5);
	process.stdout.write(`\r  [${'#'.repeat(filled)}${'.'.repeat(20 - filled)}] ${pct}%  ${(received / 1048576).toFixed(0)} of ${(total / 1048576).toFixed(0)} MB   `);
	if (received >= total) process.stdout.write('\n');
}

runSetup(desktopDir, { log: (msg) => console.log('  ' + msg), onProgress: progress })
	.then(() => console.log('  LabsCode is ready.'))
	.catch((err) => {
		console.log('');
		console.log(`  LabsCode setup did not finish: ${err.message}`);
		console.log(`  OmniTool will still open. The LabsCode tab can retry, or run start.bat again.`);
		console.log(`  Manual option: download ${RELEASE.asset} from the ${RELEASE.tag} release on`);
		console.log('  github.com/gkson-lab/labscode and put it in desktop\\vendor\\downloads.');
		process.exit(2);
	});
