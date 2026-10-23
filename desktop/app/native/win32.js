// Win32 calls (through koffi) that put LabsCode's window inside OmniTool's window. Window handles are plain integers.
'use strict';

let api = null;
let loadError = null;

function load() {
	if (api || loadError) return api;
	try {
		const koffi = require('koffi');
		const user32 = koffi.load('user32.dll');
		const kernel32 = koffi.load('kernel32.dll');
		const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(intptr_t hwnd, intptr_t lParam)');
		api = {
			EnumWindows: user32.func('bool __stdcall EnumWindows(EnumWindowsProc *cb, intptr_t lParam)'),
			GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(intptr_t hwnd, _Out_ uint32_t *pid)'),
			IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(intptr_t hwnd)'),
			IsWindow: user32.func('bool __stdcall IsWindow(intptr_t hwnd)'),
			GetWindowTextW: user32.func('int __stdcall GetWindowTextW(intptr_t hwnd, _Out_ uint8_t *buf, int max)'),
			GetClassNameW: user32.func('int __stdcall GetClassNameW(intptr_t hwnd, _Out_ uint8_t *buf, int max)'),
			GetParent: user32.func('intptr_t __stdcall GetParent(intptr_t hwnd)'),
			SetParent: user32.func('intptr_t __stdcall SetParent(intptr_t child, intptr_t parent)'),
			GetWindowLongPtrW: user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd, int index)'),
			SetWindowLongPtrW: user32.func('intptr_t __stdcall SetWindowLongPtrW(intptr_t hwnd, int index, intptr_t value)'),
			SetWindowPos: user32.func('bool __stdcall SetWindowPos(intptr_t hwnd, intptr_t after, int x, int y, int cx, int cy, uint32_t flags)'),
			GetWindowRect: user32.func('bool __stdcall GetWindowRect(intptr_t hwnd, _Out_ int32_t *rect)'),
			ShowWindow: user32.func('bool __stdcall ShowWindow(intptr_t hwnd, int cmd)'),
			PostMessageW: user32.func('bool __stdcall PostMessageW(intptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)'),
			ScreenToClient: user32.func('bool __stdcall ScreenToClient(intptr_t hwnd, _Inout_ int32_t *point)'),
			OpenProcess: kernel32.func('intptr_t __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t pid)'),
			QueryFullProcessImageNameW: kernel32.func('bool __stdcall QueryFullProcessImageNameW(intptr_t proc, uint32_t flags, _Out_ uint8_t *buf, _Inout_ uint32_t *size)'),
			CloseHandle: kernel32.func('bool __stdcall CloseHandle(intptr_t h)'),
			EnumWindowsProc,
			koffi,
		};
	} catch (err) {
		loadError = err;
	}
	return api;
}

const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_CHILD = 0x40000000;
const WS_POPUP = 0x80000000;
const WS_CAPTION = 0x00c00000;
const WS_THICKFRAME = 0x00040000;
const WS_SYSMENU = 0x00080000;
const WS_MINIMIZEBOX = 0x00020000;
const WS_MAXIMIZEBOX = 0x00010000;
const WS_CLIPSIBLINGS = 0x04000000;
const WS_EX_APPWINDOW = 0x00040000;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const SWP_SHOWWINDOW = 0x0040;
const SW_HIDE = 0;
const SW_SHOWNA = 8;
const WM_CLOSE = 0x0010;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

function utf16(buf, chars) {
	return Buffer.from(buf.buffer, buf.byteOffset, chars * 2).toString('utf16le');
}

function available() {
	return process.platform === 'win32' && !!load();
}

function unavailableReason() {
	if (process.platform !== 'win32') return 'Embedding uses Windows APIs';
	load();
	return loadError ? `koffi did not load: ${loadError.message}` : null;
}

function processImage(pid) {
	const h = api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
	if (!h) return null;
	try {
		const buf = new Uint8Array(2048);
		const size = [1024];
		return api.QueryFullProcessImageNameW(h, 0, buf, size) ? utf16(buf, size[0]) : null;
	} finally {
		api.CloseHandle(h);
	}
}

/** Visible top-level windows whose process runs the given executable path. */
function findWindowsOf(exePath) {
	load();
	const want = exePath.toLowerCase();
	const found = [];
	const images = new Map();
	api.EnumWindows((hwnd) => {
		if (!api.IsWindowVisible(hwnd)) return true;
		const pid = [0];
		api.GetWindowThreadProcessId(hwnd, pid);
		if (!images.has(pid[0])) images.set(pid[0], (processImage(pid[0]) || '').toLowerCase());
		if (images.get(pid[0]) !== want) return true;
		const cls = new Uint8Array(512);
		const n = api.GetClassNameW(hwnd, cls, 256);
		const title = new Uint8Array(1024);
		const t = api.GetWindowTextW(hwnd, title, 512);
		found.push({ hwnd: Number(hwnd), pid: pid[0], className: utf16(cls, n), title: utf16(title, t) });
		return true;
	}, 0);
	return found;
}

/** Turns a top-level window into a borderless child of `parent`; returns the original styles for detach(). */
function embed(child, parent) {
	load();
	const style = Number(api.GetWindowLongPtrW(child, GWL_STYLE));
	const exStyle = Number(api.GetWindowLongPtrW(child, GWL_EXSTYLE));
	// Dropping the maximize box also stops a double-click on LabsCode's title bar from maximizing it over OmniTool.
	const childStyle = ((style & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX)) | WS_CHILD | WS_CLIPSIBLINGS) >>> 0;
	api.SetWindowLongPtrW(child, GWL_STYLE, childStyle | 0);
	api.SetWindowLongPtrW(child, GWL_EXSTYLE, (exStyle & ~WS_EX_APPWINDOW) | 0);
	api.SetParent(child, parent);
	return { style, exStyle };
}

function place(child, x, y, w, h) {
	load();
	return api.SetWindowPos(child, 0, Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
}

function hide(child) {
	load();
	api.ShowWindow(child, SW_HIDE);
}

function show(child) {
	load();
	api.ShowWindow(child, SW_SHOWNA);
}

/** Rect of `child` relative to `parent`'s client area, in physical pixels. */
function clientRect(child, parent) {
	load();
	const r = new Int32Array(4);
	if (!api.GetWindowRect(child, r)) return null;
	const tl = new Int32Array([r[0], r[1]]);
	api.ScreenToClient(parent, tl);
	return { x: tl[0], y: tl[1], w: r[2] - r[0], h: r[3] - r[1] };
}

function detach(child, original) {
	load();
	if (!api.IsWindow(child)) return;
	api.SetParent(child, 0);
	if (original) {
		api.SetWindowLongPtrW(child, GWL_STYLE, original.style | 0);
		api.SetWindowLongPtrW(child, GWL_EXSTYLE, original.exStyle | 0);
	}
	api.SetWindowPos(child, 0, 80, 80, 1200, 800, SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
}

function isWindow(hwnd) {
	load();
	return !!hwnd && api.IsWindow(hwnd);
}

function parentOf(hwnd) {
	load();
	return Number(api.GetParent(hwnd));
}

function close(hwnd) {
	load();
	api.PostMessageW(hwnd, WM_CLOSE, 0, 0);
}

module.exports = { available, unavailableReason, findWindowsOf, embed, place, hide, show, clientRect, detach, isWindow, parentOf, close };
