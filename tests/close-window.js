// Closes the desktop edition the way its X button does. window.close() in the page skips Electron's close event,
// so OmniTool never hands LabsCode back and LabsCode is torn down without keeping its unsaved files.
'use strict';
const path = require('path');

function closeDesktopWindow(electronExe) {
	const win32 = require(path.join(__dirname, '..', 'desktop', 'app', 'native', 'win32'));
	const windows = win32.findWindowsOf(path.resolve(electronExe)).filter((w) => /OmniTool/.test(w.title));
	windows.forEach((w) => win32.close(w.hwnd));
	return windows.length;
}

module.exports = { closeDesktopWindow };
