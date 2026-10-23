// Starts OmniTool's LabsCode, docks its window inside the LabsCode tab and talks to the OmniTool Bridge extension.
'use strict';
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const win32 = require('./win32');
const setup = require('./labscode-setup');

/** A LabsCode workbench window (its dialogs and helper windows have other classes or no title). */
const isWorkbench = (w) => w.className.startsWith('Chrome_WidgetWin') && !!w.title;

class LabsCodeHost {
	/** opts: { desktopDir, parentHwnd(): number, scaleFactor(): number, emit(event, data), embed: boolean } */
	constructor(opts) {
		this.opts = opts;
		this.p = setup.paths(opts.desktopDir);
		this.hwnd = 0;
		this.original = null;
		this.mode = null; // 'embedded' | 'window'
		this.rect = null;
		this.visible = false;
		this.starting = null;
		this.lastError = null;
		this.watchdog = null;
		this.installing = false;
	}

	status() {
		return {
			installed: setup.isInstalled(this.p),
			installing: this.installing,
			running: !!this.hwnd && win32.available() && win32.isWindow(this.hwnd),
			starting: !!this.starting,
			mode: this.mode,
			embedSupported: win32.available(),
			embedUnavailableReason: win32.unavailableReason(),
			bridge: this.readBridge() !== null,
			error: this.lastError,
			release: setup.RELEASE.tag,
			downloadMB: Math.round(setup.RELEASE.bytes / 1048576),
		};
	}

	emitStatus() {
		this.opts.emit('labscode:status', this.status());
	}

	async install() {
		if (this.installing) return this.status();
		this.installing = true;
		this.lastError = null;
		this.emitStatus();
		try {
			await setup.runSetup(this.opts.desktopDir, {
				log: (message) => this.opts.emit('labscode:progress', { message }),
				onProgress: (received, total) => this.opts.emit('labscode:progress', { received, total }),
			});
		} catch (err) {
			this.lastError = `Setup failed: ${err.message}`;
		} finally {
			this.installing = false;
			this.emitStatus();
		}
		return this.status();
	}

	/** Starts LabsCode (once) and docks it. Resolves with the status. */
	start(folder) {
		if (this.hwnd && win32.available() && win32.isWindow(this.hwnd)) return Promise.resolve(this.status());
		if (this.starting) return this.starting;
		this.starting = this.doStart(folder).finally(() => {
			this.starting = null;
			this.emitStatus();
		});
		this.emitStatus();
		return this.starting;
	}

	async doStart(folder) {
		this.lastError = null;
		if (!setup.isInstalled(this.p)) {
			this.lastError = 'LabsCode is not installed yet.';
			return this.status();
		}
		// Keep the extension installs and the embed settings current even if start.bat was skipped.
		try {
			await setup.runSetup(this.opts.desktopDir);
		} catch (err) {
			this.lastError = `Setup check failed: ${err.message}`;
		}
		const open = win32.available() ? win32.findWindowsOf(this.p.exe).filter(isWorkbench) : [];
		if (open.length) {
			// LabsCode outlived an earlier OmniTool session (it was asking about unsaved files); dock that window again.
			this.hwnd = open[0].hwnd;
			if (this.opts.embed()) this.dock();
			else this.mode = 'window';
			this.startWatchdog();
			if (folder) this.openFolder(folder);
			return this.status();
		}
		try {
			fs.unlinkSync(this.p.bridgeFile);
		} catch {
			// No stale bridge file.
		}
		// No --new-window: with unsaved files to restore it opened a second window that stayed outside OmniTool.
		const args = folder ? [folder] : [];
		const child = spawn(this.p.exe, args, { env: this.env(), detached: true, stdio: 'ignore', windowsHide: false });
		child.on('error', (err) => {
			this.lastError = `LabsCode did not start: ${err.message}`;
		});
		child.unref();

		if (!win32.available()) {
			this.mode = 'window';
			this.lastError = `LabsCode opened in its own window. ${win32.unavailableReason() || ''}`.trim();
			return this.status();
		}
		const hwnd = await this.waitForWindow(45_000);
		if (!hwnd) {
			this.lastError = this.lastError || 'LabsCode started, but its window did not appear within 45 seconds.';
			return this.status();
		}
		this.hwnd = hwnd;
		if (this.opts.embed()) this.dock();
		else this.mode = 'window';
		this.startWatchdog();
		return this.status();
	}

	env() {
		const env = { ...process.env, OMNITOOL_BRIDGE_FILE: this.p.bridgeFile };
		// Variables meant for OmniTool's own Electron must not leak into LabsCode's.
		for (const key of Object.keys(env)) if (/^(ELECTRON_|NODE_OPTIONS$|VSCODE_)/.test(key)) delete env[key];
		return env;
	}

