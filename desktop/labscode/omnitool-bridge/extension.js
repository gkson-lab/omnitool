// OmniTool Bridge: lets the OmniTool desktop app read the active editor and apply edits the user approved there.
'use strict';
const vscode = require('vscode');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const MAX_TEXT = 1_000_000;

function readJson(req) {
	return new Promise((resolve, reject) => {
		let raw = '';
		req.setEncoding('utf8');
		req.on('data', (chunk) => {
			raw += chunk;
			if (raw.length > 8_000_000) reject(new Error('Request too large'));
		});
		req.on('end', () => {
			try {
				resolve(raw ? JSON.parse(raw) : {});
			} catch {
				reject(new Error('Body is not JSON'));
			}
		});
		req.on('error', reject);
	});
}

function describe(editor) {
	if (!editor) return null;
	const doc = editor.document;
	const text = doc.getText();
	const sel = editor.selection;
	return {
		uri: doc.uri.toString(),
		path: doc.uri.scheme === 'file' ? doc.uri.fsPath : null,
		name: doc.fileName.split(/[\\/]/).pop(),
		languageId: doc.languageId,
		isDirty: doc.isDirty,
		version: doc.version,
		lineCount: doc.lineCount,
		truncated: text.length > MAX_TEXT,
		text: text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text,
		selection: {
			start: { line: sel.start.line, character: sel.start.character },
			end: { line: sel.end.line, character: sel.end.character },
			text: doc.getText(sel),
		},
	};
}

async function route(method, path, body) {
	if (method === 'GET' && path === '/state') {
		return {
			file: describe(vscode.window.activeTextEditor),
			openFiles: vscode.window.tabGroups.all
				.flatMap((g) => g.tabs)
				.map((t) => t.input && t.input.uri)
				.filter((u) => u && u.scheme === 'file')
				.map((u) => u.fsPath),
			workspaceFolders: (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath),
		};
	}
	if (method === 'POST' && path === '/replace') {
		const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === body.uri);
		if (!doc) throw new Error('That file is no longer open in LabsCode');
		// The agent proposed its edit against a specific version; refuse if the user typed in between.
		if (typeof body.version === 'number' && body.version !== doc.version) {
			throw new Error('The file changed in LabsCode after the agent read it. Ask again to get a fresh proposal.');
		}
		const edit = new vscode.WorkspaceEdit();
		edit.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), String(body.text));
		const applied = await vscode.workspace.applyEdit(edit);
		await vscode.window.showTextDocument(doc, { preview: false });
		return { applied, version: doc.version };
	}
	if (method === 'POST' && path === '/open') {
		const uri = vscode.Uri.file(String(body.path));
		const line = Math.max(0, Number(body.line || 1) - 1);
		const pos = new vscode.Position(line, 0);
		await vscode.window.showTextDocument(uri, { preview: false, selection: new vscode.Range(pos, pos) });
		return { opened: uri.fsPath };
	}
	throw new Error(`No route for ${method} ${path}`);
}

function activate(context) {
	// OmniTool sets this when it starts LabsCode; a LabsCode started any other way keeps the bridge off.
	const file = process.env.OMNITOOL_BRIDGE_FILE;
	if (!file) return;
	const token = crypto.randomBytes(24).toString('hex');
	const server = http.createServer(async (req, res) => {
		const send = (status, data) => {
			res.writeHead(status, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(data));
		};
		if (req.headers['x-omnitool-token'] !== token) return send(403, { error: 'Bad token' });
		try {
			const body = req.method === 'POST' ? await readJson(req) : {};
			send(200, await route(req.method, new URL(req.url, 'http://127.0.0.1').pathname, body));
		} catch (err) {
			send(400, { error: String((err && err.message) || err) });
		}
	});
	let info = null;
	const publish = () => {
		if (!info) return;
		try {
			fs.writeFileSync(file, info);
		} catch {
			// OmniTool's data folder is gone; the bridge stays unreachable.
		}
	};
	server.listen(0, '127.0.0.1', () => {
		info = JSON.stringify({ port: server.address().port, token, pid: process.pid });
		publish();
	});
	// Each LabsCode window runs its own bridge; OmniTool talks to the one focused last.
	context.subscriptions.push(vscode.window.onDidChangeWindowState((s) => s.focused && publish()));
	context.subscriptions.push({
		dispose() {
			server.close();
			try {
				// Leave the file alone if another window's bridge has taken it over.
				if (fs.readFileSync(file, 'utf8') === info) fs.unlinkSync(file);
			} catch {
				// Already gone.
			}
		},
	});
}

module.exports = { activate, deactivate() {} };
