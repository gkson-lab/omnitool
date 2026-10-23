// OmniTool desktop: the Electron main process. The UI is the shared web app; this file adds the native features.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, ClipboardItem, nativeImage, screen, desktopCapturer, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { Config, Secrets } = require('./native/config');
const files = require('./native/files');
const system = require('./native/system');
const net = require('./native/net');
const devtools = require('./native/devtools');
const { LabsCodeHost } = require('./native/labscode-host');

const desktopDir = path.resolve(__dirname, '..');
const dataDir = path.join(desktopDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });
// Chromium caches and local storage stay inside the OmniTool folder too.
app.setPath('userData', path.join(dataDir, 'electron'));

const config = new Config(dataDir);
const secrets = new Secrets(dataDir);
let win = null;
let labscode = null;
let clip = null;
const isDev = process.argv.includes('--dev');

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on('second-instance', () => {
		if (!win) return;
		if (win.isMinimized()) win.restore();
		win.focus();
	});
	app.whenReady().then(start);
}

function send(channel, data) {
	if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}

function createWindow() {
	const saved = config.get('window.bounds', null);
	const visible = saved && screen.getAllDisplays().some((d) => saved.x < d.bounds.x + d.bounds.width && saved.x + saved.width > d.bounds.x && saved.y < d.bounds.y + d.bounds.height && saved.y + saved.height > d.bounds.y);
	win = new BrowserWindow({
		width: visible ? saved.width : 1400,
		height: visible ? saved.height : 900,
		x: visible ? saved.x : undefined,
		y: visible ? saved.y : undefined,
		minWidth: 360,
		minHeight: 480,
		title: 'OmniTool',
		backgroundColor: config.get('theme', 'system') === 'dark' ? '#120e0d' : '#f6f3f2',
		show: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			spellcheck: false,
		},
	});
	if (saved && saved.maximized) win.maximize();
	Menu.setApplicationMenu(null);
	win.loadFile(path.join(__dirname, 'index.html'));
	win.once('ready-to-show', () => win.show());

	// The app never navigates away from its own page; links open in the default browser.
	win.webContents.on('will-navigate', (e, url) => {
		if (!url.startsWith('file://')) {
			e.preventDefault();
			if (/^https?:\/\//.test(url)) shell.openExternal(url);
		}
	});
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:\/\//.test(url)) shell.openExternal(url);
		return { action: 'deny' };
	});
	win.webContents.on('before-input-event', (e, input) => {
		if (isDev && input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
	});
	win.webContents.on('render-process-gone', (e, details) => {
		dialog.showErrorBox('OmniTool stopped responding', `The window closed unexpectedly (${details.reason}). Restart OmniTool with start.bat.`);
	});

	const saveBounds = () => {
		if (!win || win.isDestroyed()) return;
		config.set('window.bounds', { ...win.getNormalBounds(), maximized: win.isMaximized() });
	};
	win.on('resize', () => labscode && labscode.apply());
	win.on('move', () => labscode && labscode.apply());
	win.on('close', () => {
		saveBounds();
		if (labscode) labscode.shutdown();
	});
	win.on('closed', () => (win = null));
}

function start() {
	createWindow();
	labscode = new LabsCodeHost({
		desktopDir,
		parentHwnd: () => (win && !win.isDestroyed() ? Number(win.getNativeWindowHandle().readBigInt64LE(0)) : 0),
		scaleFactor: () => (win ? screen.getDisplayMatching(win.getBounds()).scaleFactor * win.webContents.getZoomFactor() : 1),
		emit: send,
		embed: () => config.get('labscode.embed', true) !== false,
	});
	clip = new devtools.ClipboardWatcher(dataDir, config, () => send('clipboard:changed'));
	registerIpc();
}

app.on('window-all-closed', () => {
	devtools.stopServer();
	devtools.killScript();
	if (clip) clip.stop();
	app.quit();
});

/* ---------- IPC ---------- */

const str = (v, max = 100000) => {
	if (typeof v !== 'string' || v.length > max) throw new Error('Invalid argument');
	return v;
};

/** async handlers: errors come back to the renderer as rejected promises with the message intact. */
function handle(channel, fn) {
	ipcMain.handle(channel, async (event, ...args) => {
		if (!win || event.sender !== win.webContents) throw new Error('Unknown sender');
		return fn(...args);
	});
}
function handleSync(channel, fn) {
	ipcMain.on(channel, (event, ...args) => {
		try {
			event.returnValue = { ok: fn(...args) };
		} catch (err) {
			event.returnValue = { error: err.message };
		}
	});
}

