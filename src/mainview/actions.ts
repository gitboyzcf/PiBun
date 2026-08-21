/**
 * UI 动作层：调用主进程 RPC
 */
import { rpc } from "./rpc";
import {
	store,
	historyToItems,
	showToast,
	type ToolItem,
} from "./store";
import type { ImageAttachment } from "../shared/rpc-schema";

export async function bootstrap() {
	try {
		const { settings, providers, activeSession } =
			await rpc.request.getBootstrap();
		store.settings = settings;
		store.providers = providers;
		if (activeSession) {
			store.current = activeSession;
			await loadHistory(activeSession.id);
			refreshStats();
		}
		await refreshSessions();
		// 没有任何已认证 provider -> 打开设置引导
		if (!providers.some((p) => p.hasAuth)) {
			store.modal = "settings";
		}
		store.ready = true;
	} catch (e) {
		showToast("error", `初始化失败: ${e}`);
		store.ready = true;
	}
}

export async function refreshSessions() {
	const cwd = store.settings?.cwd;
	const { sessions } = await rpc.request.listSessions({ cwd });
	if (sessions.length === 0) {
		const all = await rpc.request.listSessions({});
		store.sessions = all.sessions.slice(0, 50);
	} else {
		store.sessions = sessions;
	}
}

export async function loadHistory(sessionId: string) {
	const { messages } = await rpc.request.getHistory({ sessionId });
	store.items = historyToItems(messages);
}

export async function newSession() {
	if (!store.settings) return;
	const result = await rpc.request.newSession({
		cwd: store.settings.cwd,
		provider: store.settings.provider || undefined,
		modelId: store.settings.modelId || undefined,
	});
	if (result.error || !result.session) {
		showToast("error", result.error ?? "创建会话失败");
		return;
	}
	store.current = result.session;
	store.items = [];
	store.stats = null;
	store.queue = { steering: [], followUp: [] };
	await refreshSessions();
	refreshStats();
}

export async function openSession(path: string) {
	const { session, error } = await rpc.request.openSession({ path });
	if (error || !session) {
		showToast("error", error ?? "打开会话失败");
		return;
	}
	store.current = session;
	store.queue = { steering: [], followUp: [] };
	await loadHistory(session.id);
	refreshStats();
}

export function sendPrompt(
	text: string,
	images?: ImageAttachment[],
	streamingBehavior?: "steer" | "followUp",
) {
	if (!store.current || !text.trim()) return;
	rpc.send.prompt({
		sessionId: store.current.id,
		text: text.trim(),
		images,
		streamingBehavior,
	});
}

export function abortRun() {
	if (!store.current) return;
	rpc.send.abort({ sessionId: store.current.id });
	// TUI 行为：abort 后把排队消息恢复到编辑器
	const q = store.queue;
	const parts = [...q.steering, ...q.followUp];
	if (parts.length) store.restoredText = parts.join("\n");
}

export async function refreshStats() {
	if (!store.current) return;
	const { stats } = await rpc.request.getStats({
		sessionId: store.current.id,
	});
	if (stats) store.stats = stats;
}

// ================= TUI 命令动作 =================

/** ! / !! shell 命令 */
export async function execBash(command: string, hidden: boolean) {
	if (!store.current) return;
	const item: ToolItem = {
		kind: "tool",
		id: `bash-${Date.now()}`,
		toolCallId: "user-bash",
		toolName: hidden ? "bash(隐藏)" : "bash",
		args: { command },
		status: "running",
		resultText: "",
	};
	store.items.push(item);
	const { result, error } = await rpc.request.execBash({
		sessionId: store.current.id,
		command,
		hidden,
	});
	if (error) {
		item.status = "error";
		item.resultText = error;
	} else if (result) {
		item.status = result.exitCode === 0 ? "done" : "error";
		if (result.cancelled) item.resultText += "\n（已取消）";
		// 流式期间已填充则不覆盖
		if (result.output && result.output.length > item.resultText.length) {
			item.resultText = result.output;
		}
	}
}

