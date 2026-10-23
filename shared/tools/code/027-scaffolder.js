// No. 027 Project scaffolder (desktop): previews a starter project's files, then creates them after confirmation.
(function () {
	'use strict';
	const today = () => new Date().toISOString().slice(0, 10);
	const TEMPLATES = {
		static: {
			label: 'Static website',
			files: (n) => ({
				'index.html': `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${n}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main>\n    <h1>${n}</h1>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
				'style.css': '* { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; }\nmain { max-width: 720px; margin: 0 auto; padding: 32px 16px; }\n',
				'script.js': "document.documentElement.classList.add('js');\n",
				'README.md': `# ${n}\n\nCreated with OmniTool on ${today()}. Open index.html in a browser.\n`,
			}),
		},
		node: {
			label: 'Node.js command-line tool',
			files: (n) => {
				const id = n.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
				return {
					'package.json': JSON.stringify({ name: id, version: '0.1.0', description: '', type: 'module', bin: { [id]: './bin/cli.js' }, scripts: { start: 'node bin/cli.js', test: 'node --test' }, license: 'MIT' }, null, 2) + '\n',
					'bin/cli.js': `#!/usr/bin/env node\nconst [, , ...args] = process.argv;\n\nif (args.includes('--help')) {\n  console.log('Usage: ${id} [name]');\n  process.exit(0);\n}\n\nconsole.log(\`Hello, \${args[0] || 'world'}\`);\n`,
					'test/cli.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('placeholder', () => {\n  assert.equal(1 + 1, 2);\n});\n",
					'.gitignore': 'node_modules/\n.env\n',
					'README.md': `# ${n}\n\nCreated with OmniTool on ${today()}.\n\n    npm start -- yourname\n    npm test\n`,
				};
			},
		},
		python: {
			label: 'Python script',
			files: (n) => ({
				'main.py': '"""Entry point."""\nimport argparse\n\n\ndef main() -> None:\n    parser = argparse.ArgumentParser()\n    parser.add_argument("name", nargs="?", default="world")\n    args = parser.parse_args()\n    print(f"Hello, {args.name}")\n\n\nif __name__ == "__main__":\n    main()\n',
				'requirements.txt': '',
				'tests/test_main.py': 'def test_placeholder():\n    assert 1 + 1 == 2\n',
				'.gitignore': '__pycache__/\n.venv/\n.env\n',
				'README.md': `# ${n}\n\nCreated with OmniTool on ${today()}.\n\n    python -m venv .venv\n    python main.py yourname\n`,
			}),
		},
	};

	Omni.register({
		no: 27,
		id: 'scaffolder',
		name: 'Project scaffolder',
		category: 'code',
		editions: ['desktop'],
		keywords: ['scaffold', 'new project', 'template', 'starter', 'boilerplate'],
		description: 'Creates a starter project (static site, Node.js CLI or Python script) in a folder you choose, after showing every file.',
		ai: false,
		mount(root, ctx) {
			const { h } = Omni;
			const tpl = h('select', { id: 'sc-tpl' }, Object.entries(TEMPLATES).map(([k, t]) => h('option', { value: k }, t.label)));
			tpl.value = ctx.store.get('tpl', 'static');
			const name = h('input', { type: 'text', id: 'sc-name', value: ctx.store.get('name', 'my-project') });
			let parent = ctx.store.get('parent', null);
			const parentLabel = h('code', null, parent || 'not chosen');
			const preview = h('div', { class: 'stack' });
			const files = () => TEMPLATES[tpl.value].files(name.value.trim() || 'my-project');
			const draw = () => {
				ctx.store.set('tpl', tpl.value);
				ctx.store.set('name', name.value);
				const f = files();
				preview.replaceChildren(...Object.entries(f).map(([path, content]) => h('details', null, h('summary', null, h('code', null, path), h('span', { class: 'muted' }, ` ${Omni.util.fmt.bytes(new Blob([content]).size)}`)), h('pre', { class: 'readout' }, content || '(empty file)'))));
			};
			const choose = async () => {
				const p = await Omni.native.dialog.openFolder();
				if (p) {
					parent = p;
					ctx.store.set('parent', p);
					parentLabel.textContent = p;
				}
			};
			const create = async () => {
				const n = name.value.trim();
				if (!/^[\w][\w .-]*$/.test(n)) return Omni.ui.toast('Use letters, numbers, spaces, dots, dashes or underscores in the name.', { error: true });
				if (!parent) return Omni.ui.toast('Choose where to create it first.', { error: true });
				const f = files();
				const ok = await Omni.ui.confirm({ title: `Create ${Object.keys(f).length} files?`, body: `A new folder "${n}" will be created in ${parent}. Nothing existing is overwritten.`, confirmLabel: 'Create project' });
				if (!ok) return;
				try {
					const dir = await Omni.native.scaffold.create(parent, n, f);
					Omni.ui.toast(`Created ${dir}`);
					preview.prepend(h('div', { class: 'state' }, h('strong', null, `Created ${dir}`), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => Omni.native.shell.openPath(dir) }, 'Open folder'), h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
						Omni.native.labscode.openFolder(dir);
						Omni.open('labscode');
					} }, 'Open in LabsCode'))));
				} catch (err) {
					Omni.ui.toast(err.message, { error: true, title: 'Not created.' });
				}
			};
			tpl.addEventListener('change', draw);
			name.addEventListener('input', Omni.util.debounce(draw, 200));
			root.appendChild(h('div', { class: 'io split' },
				h('div', { class: 'panel stack' }, h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'sc-tpl' }, 'Template'), tpl), h('div', { class: 'field' }, h('label', { for: 'sc-name' }, 'Project name'), name)), h('p', null, 'Create in: ', parentLabel), h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: choose }, 'Choose folder'), h('button', { type: 'button', class: 'btn btn-primary', onclick: create }, 'Create project'))),
				h('section', { class: 'panel stack', 'aria-label': 'Files' }, h('h2', null, 'Files'), preview),
			));
			draw();
		},
	});
})();
