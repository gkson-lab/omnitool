// Edition-specific Omni Agent tools: Code Pad in both editions, LabsCode and files on desktop, downloads on the web.
(function () {
	'use strict';
	const { h } = Omni;
	const { addTool, diffView } = Omni.agent;

	const preview = (text, max) => h('pre', { class: 'readout', style: { maxHeight: '180px', margin: '6px 0' } }, text.length > (max || 3000) ? text.slice(0, max || 3000) + `\n[${text.length - (max || 3000)} more characters]` : text);

	/* ---------- Code Pad (both editions) ---------- */

	addTool({
		name: 'codepad_read',
		description: 'Read the document open in Code Pad (No. 002): its name, language and text, plus the names of the other open tabs.',
		input_schema: { type: 'object', properties: {} },
		run: async () => {
			const pad = Omni.codepad.state();
			const doc = pad.active;
			if (!doc) return { empty: true, note: 'Code Pad has no open document.' };
			return { name: doc.name, language: doc.mode, text: doc.text, otherTabs: pad.docs.filter((d) => d.id !== doc.id).map((d) => d.name) };
		},
	});

	addTool({
		name: 'codepad_write',
		description: 'Replace the text of the active Code Pad document, or create a new tab when new_tab_name is given. The user sees a diff and approves first.',
		input_schema: {
			type: 'object',
			properties: { text: { type: 'string' }, summary: { type: 'string', description: 'One line on what changed.' }, new_tab_name: { type: 'string' } },
			required: ['text', 'summary'],
		},
		run: async ({ text, summary, new_tab_name }, step) => {
			const pad = Omni.codepad.state();
			const before = new_tab_name || !pad.active ? '' : pad.active.text;
			const ok = await step.approve({
				title: new_tab_name ? `Create Code Pad tab "${new_tab_name}"` : `Change ${pad.active ? pad.active.name : 'Code Pad'}: ${summary}`,
				body: await diffView(before, text),
				confirmLabel: 'Apply to Code Pad',
			});
			if (!ok) return { applied: false, note: 'The user rejected this change.' };
			Omni.codepad.write(text, new_tab_name);
			return { applied: true };
		},
	});

	/* ---------- Web: downloads ---------- */

	addTool({
		name: 'save_download',
		editions: ['web'],
		description: 'Offer text as a file download (the web edition cannot write to disk directly). The user approves first and the browser saves it.',
		input_schema: { type: 'object', properties: { filename: { type: 'string' }, content: { type: 'string' } }, required: ['filename', 'content'] },
		run: async ({ filename, content }, step) => {
			const safe = filename.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'omnitool.txt';
			const ok = await step.approve({ title: `Download ${safe} (${Omni.util.fmt.bytes(new Blob([content]).size)})`, body: preview(content), confirmLabel: 'Download' });
			if (!ok) return { saved: false, note: 'The user rejected the download.' };
			Omni.util.download(safe, content);
			return { saved: true, filename: safe, note: 'The browser saved it to the downloads folder.' };
		},
	});

	/* ---------- Desktop: LabsCode and files ---------- */

	if (Omni.edition !== 'desktop' || !Omni.native) return;
	const native = Omni.native;

	async function bridge(method, route, body) {
		// The bridge extension activates a few seconds after LabsCode opens; wait for it rather than fail.
		const until = Date.now() + 20000;
		for (;;) {
			try {
				return await native.labscode.bridge(method, route, body);
			} catch (err) {
				if (Date.now() > until || !/not running with the OmniTool Bridge/.test(err.message)) throw err;
				const status = await native.labscode.status();
				if (!status.running && !status.starting) throw new Error('LabsCode is not open. Open the LabsCode tab (No. 001) first.');
				await new Promise((r) => setTimeout(r, 800));
			}
		}
	}

	addTool({
		name: 'labscode_read_active_file',
		editions: ['desktop'],
		description: 'Read the file in the active LabsCode editor: path, language, full text, the current selection and a version number for labscode_propose_edit.',
		input_schema: { type: 'object', properties: {} },
		run: async () => {
			const state = await bridge('GET', '/state');
			if (!state.file) return { file: null, note: 'No file is active in LabsCode.', openFiles: state.openFiles, workspaceFolders: state.workspaceFolders };
			return { ...state.file, openFiles: state.openFiles, workspaceFolders: state.workspaceFolders };
		},
	});

	addTool({
		name: 'labscode_propose_edit',
		editions: ['desktop'],
		description: 'Propose a complete new text for the active LabsCode file. The user reviews a diff and approves; LabsCode then applies it as an undoable, unsaved edit. Pass the version from labscode_read_active_file.',
		input_schema: {
			type: 'object',
			properties: { new_text: { type: 'string' }, summary: { type: 'string', description: 'One line on what changed.' }, version: { type: 'number' } },
			required: ['new_text', 'summary'],
		},
		run: async ({ new_text, summary, version }, step) => {
			const state = await bridge('GET', '/state');
			if (!state.file) throw new Error('No file is active in LabsCode.');
			if (state.file.truncated) throw new Error('This file is over 1 MB; edit it in smaller pieces in LabsCode.');
			const ok = await step.approve({ title: `Edit ${state.file.name}: ${summary}`, body: await diffView(state.file.text, new_text), confirmLabel: 'Apply in LabsCode' });
			if (!ok) return { applied: false, note: 'The user rejected this edit.' };
			const res = await bridge('POST', '/replace', { uri: state.file.uri, text: new_text, version: typeof version === 'number' ? version : state.file.version });
			return { applied: res.applied, note: 'Applied as an unsaved edit; the user can undo it in LabsCode.' };
		},
	});

	addTool({
		name: 'labscode_open_file',
		editions: ['desktop'],
		description: 'Open a file in LabsCode, optionally at a line.',
		input_schema: { type: 'object', properties: { path: { type: 'string' }, line: { type: 'number' } }, required: ['path'] },
		run: async ({ path, line }) => {
			const resolved = await native.agentFs.resolve(path);
			if (!resolved.allowed) throw new Error(`${resolved.path} is outside the folders the agent may use (${resolved.roots.join(', ')}).`);
			Omni.open('labscode');
			return bridge('POST', '/open', { path: resolved.path, line });
		},
	});

	addTool({
		name: 'list_directory',
		editions: ['desktop'],
		description: 'List a folder inside the agent folder or LabsCode\'s open folders. Relative paths start in the agent folder.',
		input_schema: { type: 'object', properties: { path: { type: 'string' } } },
		run: async ({ path }) => native.agentFs.list(path || '.'),
	});

	addTool({
		name: 'read_file',
		editions: ['desktop'],
		description: 'Read a text file (up to 1 MB) inside the agent folder or LabsCode\'s open folders.',
		input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
		run: async ({ path }) => native.agentFs.read(path),
	});

	addTool({
		name: 'write_file',
		editions: ['desktop'],
		description: 'Write a text file inside the agent folder (default for relative paths) or LabsCode\'s open folders. The user approves first; existing files are only replaced after approval.',
		input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
		run: async ({ path, content }, step) => {
			const target = await native.agentFs.resolve(path);
			if (!target.allowed) throw new Error(`${target.path} is outside the folders the agent may write to (${target.roots.join(', ')}).`);
			let body = preview(content);
			if (target.exists) {
				const old = await native.agentFs.read(target.path).catch(() => null);
				if (old && typeof old.text === 'string') body = await diffView(old.text, content);
			}
			const ok = await step.approve({
				title: `${target.exists ? 'Replace' : 'Create'} ${target.path} (${Omni.util.fmt.bytes(new Blob([content]).size)})`,
				body,
				confirmLabel: target.exists ? 'Replace file' : 'Save file',
			});
			if (!ok) return { written: false, note: 'The user rejected this write.' };
			return native.agentFs.write(target.path, content);
		},
	});

	addTool({
		name: 'delete_file',
		editions: ['desktop'],
		description: 'Move a file inside the agent folder or LabsCode\'s open folders to the Recycle Bin. The user approves first.',
		input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
		run: async ({ path }, step) => {
			const target = await native.agentFs.resolve(path);
			if (!target.allowed) throw new Error(`${target.path} is outside the folders the agent may change.`);
			if (!target.exists) throw new Error(`${target.path} does not exist.`);
			const ok = await step.approve({ title: `Move ${target.path} to the Recycle Bin`, body: h('p', { class: 'muted' }, 'You can restore it from the Recycle Bin.'), confirmLabel: 'Move to Recycle Bin' });
			if (!ok) return { deleted: false, note: 'The user rejected this delete.' };
			return native.agentFs.remove(target.path);
		},
	});
})();
