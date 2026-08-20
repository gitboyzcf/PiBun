/**
 * UI 动作层：调用主进程 RPC
 */
import { rpc } from "./rpc";
import { store, historyToItems, showToast } from "./store";

export async function bootstrap() {
	try {
		const { settings, providers, activeSession } =
			await rpc.request.getBootstrap();
		store.settings = settings;
		store.providers = providers;
		if (activeSession) {
			store.current = activeSession;
			await loadHistory(activeSession.id);
		}
		await refreshSessions();
		// 没有任何已认证 provider -> 打开设置引导
		if (!providers.some((p) => p.hasAuth)) {
			store.settingsOpen = true;
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
	// 当前目录没有会话时展示全部
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
	await refreshSessions();
}

export async function openSession(path: string) {
	const { session, error } = await rpc.request.openSession({ path });
	if (error || !session) {
		showToast("error", error ?? "打开会话失败");
		return;
	}
	store.current = session;
	await loadHistory(session.id);
}

export function sendPrompt(text: string) {
	if (!store.current || !text.trim()) return;
	rpc.send.prompt({ sessionId: store.current.id, text: text.trim() });
}

export function abortRun() {
	if (!store.current) return;
	rpc.send.abort({ sessionId: store.current.id });
}

export async function saveApiKey(provider: string, apiKey: string) {
	const result = await rpc.request.setApiKey({ provider, apiKey });
	if (!result.ok) {
		showToast("error", result.error ?? "保存失败");
		return false;
	}
	showToast("info", "API Key 已保存");
	// 刷新认证状态
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
	store.settings && (store.settings.provider = provider);
	store.settings && (store.settings.modelId = modelId);
	rpc.request.saveSettings({ provider, modelId });
}

export async function saveCwd(cwd: string) {
	await rpc.request.saveSettings({ cwd });
	if (store.settings) store.settings.cwd = cwd;
	await refreshSessions();
}
