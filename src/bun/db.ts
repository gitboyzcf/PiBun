/**
 * 应用设置存储（bun:sqlite）
 * API key 不在此存储 —— 由 pi 的 ModelRuntime 持久化到 ~/.pi/agent/auth.json
 */
import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";
import type { AppSettings } from "../shared/rpc-schema";

const dataDir = join(homedir(), ".pi-agent-desktop");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "settings.db"));
db.run(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`);

const DEFAULTS: AppSettings = {
	cwd: homedir(),
	provider: "anthropic",
	modelId: "",
	theme: "light",
	recentCwds: [],
};

function readAll(): AppSettings {
	const rows = db.query("SELECT key, value FROM settings").all() as Array<{
		key: string;
		value: string;
	}>;
	const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	return {
		...DEFAULTS,
		...(map.cwd ? { cwd: map.cwd } : {}),
		...(map.provider ? { provider: map.provider } : {}),
		...(map.modelId ? { modelId: map.modelId } : {}),
		...(map.theme ? { theme: map.theme as AppSettings["theme"] } : {}),
		...(map.recentCwds ? { recentCwds: JSON.parse(map.recentCwds) } : {}),
	};
}

export const settingsStore = {
	get(): AppSettings {
		return readAll();
	},
	save(patch: Partial<AppSettings>): AppSettings {
		const stmt = db.prepare(
			"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		);
		for (const [key, value] of Object.entries(patch)) {
			stmt.run(key, typeof value === "string" ? value : JSON.stringify(value));
		}
		return readAll();
	},
	pushRecentCwd(cwd: string) {
		const s = readAll();
		const list = [cwd, ...s.recentCwds.filter((c) => c !== cwd)].slice(0, 8);
		this.save({ cwd, recentCwds: list });
	},
};
