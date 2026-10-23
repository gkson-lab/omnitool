// No. 011 SQL formatter (sql-formatter), with dialects and keyword case.
Omni.register({
	no: 11,
	id: 'sql-formatter',
	name: 'SQL formatter',
	category: 'code',
	keywords: ['sql', 'format', 'query', 'postgres', 'mysql', 'sqlite'],
	description: 'Formats SQL for several dialects with keyword case options.',
	vendor: ['sql-formatter.min.js'],
	live: true,
	inputs: [
		{ name: 'sql', label: 'SQL', type: 'textarea', mono: true, rows: 10, default: "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.created_at > '2026-01-01' group by u.id, u.name having count(o.id) > 2 order by orders desc limit 20;" },
		{ name: 'language', label: 'Dialect', type: 'select', options: [{ value: 'sql', label: 'Standard SQL' }, { value: 'postgresql', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL' }, { value: 'mariadb', label: 'MariaDB' }, { value: 'sqlite', label: 'SQLite' }, { value: 'tsql', label: 'SQL Server (T-SQL)' }, { value: 'plsql', label: 'Oracle PL/SQL' }, { value: 'bigquery', label: 'BigQuery' }, { value: 'snowflake', label: 'Snowflake' }], default: 'sql' },
		{ name: 'keywordCase', label: 'Keywords', type: 'select', options: [{ value: 'upper', label: 'UPPER' }, { value: 'lower', label: 'lower' }, { value: 'preserve', label: 'As typed' }], default: 'upper' },
		{ name: 'tabWidth', label: 'Indent', type: 'select', options: ['2', '4'], default: '2' },
	],
	run({ sql, language, keywordCase, tabWidth }) {
		if (!sql.trim()) return { note: 'Paste SQL above.' };
		try {
			return { text: window.sqlFormatter.format(sql, { language, keywordCase, tabWidth: Number(tabWidth) }), label: 'Formatted SQL' };
		} catch (err) {
			throw new Error(`The ${language} parser stopped: ${err.message}`);
		}
	},
});