	/** Opens a folder in the running LabsCode window, or starts LabsCode with it. */
	openFolder(folder) {
		if (!this.hwnd || !win32.available() || !win32.isWindow(this.hwnd)) return this.start(folder);
		// A second LabsCode.exe with the same portable data hands the folder to the running instance and exits.
		const child = spawn(this.p.exe, ['--reuse-window', folder], { env: this.env(), detached: true, stdio: 'ignore' });
		child.on('error', () => {});
		child.unref();
		return Promise.resolve(this.status());
	}

	async waitForWindow(timeoutMs) {
		const until = Date.now() + timeoutMs;
		while (Date.now() < until) {
			const fresh = win32.findWindowsOf(this.p.exe).filter(isWorkbench);
			if (fresh.length) {
				// The workbench window gets a real title once loaded; wait a moment so LabsCode finishes its first layout.
				await new Promise((r) => setTimeout(r, 600));
				return fresh[0].hwnd;
			}
			await new Promise((r) => setTimeout(r, 250));
		}
		return 0;
	}

	dock() {
		const parent = this.opts.parentHwnd();
		if (!parent || !this.hwnd) return;
		this.original = win32.embed(this.hwnd, parent);
		this.mode = 'embedded';
		this.apply();
	}

	undock() {
		if (this.hwnd && this.mode === 'embedded') win32.detach(this.hwnd, this.original);
		this.mode = this.hwnd ? 'window' : null;
		this.emitStatus();
	}

	/** rect is in CSS pixels of OmniTool's page; visible=false hides LabsCode (another tab or a dialog is in front). */
	setRect(rect, visible) {
		this.rect = rect;
		this.visible = visible;
		this.apply();
	}

	physical() {
		const s = this.opts.scaleFactor();
		const r = this.rect;
		return { x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s };
	}

	apply() {
		if (this.mode !== 'embedded' || !this.hwnd || !win32.isWindow(this.hwnd)) return;
		if (!this.visible || !this.rect || this.rect.w < 10 || this.rect.h < 10) {
			win32.hide(this.hwnd);
			return;
		}
		const r = this.physical();
		win32.place(this.hwnd, r.x, r.y, r.w, r.h);
	}

	startWatchdog() {
		clearInterval(this.watchdog);
		this.watchdog = setInterval(() => {
			if (!this.hwnd) return;
			if (!win32.isWindow(this.hwnd)) {
				this.hwnd = 0;
				this.mode = null;
				this.lastError = 'LabsCode was closed.';
				clearInterval(this.watchdog);
				this.emitStatus();
				return;
			}
			if (this.mode !== 'embedded' || !this.visible || !this.rect) return;
			const parent = this.opts.parentHwnd();
			if (win32.parentOf(this.hwnd) !== parent) {
				this.dock();
				return;
			}
			// LabsCode's title bar is still a drag handle; put the window back if it was dragged inside OmniTool.
			const now = win32.clientRect(this.hwnd, parent);
			const want = this.physical();
			if (now && (Math.abs(now.x - want.x) > 2 || Math.abs(now.y - want.y) > 2 || Math.abs(now.w - want.w) > 2 || Math.abs(now.h - want.h) > 2)) this.apply();
		}, 400);
	}

	/** On OmniTool exit: give LabsCode its own window back and ask it to close, so it can prompt about unsaved files. */
	shutdown() {
		clearInterval(this.watchdog);
		if (!this.hwnd || !win32.available() || !win32.isWindow(this.hwnd)) return;
		if (this.mode === 'embedded') win32.detach(this.hwnd, this.original);
		win32.close(this.hwnd);
	}

	readBridge() {
		try {
			return JSON.parse(fs.readFileSync(this.p.bridgeFile, 'utf8'));
		} catch {
			return null;
		}
	}

	/** Calls the OmniTool Bridge extension running inside LabsCode. */
	bridge(method, route, body) {
		const info = this.readBridge();
		if (!info) return Promise.reject(new Error('LabsCode is not running with the OmniTool Bridge. Open the LabsCode tab first.'));
		const payload = body ? JSON.stringify(body) : null;
		return new Promise((resolve, reject) => {
			const req = http.request({
				host: '127.0.0.1',
				port: info.port,
				path: route,
				method,
				headers: { 'x-omnitool-token': info.token, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) },
				timeout: 15_000,
			}, (res) => {
				let raw = '';
				res.setEncoding('utf8');
				res.on('data', (d) => (raw += d));
				res.on('end', () => {
					let data;
					try {
						data = JSON.parse(raw);
					} catch {
						reject(new Error('The bridge sent an unreadable answer'));
						return;
					}
					if (res.statusCode !== 200) reject(new Error(data.error || `Bridge error ${res.statusCode}`));
					else resolve(data);
				});
			});
			req.on('timeout', () => req.destroy(new Error('LabsCode did not answer within 15 seconds')));
			req.on('error', (err) => reject(err.code === 'ECONNREFUSED' ? new Error('LabsCode is closed. Open the LabsCode tab to start it.') : err));
			if (payload) req.write(payload);
			req.end();
		});
	}
}

module.exports = { LabsCodeHost };
