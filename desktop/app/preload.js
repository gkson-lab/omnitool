// The only bridge between the sandboxed UI and the main process: window.omniNative.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Electron prefixes remote errors with "Error invoking remote method '...': Error: "; keep only the message.
const clean = (err) => new Error(String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args).catch((err) => {
	throw clean(err);
});
const sync = (channel, ...args) => {
	const r = ipcRenderer.sendSync(channel, ...args);
	if (r && r.error) throw new Error(r.error);
	return r ? r.ok : undefined;
};
const subscribe = (channel, cb) => {
	const fn = (_e, data) => cb(data);
	ipcRenderer.on(channel, fn);
	return () => ipcRenderer.removeListener(channel, fn);
};

/** Starts a streamed command; returns { done, stop } right away and calls onLine for each output line. */
function streamJob(channel, args, onLine) {
	let id = null;
	let stopped = false;
	let resolveDone;
	let rejectDone;
	const done = new Promise((resolve, reject) => {
		resolveDone = resolve;
		rejectDone = reject;
	});
	const onLineEvt = (_e, msg) => msg.id === id && onLine(msg.line);
	const onDoneEvt = (_e, msg) => {
		if (msg.id !== id) return;
		cleanup();
		if (msg.error) rejectDone(new Error(msg.error));
		else resolveDone(msg);
	};
	const cleanup = () => {
		ipcRenderer.removeListener('stream:line', onLineEvt);
		ipcRenderer.removeListener('stream:done', onDoneEvt);
	};
	ipcRenderer.on('stream:line', onLineEvt);
	ipcRenderer.on('stream:done', onDoneEvt);
	invoke(channel, ...args).then(
		(jobId) => {
			id = jobId;
			if (stopped) invoke('net:stop', id);
		},
		(err) => {
			cleanup();
			rejectDone(err);
		},
	);
	return {
		done,
		stop() {
			stopped = true;
			if (id !== null) invoke('net:stop', id);
		},
	};
}

contextBridge.exposeInMainWorld('omniNative', {
	platform: process.platform,
	app: { paths: () => sync('app:paths') },
	config: { load: () => sync('config:load'), save: (obj) => invoke('config:save', obj) },
	secrets: { where: () => sync('secrets:where'), get: (n) => invoke('secrets:get', n), set: (n, v) => invoke('secrets:set', n, v), clear: (n) => invoke('secrets:clear', n) },
	dialog: { openFile: (o) => invoke('dialog:openFile', o || {}), openFolder: () => invoke('dialog:openFolder'), saveFile: (o) => invoke('dialog:saveFile', o || {}) },
	fs: { readText: (p) => invoke('fs:readText', p), writeText: (p, t) => invoke('fs:writeText', p, t), writeBase64: (p, b) => invoke('fs:writeBase64', p, b) },
	shell: { openPath: (p) => invoke('shell:openPath', p), openExternal: (u) => invoke('shell:openExternal', u) },
	launcher: { open: (t) => invoke('launcher:open', t) },
	clipboard: {
		write: (t) => invoke('clipboard:write', t),
		writeImage: (d) => invoke('clipboard:writeImage', d),
		history: () => invoke('clipboard:history'),
		isRecording: () => sync('clipboard:isRecording'),
		setRecording: (on) => invoke('clipboard:setRecording', on),
		pin: (id, on) => invoke('clipboard:pin', id, on),
		remove: (id) => invoke('clipboard:remove', id),
		clear: () => invoke('clipboard:clear'),
		onChange: (cb) => subscribe('clipboard:changed', cb),
	},
	agentFs: {
		root: () => sync('agentFs:root'),
		setRoot: (p) => sync('agentFs:setRoot', p),
		resolve: (p) => invoke('agentFs:resolve', p),
		list: (p) => invoke('agentFs:list', p),
		read: (p) => invoke('agentFs:read', p),
		write: (p, c) => invoke('agentFs:write', p, c),
		remove: (p) => invoke('agentFs:remove', p),
	},
	labscode: {
		status: () => invoke('labscode:status'),
		install: () => invoke('labscode:install'),
		start: (folder) => invoke('labscode:start', folder),
		openFolder: (folder) => invoke('labscode:openFolder', folder),
		setRect: (rect, visible) => invoke('labscode:setRect', rect, visible),
		dock: () => invoke('labscode:dock'),
		undock: () => invoke('labscode:undock'),
		bridge: (method, route, body) => invoke('labscode:bridge', method, route, body),
		onStatus: (cb) => subscribe('labscode:status', cb),
		onProgress: (cb) => subscribe('labscode:progress', cb),
	},
	sys: {
		info: () => invoke('sys:info'),
		processes: () => invoke('sys:processes'),
		kill: (pid) => invoke('sys:kill', pid),
		disks: () => invoke('sys:disks'),
		env: () => invoke('sys:env'),
		folderSize: (p) => invoke('sys:folderSize', p),
		cancelFolderSize: () => invoke('sys:cancelFolderSize'),
	},
	net: {
		ping: (host, count, onLine) => streamJob('net:ping', [host, count], onLine),
		traceroute: (host, hops, onLine) => streamJob('net:traceroute', [host, hops], onLine),
		dns: (name, type) => invoke('net:dns', name, type),
		ports: (host, list, timeout) => invoke('net:ports', host, list, timeout),
		http: (req) => invoke('net:http', req),
	},
	git: { inspect: (folder) => invoke('git:inspect', folder), diff: (folder) => invoke('git:diff', folder) },
	script: { run: (o) => invoke('script:run', o), kill: () => invoke('script:kill') },
	scaffold: { create: (parent, name, files) => invoke('scaffold:create', parent, name, files) },
	rename: { list: (folder) => invoke('rename:list', folder), apply: (folder, pairs) => invoke('rename:apply', folder, pairs) },
	server: { start: (folder, port) => invoke('server:start', folder, port), stop: () => invoke('server:stop'), status: () => invoke('server:status') },
	capture: { sources: () => invoke('capture:sources'), grab: (id) => invoke('capture:grab', id) },
});
