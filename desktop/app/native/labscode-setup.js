// Downloads, unpacks and prepares OmniTool's private copy of LabsCode. Used by setup.js (start.bat) and by the app.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const { createZip } = require('./zip');

const RELEASE = {
	tag: 'labscode-beta-9',
	asset: 'LabsCode-win32-x64.zip',
	bytes: 402946806,
};
const DOWNLOAD_URL = `https://github.com/gkson-lab/labscode/releases/download/${RELEASE.tag}/${RELEASE.asset}`;

// Settings OmniTool needs so LabsCode sits inside its tab: no window buttons of its own.
const EMBED_SETTINGS = {
	'window.titleBarStyle': 'custom',
	'window.controlsStyle': 'hidden',
	'window.restoreWindows': 'one',
};

function paths(desktopDir) {
	const data = path.join(desktopDir, 'data');
	const root = path.join(desktopDir, 'vendor', 'labscode');
	const app = path.join(root, 'LabsCode');
	return {
		zip: path.join(desktopDir, 'vendor', 'downloads', RELEASE.asset),
		root,
		app,
		exe: path.join(app, 'LabsCode.exe'),
		cli: path.join(app, 'bin', 'code-oss.cmd'),
		portableSettings: path.join(app, 'data', 'user-data', 'User', 'settings.json'),
		extensionSources: path.join(desktopDir, 'labscode'),
		build: path.join(data, 'build'),
		marker: path.join(data, 'labscode-setup.json'),
		bridgeFile: path.join(data, 'labscode-bridge.json'),
		// Written last, after every file is unpacked, so an interrupted unpack never counts as installed.
		complete: path.join(root, '.omnitool-complete'),
	};
}

function isInstalled(p) {
	return fs.existsSync(p.exe) && fs.existsSync(p.cli) && fs.existsSync(p.complete);
}

function readMarker(p) {
	try {
		return JSON.parse(fs.readFileSync(p.marker, 'utf8'));
	} catch {
		return {};
	}
}

/** Streams the release zip to disk, resuming a partial download. onProgress(received, total). */
function download(p, onProgress) {
	fs.mkdirSync(path.dirname(p.zip), { recursive: true });
	const part = p.zip + '.part';
	const have = fs.existsSync(part) ? fs.statSync(part).size : 0;
	return new Promise((resolve, reject) => {
		const get = (url, redirects) => {
			const req = https.get(url, { headers: { 'User-Agent': 'OmniTool', ...(have ? { Range: `bytes=${have}-` } : {}) } }, (res) => {
				if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 8) {
					res.resume();
					get(new URL(res.headers.location, url).toString(), redirects + 1);
					return;
				}
				if (res.statusCode !== 200 && res.statusCode !== 206) {
					res.resume();
					reject(new Error(`GitHub answered ${res.statusCode} for ${url}`));
					return;
				}
				const resumed = res.statusCode === 206;
				const total = resumed ? have + Number(res.headers['content-length'] || 0) : Number(res.headers['content-length'] || RELEASE.bytes);
				let received = resumed ? have : 0;
				const out = fs.createWriteStream(part, { flags: resumed ? 'a' : 'w' });
				res.on('data', (chunk) => {
					received += chunk.length;
					if (onProgress) onProgress(received, total);
				});
				res.pipe(out);
				out.on('finish', () => {
					if (total && received !== total) {
						reject(new Error(`Download stopped at ${received} of ${total} bytes. Run setup again to resume.`));
						return;
					}
					try {
						fs.renameSync(part, p.zip);
						resolve(p.zip);
					} catch (err) {
						reject(err);
					}
				});
				res.on('error', reject);
				out.on('error', reject);
			});
			req.on('error', reject);
			req.setTimeout(60_000, () => req.destroy(new Error('No data from GitHub for 60 seconds')));
		};
		get(DOWNLOAD_URL, 0);
	});
}

/**
 * Unpacks straight into vendor\labscode and writes the completion marker last. No folder rename: renaming a
 * freshly unpacked 1 GB folder fails with EPERM while Windows Defender is still scanning it.
 */
function extract(p) {
	// maxRetries rides out files that antivirus holds open for a moment.
	fs.rmSync(p.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
	fs.mkdirSync(p.root, { recursive: true });
	const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
	return new Promise((resolve, reject) => {
		const useTar = fs.existsSync(tar);
		const child = useTar
			? spawn(tar, ['-xf', p.zip, '-C', p.root], { windowsHide: true })
			: spawn('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${p.zip.replace(/'/g, "''")}' -DestinationPath '${p.root.replace(/'/g, "''")}' -Force`], { windowsHide: true });
		let stderr = '';
		child.stderr.on('data', (d) => (stderr += d));
		child.on('error', reject);
		child.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Unpacking failed (${useTar ? 'tar' : 'Expand-Archive'} exit ${code}): ${stderr.trim().slice(0, 400)}`));
				return;
			}
			try {
				fs.writeFileSync(p.complete, `${RELEASE.tag} unpacked ${new Date().toISOString()}\n`);
				// The zip is no longer needed; a reinstall downloads it again.
				fs.rmSync(p.zip, { force: true, maxRetries: 5, retryDelay: 500 });
				resolve();
			} catch (err) {
				reject(err);
			}
		});
	});
}

function listFiles(dir, base = dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
	});
}