export function setThinking(level: string) {
	if (!store.current) return;
	rpc.send.setThinking({ sessionId: store.current.id, level });
	// 立即更新 UI，SDK 会校验合法性
	if (store.stats) store.stats.thinkingLevel = level;
	setTimeout(refreshStats, 300);
}

export function cycleThinking() {
	const s = store.stats;
	if (!s || !store.current) return;
	const levels = s.availableThinkingLevels;
	const i = levels.indexOf(s.thinkingLevel);
	const next = levels[(i + 1) % levels.length];
	if (next) setThinking(next);
}

export function compactSession(instructions?: string) {
	if (!store.current) return;
	rpc.send.compact({
		sessionId: store.current.id,
		instructions,
	});
	showToast("info", "正在压缩上下文…");
}

export function renameSession(name: string) {
	if (!store.current || !name.trim()) return;
	rpc.send.rename({ sessionId: store.current.id, name: name.trim() });
	refreshSessions();
}

export async function navigateTree(entryId: string) {
	if (!store.current) return;
	rpc.send.navigateTree({ sessionId: store.current.id, entryId });
	// 树导航改变 leaf，稍后重载历史
	setTimeout(async () => {
		if (store.current) await loadHistory(store.current.id);
	}, 300);
}

export async function cloneSession() {
	if (!store.current) return;
	rpc.send.cloneSession({ sessionId: store.current.id });
	showToast("info", "正在克隆会话…");
	setTimeout(refreshSessions, 800);
}

export async function exportSession(format: "html" | "jsonl") {
	if (!store.current) return;
	const { path, error } = await rpc.request.exportSession({
		sessionId: store.current.id,
		format,
	});
	if (error || !path) {
		showToast("error", error ?? "导出失败");
	} else {
		showToast("info", `已导出：${path}`);
	}
}

export function copyLastAssistant() {
	const last = [...store.items]
		.reverse()
		.find((i) => i.kind === "assistant" && i.text.trim());
	if (!last || last.kind !== "assistant") {
		showToast("info", "没有可复制的回复");
		return;
	}
	navigator.clipboard
		.writeText(last.text)
		.then(() => showToast("info", "已复制最后一条回复"))
		.catch(() => showToast("error", "复制失败"));
}

export function reloadResources() {
	if (!store.current) return;
	rpc.send.reloadResources({ sessionId: store.current.id });
}

export async function searchFiles(query: string) {
	if (!store.current) return [];
	const { files } = await rpc.request.searchFiles({
		sessionId: store.current.id,
		query,
	});
	return files;
}

export async function saveApiKey(provider: string, apiKey: string) {
	const result = await rpc.request.setApiKey({ provider, apiKey });
	if (!result.ok) {
		showToast("error", result.error ?? "保存失败");
		return false;
	}
	showToast("info", "API Key 已保存");
	const { providers } = await rpc.request.getBootstrap();
	store.providers = providers;
	await loadModels(provider);
	return true;
}

export async function removeApiKey(provider: string) {
	await rpc.request.removeApiKey({ provider });
	const { providers } = await rpc.request.getBootstrap();
	store.providers = providers;
}

export async function loadModels(provider: string) {
	const { models } = await rpc.request.listModels({ provider });
	store.models = models;
}

export function selectModel(provider: string, modelId: string) {
	if (!store.current) return;
	rpc.send.setModel({ sessionId: store.current.id, provider, modelId });
	if (store.settings) {
		store.settings.provider = provider;
		store.settings.modelId = modelId;
	}
	rpc.request.saveSettings({ provider, modelId });
	setTimeout(refreshStats, 300);
}

export async function saveCwd(cwd: string) {
	await rpc.request.saveSettings({ cwd });
	if (store.settings) store.settings.cwd = cwd;
	await refreshSessions();
}
