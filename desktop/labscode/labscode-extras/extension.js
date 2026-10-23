// LabsCode Extras: focus timer, today's edit tally, scratchpad and red-pen TODO markers.
'use strict';
const vscode = require('vscode');

const config = () => vscode.workspace.getConfiguration('labscode');

/** Status bar countdown. Click to start a session of `labscode.focus.minutes`; click again to stop. */
function focusTimer(context) {
	const item = vscode.window.createStatusBarItem('labscode.focus', vscode.StatusBarAlignment.Right, 100);
	item.name = 'LabsCode Focus Timer';
	item.command = 'labscode.focus.toggle';
	// The session end time is kept in globalState so a window reload doesn't cancel a running session.
	let { endAt, minutes } = context.globalState.get('labscode.focus', { endAt: 0, minutes: 0 });
	let tick;

	// settings.json edits bypass the schema's minimum and maximum, so clamp here.
	const sessionMinutes = () => Math.min(240, Math.max(1, Number(config().get('focus.minutes')) || 25));

	const render = () => {
		if (!endAt) {
			item.text = '$(watch) Focus';
			item.tooltip = `Start a ${sessionMinutes()}-minute focus session`;
			return;
		}
		const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
		item.text = `$(watch) ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
		item.tooltip = 'Focus session running. Click to stop.';
		if (left === 0) finish();
	};
	const persist = () => context.globalState.update('labscode.focus', { endAt, minutes });
	const stop = () => {
		clearInterval(tick);
		endAt = 0;
		persist();
		render();
	};
	const start = () => {
		clearInterval(tick);
		minutes = sessionMinutes();
		endAt = Date.now() + minutes * 60_000;
		persist();
		tick = setInterval(render, 1000);
		render();
	};
	const finish = async () => {
		stop();
		const again = await vscode.window.showInformationMessage(`Focus session done (${minutes} min). Take a break.`, 'Start another');
		if (again) start();
	};

	context.subscriptions.push(
		item,
		{ dispose: () => clearInterval(tick) },
		vscode.commands.registerCommand('labscode.focus.toggle', () => (endAt ? stop() : start())),
		vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('labscode.focus') && render()),
	);
	if (endAt) tick = setInterval(render, 1000);
	render();
	item.show();
}

/** Lines added and removed today across every file you edit. Resets at local midnight. */
function editTally(context) {
	const item = vscode.window.createStatusBarItem('labscode.tally', vscode.StatusBarAlignment.Right, 99);
	item.name = 'LabsCode Edit Tally';
	item.command = 'labscode.tally.reset';
	const today = () => new Date().toLocaleDateString('en-CA');
	let tally = context.globalState.get('labscode.tally', { date: today(), added: 0, removed: 0 });
	let saveTimer;
	let midnightTimer;

	const render = () => {
		if (tally.date !== today()) tally = { date: today(), added: 0, removed: 0 };
		item.text = `$(pencil) +${tally.added} −${tally.removed}`;
		item.tooltip = 'Lines added and removed today. Click to reset.';
		config().get('tally.enabled') ? item.show() : item.hide();
	};
	const save = () => {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => context.globalState.update('labscode.tally', tally), 2000);
	};
	// Without this the item kept showing yesterday's numbers until the first edit after midnight.
	const scheduleMidnight = () => {
		const next = new Date();
		next.setHours(24, 0, 1, 0);
		midnightTimer = setTimeout(() => {
			render();
			save();
			scheduleMidnight();
		}, next - Date.now());
	};

	context.subscriptions.push(
		item,
		{ dispose: () => { clearTimeout(midnightTimer); context.globalState.update('labscode.tally', tally); } },
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (!['file', 'untitled', 'vscode-userdata'].includes(e.document.uri.scheme)) return;
			if (e.reason === vscode.TextDocumentChangeReason.Undo || e.reason === vscode.TextDocumentChangeReason.Redo) return;
			let added = 0;
			let removed = 0;
			for (const change of e.contentChanges) {
				removed += change.range.end.line - change.range.start.line;
				added += change.text.split('\n').length - 1;
			}
			if (!added && !removed) return;
			// A reload from disk (git checkout, an external tool) leaves the file clean and is not an edit. isDirty lags
			// one event behind (still false for the first edit after a save), so check it once it has caught up.
			setTimeout(() => {
				if (!e.document.isDirty) return;
				if (tally.date !== today()) tally = { date: today(), added: 0, removed: 0 };
				tally.added += added;
				tally.removed += removed;
				render();
				save();
			}, 300);
		}),
		vscode.commands.registerCommand('labscode.tally.reset', () => {
			tally = { date: today(), added: 0, removed: 0 };
			render();
			save();
		}),
		vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('labscode.tally') && render()),
	);
	scheduleMidnight();
	render();
}

/** One Markdown note that lives outside any workspace and survives restarts. */
function scratchpad(context) {
	context.subscriptions.push(
		vscode.commands.registerCommand('labscode.scratchpad.open', async () => {
			const dir = context.globalStorageUri;
			const file = vscode.Uri.joinPath(dir, 'scratchpad.md');
			await vscode.workspace.fs.createDirectory(dir);
			try {
				await vscode.workspace.fs.stat(file);
			} catch {
				await vscode.workspace.fs.writeFile(file, Buffer.from('# Scratchpad\n\n'));
			}
			await vscode.window.showTextDocument(file, { preview: false });
		}),
	);
}

/** Marks TODO, FIXME and HACK in bold light red so they don't get lost. */
function redPen(context) {
	const marker = vscode.window.createTextEditorDecorationType({
		fontWeight: 'bold',
		light: { color: '#C81E1E' },
		dark: { color: '#FF8A8A' },
		overviewRulerColor: '#F87171',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
	});
	const pattern = /\b(TODO|FIXME|HACK)\b/g;
	// Every document edited since the last repaint; tracking only the latest one left the others stale.
	const pendingDocs = new Set();
	let pending;

	const paint = (editor) => {
		const doc = editor.document;
		const text = doc.getText();
		if (!config().get('redPen.enabled') || text.length > 2_000_000) {
			editor.setDecorations(marker, []);
			return;
		}
		const ranges = [];
		for (const m of text.matchAll(pattern)) {
			ranges.push(new vscode.Range(doc.positionAt(m.index), doc.positionAt(m.index + m[0].length)));
		}
		editor.setDecorations(marker, ranges);
	};
	const paintVisible = () => vscode.window.visibleTextEditors.forEach(paint);

	context.subscriptions.push(
		marker,
		{ dispose: () => clearTimeout(pending) },
		vscode.window.onDidChangeVisibleTextEditors(paintVisible),
		vscode.workspace.onDidChangeTextDocument((e) => {
			pendingDocs.add(e.document);
			clearTimeout(pending);
			pending = setTimeout(() => {
				vscode.window.visibleTextEditors.filter((ed) => pendingDocs.has(ed.document)).forEach(paint);
				pendingDocs.clear();
			}, 200);
		}),
		vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('labscode.redPen') && paintVisible()),
	);
	paintVisible();
}

function activate(context) {
	focusTimer(context);
	editTally(context);
	scratchpad(context);
	redPen(context);
}

module.exports = { activate, deactivate() {} };
