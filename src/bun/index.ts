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

function toastError(e: unknown) {
	rpc.send.toast({ level: "error", text: String(e) });
}

// ---- RPC 定义（bun 侧 handlers）----
const rpc = BrowserView.defineRPC<PiBunRpcSchema>({
	// bash 命令可能长时间运行，请求超时要放宽
	maxRequestTime: 600_000,
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
			getStats: ({ sessionId }) => ({
				stats: piService.getStats(sessionId),
			}),
			getForkMessages: ({ sessionId }) => ({
				messages: piService.getForkMessages(sessionId),
			}),
			exportSession: ({ sessionId, format }) =>
				piService.exportSession(sessionId, format),
			getQueue: ({ sessionId }) => piService.getQueue(sessionId),
			searchFiles: async ({ sessionId, query }) => ({
				files: await piService.searchFiles(sessionId, query),
			}),
			execBash: ({ sessionId, command, hidden }) =>
				piService.execBash(sessionId, command, hidden),
		},
		messages: {
			prompt: ({ sessionId, text, images, streamingBehavior }) => {
				piService
					.prompt(sessionId, text, images, streamingBehavior)
					.catch(toastError);
			},
			steer: ({ sessionId, text }) => {
				piService.steer(sessionId, text).catch(toastError);
			},
			followUp: ({ sessionId, text }) => {
				piService.followUp(sessionId, text).catch(toastError);
			},
			abort: ({ sessionId }) => {
				piService.abort(sessionId).catch(() => {});
			},
			abortBash: ({ sessionId }) => piService.abortBash(sessionId),
			setModel: ({ sessionId, provider, modelId }) => {
				piService.setModel(sessionId, provider, modelId).catch(toastError);
			},
			setThinking: ({ sessionId, level }) => {
				try {
					piService.setThinking(sessionId, level);
				} catch (e) {
					toastError(e);
				}
			},
			compact: ({ sessionId, instructions }) => {
				piService.compact(sessionId, instructions).catch(toastError);
			},
			rename: ({ sessionId, name }) => piService.rename(sessionId, name),
			navigateTree: ({ sessionId, entryId }) => {
				piService.navigateTree(sessionId, entryId).catch(toastError);
			},
			cloneSession: ({ sessionId }) => {
				piService.cloneSession(sessionId).catch(toastError);
			},
			clearQueue: ({ sessionId }) => {
				try {
					piService.clearQueue(sessionId);
				} catch {
					/* 会话不存在时忽略 */
				}
			},
			reloadResources: ({ sessionId }) => {
				piService
					.reloadResources(sessionId)
					.then(() =>
						rpc.send.toast({ level: "info", text: "资源已重载" }),
					)
					.catch(toastError);
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

const mainWindow = new BrowserWindow({
	title: "Pi Agent Desktop",
	url,
	rpc,
	frame: {
		width: 1280,
		height: 840,
		x: 120,
		y: 60,
	},
});

/**
 * 启动布局自愈：
 * 部分机器（DPI 缩放/多显示器）启动瞬间 WebView2 合成尺寸大于窗口实际尺寸，
 * 底部内容被裁出可视区（输入框紧贴/裁断，手动拖拽一次窗口才恢复）。
 * 尺寸检测不可靠（页面 viewport 与 frame 可能"恰好"一致但仍被裁剪），
 * 因此无条件在启动页遮挡期间轻推一次 frame 强制原生 resize 重同步。
 */
setTimeout(() => {
	try {
		const frame = mainWindow.getFrame();
		mainWindow.setFrame(frame.x, frame.y, frame.width + 2, frame.height + 2);
		setTimeout(() => {
			try {
				mainWindow.setFrame(frame.x, frame.y, frame.width, frame.height);
			} catch {
				/* ignore */
			}
		}, 200);
	} catch (e) {
		console.log("[layout-fix] nudge failed:", e);
	}
}, 500);

console.log("pi-agent-desktop started!");
