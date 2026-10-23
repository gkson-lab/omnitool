// Settings in desktop/data/config.json and API keys in secrets.json, encrypted with Windows DPAPI via safeStorage.
'use strict';
const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

function readJson(file, fallback) {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch {
		return fallback;
	}
}

/** Writes through a temporary file so a crash mid-write never leaves half a config. */
function writeJson(file, data) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
	fs.renameSync(tmp, file);
}

class Config {
	constructor(dataDir) {
		this.file = path.join(dataDir, 'config.json');
		this.data = readJson(this.file, {});
	}
	load() {
		return this.data;
	}
	save(obj) {
		if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Config must be an object');
		this.data = obj;
		writeJson(this.file, obj);
	}
	get(key, fallback) {
		return key in this.data ? this.data[key] : fallback;
	}
	set(key, value) {
		this.data[key] = value;
		writeJson(this.file, this.data);
	}
}

class Secrets {
	constructor(dataDir) {
		this.file = path.join(dataDir, 'secrets.json');
		this.memory = {};
	}
	encrypted() {
		return safeStorage.isEncryptionAvailable();
	}
	where() {
		return this.encrypted()
			? 'desktop\\data\\secrets.json, encrypted with your Windows account (DPAPI) so it only opens for you on this PC'
			: 'memory only, because Windows encryption is not available here, so it is gone when OmniTool closes';
	}
	get(name) {
		if (!this.encrypted()) return this.memory[name] || null;
		const all = readJson(this.file, {});
		if (!all[name]) return null;
		try {
			return safeStorage.decryptString(Buffer.from(all[name], 'base64'));
		} catch {
			return null;
		}
	}
	set(name, value) {
		if (typeof value !== 'string' || value.length > 4096) throw new Error('Secret must be a string under 4 KB');
		if (!this.encrypted()) {
			this.memory[name] = value;
			return true;
		}
		const all = readJson(this.file, {});
		all[name] = safeStorage.encryptString(value).toString('base64');
		writeJson(this.file, all);
		return true;
	}
	clear(name) {
		delete this.memory[name];
		const all = readJson(this.file, {});
		delete all[name];
		writeJson(this.file, all);
		return true;
	}
}

module.exports = { Config, Secrets, readJson, writeJson };
