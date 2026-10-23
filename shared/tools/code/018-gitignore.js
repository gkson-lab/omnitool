// No. 018 .gitignore generator: combines ignore templates for languages, editors and operating systems.
(function () {
	'use strict';
	const T = {
		node: ['# Node.js', 'node_modules/', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', 'pnpm-debug.log*', '.npm/', 'dist/', 'build/', 'coverage/', '.cache/', '.parcel-cache/', '.next/', '.nuxt/', '.vite/', '*.tsbuildinfo'],
		python: ['# Python', '__pycache__/', '*.py[cod]', '*.egg-info/', '.eggs/', 'build/', 'dist/', '.venv/', 'venv/', 'env/', '.pytest_cache/', '.mypy_cache/', '.ruff_cache/', '.coverage', 'htmlcov/', '.ipynb_checkpoints/'],
		java: ['# Java', '*.class', '*.jar', '*.war', '*.ear', 'target/', '.gradle/', 'build/', 'out/', 'hs_err_pid*'],
		go: ['# Go', '*.exe', '*.test', '*.out', 'vendor/', 'go.work.sum'],
		rust: ['# Rust', 'target/', '**/*.rs.bk', '*.pdb'],
		cpp: ['# C and C++', '*.o', '*.obj', '*.so', '*.dylib', '*.dll', '*.a', '*.lib', '*.exe', 'build/', 'cmake-build-*/', 'CMakeFiles/', 'CMakeCache.txt'],
		dotnet: ['# .NET', 'bin/', 'obj/', '*.user', '*.suo', '.vs/', 'TestResults/', '*.nupkg', 'packages/'],
		ruby: ['# Ruby', '*.gem', '.bundle/', 'vendor/bundle/', 'log/', 'tmp/', 'coverage/'],
		php: ['# PHP', 'vendor/', 'composer.phar', '.phpunit.result.cache'],
		android: ['# Android', '*.apk', '*.aab', '.gradle/', 'local.properties', '.externalNativeBuild/', '.cxx/', 'captures/', 'build/'],
		swift: ['# Swift and Xcode', 'DerivedData/', '*.xcuserstate', 'xcuserdata/', '.build/', 'Pods/', '*.ipa', '*.dSYM.zip'],
		unity: ['# Unity', '/[Ll]ibrary/', '/[Tt]emp/', '/[Oo]bj/', '/[Bb]uild/', '/[Bb]uilds/', '/[Ll]ogs/', '/[Uu]ser[Ss]ettings/', '*.csproj', '*.sln'],
		terraform: ['# Terraform', '.terraform/', '*.tfstate', '*.tfstate.*', 'crash.log', '*.tfvars', '.terraform.lock.hcl'],
		vscode: ['# VS Code and LabsCode', '.vscode/*', '!.vscode/settings.json', '!.vscode/tasks.json', '!.vscode/launch.json', '!.vscode/extensions.json', '*.code-workspace'],
		jetbrains: ['# JetBrains IDEs', '.idea/', '*.iml', '*.iws', 'out/'],
		vim: ['# Vim', '*.swp', '*.swo', '*~', 'Session.vim', '.netrwhist'],
		vs: ['# Visual Studio', '.vs/', '*.user', '*.userosscache', '*.sln.docstates'],
		windows: ['# Windows', 'Thumbs.db', 'ehthumbs.db', 'Desktop.ini', '$RECYCLE.BIN/', '*.lnk'],
		macos: ['# macOS', '.DS_Store', '.AppleDouble', '.LSOverride', '._*', '.Spotlight-V100', '.Trashes'],
		linux: ['# Linux', '*~', '.fuse_hidden*', '.directory', '.Trash-*', '.nfs*'],
		env: ['# Secrets and local config', '.env', '.env.*', '!.env.example', '*.pem', '*.key', 'secrets.json'],
		logs: ['# Logs and temp files', 'logs/', '*.log', 'tmp/', 'temp/', '*.tmp'],
	};
	const groups = [
		['Languages', ['node', 'python', 'java', 'go', 'rust', 'cpp', 'dotnet', 'ruby', 'php', 'android', 'swift', 'unity', 'terraform'], { node: 'Node.js', python: 'Python', java: 'Java', go: 'Go', rust: 'Rust', cpp: 'C and C++', dotnet: '.NET', ruby: 'Ruby', php: 'PHP', android: 'Android', swift: 'Swift and Xcode', unity: 'Unity', terraform: 'Terraform' }],
		['Editors', ['vscode', 'jetbrains', 'vim', 'vs'], { vscode: 'VS Code and LabsCode', jetbrains: 'JetBrains', vim: 'Vim', vs: 'Visual Studio' }],
		['Systems and extras', ['windows', 'macos', 'linux', 'env', 'logs'], { windows: 'Windows', macos: 'macOS', linux: 'Linux', env: 'Secrets (.env, keys)', logs: 'Logs and temp files' }],
	];
	const inputs = groups.flatMap(([, keys, labels]) => keys.map((k) => ({ name: k, label: labels[k], type: 'checkbox', default: ['node', 'vscode', 'windows', 'macos', 'env', 'logs'].includes(k) })));

	Omni.register({
		no: 18,
		id: 'gitignore',
		name: '.gitignore generator',
		category: 'code',
		keywords: ['gitignore', 'git', 'ignore', 'template'],
		description: 'Builds a .gitignore from templates for languages, editors and operating systems.',
		live: true,
		inputs: [...inputs, { name: 'extra', label: 'Your own lines', type: 'textarea', rows: 3, mono: true, placeholder: 'One pattern per line' }],
		run(args) {
			const seen = new Set();
			const sections = Object.keys(T).filter((k) => args[k]).map((k) => T[k].filter((line) => line.startsWith('#') || (!seen.has(line) && seen.add(line))).join('\n'));
			if (args.extra && args.extra.trim()) sections.push('# Project specific\n' + args.extra.trim());
			if (!sections.length) return { note: 'Tick at least one template.' };
			const text = sections.join('\n\n') + '\n';
			return { text, label: '.gitignore', download: { name: '.gitignore', data: text, label: 'Download .gitignore' } };
		},
	});
})();
