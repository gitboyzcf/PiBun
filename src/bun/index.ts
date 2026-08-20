/**
 * PiBun 主进程入口
 * Electrobun (Bun 运行时) + pi agent SDK + Vue3 webview
 */
import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import type { PiBunRpcSchema } from "../shared/rpc-schema";
import { piService } from "./pi-service";
import { settingsStore } from "./db";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log("Vite dev server not running, using bundled views.");
		}
	}
	return "views://mainview/index.html";
}

// ---- RPC 定义（bun 侧 handlers）----
const rpc = BrowserView.defineRPC<PiBunRpcSchema>({
	maxRequestTime: 60_000,
	handlers: {
		requests: {
			getBootstrap: async () => ({
				settings: settingsStore.get(),
				providers: await piService.getProviders(),
				activeSession: piService.getCurrent(),
			}),
			setApiKey: ({ provider, apiKey }) =>
				piService.setApiKey(provider, apiKey),
			removeApiKey: ({ provider }) => piService.removeApiKey(provider),
			listModels: async ({ provider }) => ({
				models: await piService.listModels(provider),
			}),
			listSessions: async ({ cwd }) => ({
				sessions: await piService.listSessions(cwd),
			}),
			newSession: async ({ cwd, provider, modelId }) => {
				const result = await piService.newSession(cwd, provider, modelId);
				if (result.session) settingsStore.pushRecentCwd(cwd);
				return result;
			},
			openSession: ({ path }) => piService.openSession(path),
			getHistory: ({ sessionId }) => ({
				messages: piService.getHistory(sessionId),
			}),
			saveSettings: (patch) => {
				settingsStore.save(patch);
				return { ok: true };
			},
		},
		messages: {
			prompt: ({ sessionId, text }) => {
				piService.prompt(sessionId, text).catch((e) => {
					rpc.send.toast({ level: "error", text: String(e) });
				});
			},
			steer: ({ sessionId, text }) => {
				piService.steer(sessionId, text).catch((e) => {
					rpc.send.toast({ level: "error", text: String(e) });
				});
			},
			abort: ({ sessionId }) => {
				piService.abort(sessionId).catch(() => {});
			},
			setModel: ({ sessionId, provider, modelId }) => {
				piService.setModel(sessionId, provider, modelId).catch((e) => {
					rpc.send.toast({ level: "error", text: String(e) });
				});
			},
		},
	},
});

// pi 事件 -> webview
piService.onEvent((sessionId, event) => {
	try {
		rpc.send.agentEvent({ sessionId, event });
	} catch (e) {
		console.error("forward event failed:", e);
	}
});
piService.onState((session) => {
	rpc.send.sessionState({ session });
});

// ---- 窗口 ----
const url = await getMainViewUrl();

new BrowserWindow({
	title: "PiBun - pi agent 客户端",
	url,
	rpc,
	frame: {
		width: 1280,
		height: 840,
		x: 120,
		y: 60,
	},
});

console.log("PiBun started!");