function registerIpc() {
	const agentFs = new files.AgentFs({
		config,
		extraRoots: async () => {
			if (!labscode.status().running) return [];
			const state = await labscode.bridge('GET', '/state');
			return state.workspaceFolders || [];
		},
	});

	handleSync('config:load', () => config.load());
	handle('config:save', (obj) => config.save(obj));
	handleSync('secrets:where', () => secrets.where());
	handle('secrets:get', (name) => secrets.get(str(name, 64)));
	handle('secrets:set', (name, value) => secrets.set(str(name, 64), str(value, 4096)));
	handle('secrets:clear', (name) => secrets.clear(str(name, 64)));
	handleSync('app:paths', () => ({ data: dataDir, config: config.file, desktop: desktopDir }));

	handle('dialog:openFile', async (opts) => {
		const r = await dialog.showOpenDialog(win, { properties: ['openFile', ...(opts && opts.multi ? ['multiSelections'] : [])], filters: opts && Array.isArray(opts.filters) ? opts.filters : undefined });
		if (r.canceled) return null;
		return r.filePaths.map((p) => {
			files.approve(p);
			return { path: p, name: path.basename(p), size: fs.statSync(p).size };
		});
	});
	handle('dialog:openFolder', async () => {
		const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
		return r.canceled ? null : r.filePaths[0];
	});
	handle('dialog:saveFile', async (opts) => {
		const r = await dialog.showSaveDialog(win, { defaultPath: opts && typeof opts.defaultPath === 'string' ? opts.defaultPath : undefined, filters: opts && Array.isArray(opts.filters) ? opts.filters : undefined });
		if (r.canceled || !r.filePath) return null;
		files.approve(r.filePath);
		return r.filePath;
	});
	handle('fs:readText', (p) => files.readText(str(p, 1024)));
	handle('fs:writeText', (p, text) => files.writeText(str(p, 1024), str(text, 50 * 1024 * 1024)));
	handle('fs:writeBase64', (p, b64) => files.writeBase64(str(p, 1024), str(b64, 100 * 1024 * 1024)));

	handle('shell:openPath', async (p) => {
		const err = await shell.openPath(str(p, 1024));
		if (err) throw new Error(err);
		return true;
	});
	handle('shell:openExternal', (url) => {
		if (!/^https?:\/\//.test(str(url, 4096))) throw new Error('Only web links can be opened.');
		return shell.openExternal(url);
	});
	handle('launcher:open', async (target) => {
		const t = str(target, 2048);
		if (/^https?:\/\//i.test(t)) return shell.openExternal(t);
		if (!fs.existsSync(t)) throw new Error(`${t} no longer exists.`);
		const err = await shell.openPath(t);
		if (err) throw new Error(err);
		return true;
	});

	handle('clipboard:write', async (text) => {
		await clipboard.writeText(str(text, 10 * 1024 * 1024));
		return true;
	});
	handle('clipboard:writeImage', async (dataUrl) => {
		const png = nativeImage.createFromDataURL(str(dataUrl, 100 * 1024 * 1024)).toPNG();
		await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
		return true;
	});
	handle('clipboard:history', () => clip.history());
	handleSync('clipboard:isRecording', () => clip.isRecording());
	handle('clipboard:setRecording', (on) => clip.setRecording(!!on));
	handle('clipboard:pin', (id, on) => clip.pin(str(id, 64), !!on));
	handle('clipboard:remove', (id) => clip.remove(str(id, 64)));
	handle('clipboard:clear', () => clip.clear());

	handleSync('agentFs:root', () => agentFs.root());
	handleSync('agentFs:setRoot', (p) => agentFs.setRoot(str(p, 1024)));
	handle('agentFs:resolve', (p) => agentFs.resolve(str(p || '.', 1024)));
	handle('agentFs:list', (p) => agentFs.list(str(p || '.', 1024)));
	handle('agentFs:read', (p) => agentFs.read(str(p, 1024)));
	handle('agentFs:write', (p, content) => agentFs.write(str(p, 1024), str(content, 20 * 1024 * 1024)));
	handle('agentFs:remove', (p) => agentFs.remove(str(p, 1024)));

	handle('labscode:status', () => labscode.status());
	handle('labscode:install', () => labscode.install());
	handle('labscode:start', (folder) => labscode.start(folder ? str(folder, 1024) : undefined));
	handle('labscode:openFolder', (folder) => labscode.openFolder(str(folder, 1024)));
	handle('labscode:setRect', (rect, visible) => {
		const r = rect && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(rect[k])) ? rect : null;
		labscode.setRect(r, !!visible && !!r);
		return true;
	});
	handle('labscode:dock', () => {
		labscode.dock();
		labscode.emitStatus();
		return labscode.status();
	});
	handle('labscode:undock', () => {
		labscode.undock();
		return labscode.status();
	});
	handle('labscode:bridge', (method, route, body) => {
		if (!['GET', 'POST'].includes(method) || !['/state', '/replace', '/open'].includes(route)) throw new Error('Unknown bridge call');
		return labscode.bridge(method, route, body);
	});

	handle('sys:info', () => system.info());
	handle('sys:processes', () => system.processes());
	handle('sys:kill', (pid) => system.kill(pid));
	handle('sys:disks', () => system.disks());
	handle('sys:env', () => system.env());
	handle('sys:folderSize', (p) => system.folderSize(str(p, 1024)));
	handle('sys:cancelFolderSize', () => system.cancelFolderSize());

	// Streams (ping, traceroute) report lines on "stream:line" tagged with their job id.
	const startStream = (fn) => (...args) => {
		const job = fn(...args, (line) => send('stream:line', { id: job.id, line }));
		job.done.then((r) => send('stream:done', { id: job.id, ...r }), (err) => send('stream:done', { id: job.id, error: err.message }));
		return job.id;
	};
	handle('net:ping', startStream((host, count, cb) => net.ping(str(host, 253), count, cb)));
	handle('net:traceroute', startStream((host, hops, cb) => net.traceroute(str(host, 253), hops, cb)));
	handle('net:stop', (id) => net.stop(id));
	handle('net:dns', (name, type) => net.lookup(str(name, 253), str(type, 8)));
	handle('net:ports', (host, list, timeout) => {
		if (!Array.isArray(list) || list.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) throw new Error('Invalid port list');
		return net.ports(str(host, 253), list, Number(timeout) || 1500);
	});
	handle('net:http', (req) => net.http({ method: str(req.method, 10), url: str(req.url, 8192), headers: req.headers && typeof req.headers === 'object' ? req.headers : {}, body: req.body == null ? undefined : str(req.body, 20 * 1024 * 1024) }));

	handle('git:inspect', (folder) => devtools.inspect(str(folder, 1024)));
	handle('git:diff', (folder) => devtools.diff(str(folder, 1024)));
	handle('script:run', (opts) => devtools.runScript({ lang: str(opts.lang, 16), code: str(opts.code, 5 * 1024 * 1024), stdin: opts.stdin ? str(opts.stdin, 1024 * 1024) : '', timeoutMs: Number(opts.timeoutMs) }));
	handle('script:kill', () => devtools.killScript());
	handle('scaffold:create', (parent, name, fileMap) => {
		if (!fileMap || typeof fileMap !== 'object') throw new Error('Invalid files');
		return files.scaffold(str(parent, 1024), str(name, 128), fileMap);
	});
	handle('rename:list', (folder) => files.renameList(str(folder, 1024)));
	handle('rename:apply', (folder, pairs) => {
		if (!Array.isArray(pairs) || pairs.length > 10000) throw new Error('Invalid rename list');
		return files.renameApply(str(folder, 1024), pairs.map((p) => ({ from: str(p.from, 255), to: str(p.to, 255) })));
	});
	handle('server:start', (folder, port) => devtools.startServer(str(folder, 1024), port));
	handle('server:stop', () => devtools.stopServer());
	handle('server:status', () => devtools.serverStatus());

	handle('capture:sources', async () => {
		const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 400, height: 250 } });
		return sources.filter((s) => !s.name.startsWith('OmniTool') || s.id.startsWith('screen')).map((s) => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }));
	});
	handle('capture:grab', async (id) => {
		const biggest = screen.getAllDisplays().reduce((m, d) => Math.max(m, d.size.width * d.scaleFactor, d.size.height * d.scaleFactor), 1920);
		const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: biggest, height: biggest } });
		const s = sources.find((x) => x.id === str(id, 128));
		if (!s) throw new Error('That screen or window is gone. Refresh the list.');
		return s.thumbnail.toDataURL();
	});
}