/** Packs an extension folder as a VSIX that the LabsCode CLI can install. */
function packVsix(srcDir, outFile) {
	const pkg = JSON.parse(fs.readFileSync(path.join(srcDir, 'package.json'), 'utf8'));
	const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${esc(pkg.name)}" Version="${esc(pkg.version)}" Publisher="${esc(pkg.publisher)}" />
    <DisplayName>${esc(pkg.displayName || pkg.name)}</DisplayName>
    <Description xml:space="preserve">${esc(pkg.description || '')}</Description>
    <Categories>${esc((pkg.categories || []).join(','))}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${esc(pkg.engines.vscode)}" />
    </Properties>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" /></Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
`;
	const contentTypes = '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
		+ '<Default Extension=".json" ContentType="application/json" /><Default Extension=".js" ContentType="application/javascript" />'
		+ '<Default Extension=".vsixmanifest" ContentType="text/xml" /><Default Extension=".md" ContentType="text/markdown" /></Types>';
	const entries = [
		{ name: '[Content_Types].xml', data: contentTypes },
		{ name: 'extension.vsixmanifest', data: manifest },
		...listFiles(srcDir).map((rel) => ({ name: 'extension/' + rel.split(path.sep).join('/'), data: fs.readFileSync(path.join(srcDir, rel)) })),
	];
	fs.mkdirSync(path.dirname(outFile), { recursive: true });
	fs.writeFileSync(outFile, createZip(entries));
	return { id: `${pkg.publisher}.${pkg.name}`, version: pkg.version };
}

function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const rel of listFiles(src)) {
		fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
		fs.copyFileSync(path.join(src, rel), path.join(dest, rel));
	}
}

/** Installs OmniTool's fixed LabsCode Extras and the bridge; skips what the marker says is already current. */
function installExtensions(p, log) {
	const marker = readMarker(p);
	marker.extensions = marker.extensions || {};
	for (const name of ['labscode-extras', 'omnitool-bridge']) {
		const src = path.join(p.extensionSources, name);
		const { version } = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
		if (marker.extensions[name] === version) continue;
		const builtin = path.join(p.app, 'resources', 'app', 'extensions', name);
		if (fs.existsSync(builtin)) {
			// OSS builds refuse to update a built-in extension through the CLI, so the fixed source replaces it in this private copy.
			log(`Updating built-in ${name} to ${version}`);
			copyDir(src, builtin);
			marker.extensions[name] = version;
			continue;
		}
		const vsix = path.join(p.build, `${name}-${version}.vsix`);
		const { id } = packVsix(src, vsix);
		log(`Installing ${id} ${version} into LabsCode`);
		const res = spawnSync('cmd.exe', ['/d', '/s', '/c', `""${p.cli}" --install-extension "${vsix}" --force"`], {
			windowsVerbatimArguments: true,
			encoding: 'utf8',
			windowsHide: true,
			timeout: 180_000,
		});
		const output = `${res.stdout || ''}${res.stderr || ''}`;
		if (res.status !== 0 || !/successfully installed/i.test(output)) {
			throw new Error(`LabsCode could not install ${id}: ${output.trim().slice(0, 500) || `exit ${res.status}`}`);
		}
		marker.extensions[name] = version;
	}
	return marker;
}

/** Adds any missing keys to a JSONC settings file without disturbing its comments. */
function ensureSettings(file, wanted) {
	let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{\n}\n';
	const missing = Object.entries(wanted).filter(([key]) => !new RegExp(`"${key.replace(/\./g, '\\.')}"\\s*:`).test(text));
	if (!missing.length) return false;
	const brace = text.indexOf('{');
	const hasProps = /"[^"]+"\s*:/.test(text.slice(brace));
	const lines = missing.map(([k, v], i) => `\t${JSON.stringify(k)}: ${JSON.stringify(v)}${i < missing.length - 1 || hasProps ? ',' : ''}`);
	text = text.slice(0, brace + 1) + '\n' + lines.join('\n') + text.slice(brace + 1);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, text);
	return true;
}

/**
 * Portable LabsCode ignores --user-data-dir, so the embed settings go into the portable settings file.
 * That is safe because this copy of LabsCode belongs to OmniTool.
 */
function prepareSettings(p) {
	ensureSettings(p.portableSettings, EMBED_SETTINGS);
}

/** Full setup: download and unpack when missing, install extensions, add the embed settings. */
async function runSetup(desktopDir, { log = () => {}, onProgress } = {}) {
	const p = paths(desktopDir);
	if (!isInstalled(p)) {
		if (!fs.existsSync(p.zip)) {
			log(`Downloading LabsCode (${RELEASE.tag}, about ${Math.round(RELEASE.bytes / 1048576)} MB) from github.com/gkson-lab/labscode`);
			await download(p, onProgress);
		}
		log('Unpacking LabsCode');
		await extract(p);
		if (!isInstalled(p)) throw new Error('The LabsCode zip did not contain LabsCode\\LabsCode.exe.');
	}
	const marker = installExtensions(p, log);
	prepareSettings(p);
	marker.release = RELEASE.tag;
	fs.mkdirSync(path.dirname(p.marker), { recursive: true });
	fs.writeFileSync(p.marker, JSON.stringify(marker, null, 2));
	return p;
}

module.exports = { RELEASE, DOWNLOAD_URL, paths, isInstalled, runSetup, packVsix, ensureSettings };
