/**
 * 全局状态 store（Vue reactive 模块，无 pinia）
 * 负责把 pi agent 事件流转换成 UI 渲染条目
 */
import { reactive } from "vue";
import type {
	ActiveSession,
	AppSettings,
	ModelInfo,
	ProviderInfo,
	QueueState,
	SessionStatsPayload,
	SessionSummary,
} from "../shared/rpc-schema";

// ---- 渲染条目模型 ----
export interface UserItem {
	kind: "user";
	id: string;
	text: string;
}
export interface AssistantItem {
	kind: "assistant";
	id: string;
	text: string;
	thinking: string;
	streaming: boolean;
}
export interface ToolItem {
	kind: "tool";
	id: string;
	toolCallId: string;
	toolName: string;
	args: unknown;
	status: "running" | "done" | "error";
	resultText: string;
}
export interface NoticeItem {
	kind: "notice";
	id: string;
	text: string;
}
export type ChatItem = UserItem | AssistantItem | ToolItem | NoticeItem;

interface Toast {
	id: number;
	level: "info" | "error";
	text: string;
}

let seq = 0;
const nid = () => `item-${++seq}`;

export type ModalKind =
	| "settings"
	| "fork"
	| "stats"
	| "hotkeys"
	| "rename"
	| null;

export const store = reactive({
	ready: false,
	settings: null as AppSettings | null,
	providers: [] as ProviderInfo[],
	sessions: [] as SessionSummary[],
	current: null as ActiveSession | null,
	items: [] as ChatItem[],
	models: [] as ModelInfo[],
	toasts: [] as Toast[],
	modal: null as ModalKind,
	stats: null as SessionStatsPayload | null,
	queue: { steering: [], followUp: [] } as QueueState,
	/** abort/clearQueue 后恢复给编辑器的文本 */
	restoredText: "",
	/** 当前流式中的 assistant 条目 */
	_streamingItem: null as AssistantItem | null,
});

export function showToast(level: "info" | "error", text: string) {
	const id = Date.now() + Math.random();
	store.toasts.push({ id, level, text });
	setTimeout(() => {
		const i = store.toasts.findIndex((t) => t.id === id);
		if (i >= 0) store.toasts.splice(i, 1);
	}, level === "error" ? 6000 : 3000);
}

// ---- 工具结果转可读文本 ----
function resultToText(result: unknown): string {
	if (result == null) return "";
	if (typeof result === "string") return result;
	try {
		const r = result as {
			content?: Array<{ type: string; text?: string }>;
			output?: string;
		};
		if (Array.isArray(r.content)) {
			return r.content.map((c) => c.text ?? "").join("\n");
		}
		if (typeof r.output === "string") return r.output;
		return JSON.stringify(result, null, 2).slice(0, 4000);
	} catch {
		return String(result);
	}
}

function argsSummary(args: unknown): string {
	try {
		const a = args as Record<string, unknown>;
		return (a.command ?? a.path ?? a.pattern ?? a.file_path ?? "") as string;
	} catch {
		return "";
	}
}

// ---- 事件处理 ----
export function handleAgentEvent(sessionId: string, raw: unknown) {
	if (!store.current || store.current.id !== sessionId) return;
	const e = raw as {
		type: string;
		message?: {
			role?: string;
			content?: unknown;
		};
		assistantMessageEvent?: { type: string; delta?: string };
		toolCallId?: string;
		toolName?: string;
		args?: unknown;
		result?: unknown;
		isError?: boolean;
		attempt?: number;
		maxAttempts?: number;
		errorMessage?: string;
		delta?: string;
		steering?: readonly string[];
		followUp?: readonly string[];
	};

	switch (e.type) {
		case "agent_start":
			if (store.current) store.current.isStreaming = true;
			break;

		case "queue_update":
			store.queue = {
				steering: [...(e.steering ?? [])],
				followUp: [...(e.followUp ?? [])],
			};
			break;

		case "bash_execution_update": {
			// 用户 `!` 命令的流式输出：追加到运行中的 user-bash 卡片
			const item = [...store.items]
				.reverse()
				.find(
					(i): i is ToolItem =>
						i.kind === "tool" &&
						i.toolCallId === "user-bash" &&
						i.status === "running",
				);
			if (item && e.delta) item.resultText += e.delta;
			break;
		}

		case "message_start":
			if (e.message?.role === "assistant") {
				const item: AssistantItem = {
					kind: "assistant",
					id: nid(),
					text: "",
					thinking: "",
					streaming: true,
				};
				store.items.push(item);
				store._streamingItem = item;
			} else if (e.message?.role === "user") {
				store.items.push({
					kind: "user",
					id: nid(),
					text: contentToText(e.message.content),
				});
			}
			break;

		case "message_update": {
			const item = store._streamingItem;
			const ame = e.assistantMessageEvent;
			if (!item || !ame) break;
			if (ame.type === "text_delta" && ame.delta) {
				item.text += ame.delta;
			} else if (ame.type === "thinking_delta" && ame.delta) {
				item.thinking += ame.delta;
			}
			break;
		}

		case "message_end":
			if (store._streamingItem) {
				// 以完整消息为准，防止 delta 丢失
				const text = contentToText(e.message?.content, "text");
				const thinking = contentToText(e.message?.content, "thinking");
				if (text) store._streamingItem.text = text;
				if (thinking) store._streamingItem.thinking = thinking;
				store._streamingItem.streaming = false;
				store._streamingItem = null;
			}
			break;

		case "tool_execution_start":
			store.items.push({
				kind: "tool",
				id: nid(),
				toolCallId: e.toolCallId ?? nid(),
				toolName: e.toolName ?? "tool",
				args: e.args,
				status: "running",
				resultText: "",
			});
			break;

		case "tool_execution_end": {
			const item = [...store.items]
				.reverse()
				.find(
					(i): i is ToolItem =>
						i.kind === "tool" && i.toolCallId === e.toolCallId,
				);
			if (item) {
				item.status = e.isError ? "error" : "done";
				item.resultText = resultToText(e.result);
			}
			break;
		}

		case "auto_retry_start":
			store.items.push({
				kind: "notice",
				id: nid(),
				text: `请求失败，正在重试 (${e.attempt}/${e.maxAttempts})：${e.errorMessage ?? ""}`,
			});
			break;

		case "compaction_start":
			store.items.push({ kind: "notice", id: nid(), text: "正在压缩上下文…" });
			break;

		case "agent_settled":
			if (store.current) store.current.isStreaming = false;
			if (store._streamingItem) {
				store._streamingItem.streaming = false;
				store._streamingItem = null;
			}
			break;
	}
}

export function handleSessionState(session: ActiveSession) {
	if (store.current && store.current.id === session.id) {
		store.current = session;
		// 同步侧栏名字
		const s = store.sessions.find((x) => x.id === session.id);
		if (s && session.name) s.name = session.name;
	}
}

// ---- 消息内容提取 ----
function contentToText(content: unknown, only?: "text" | "thinking"): string {
	if (typeof content === "string") return only ? "" : content;
	if (!Array.isArray(content)) return "";
	return (content as Array<{ type: string; text?: string; thinking?: string }>)
		.filter((b) => (only ? b.type === only : b.type === "text"))
		.map((b) => b.text ?? b.thinking ?? "")
		.join("");
}

/** 历史消息 -> 渲染条目 */
export function historyToItems(messages: unknown[]): ChatItem[] {
	const items: ChatItem[] = [];
	for (const raw of messages) {
		const m = raw as {
			role?: string;
			customType?: string;
			content?: unknown;
			toolName?: string;
			toolCallId?: string;
			isError?: boolean;
			command?: string;
			output?: string;
			exitCode?: number | null;
		};
		// 用户 `!` bash 执行消息（BashExecutionMessage）
		if (m.command !== undefined && m.output !== undefined) {
			items.push({
				kind: "tool",
				id: nid(),
				toolCallId: "user-bash",
				toolName: "bash",
				args: { command: m.command },
				status: m.exitCode === 0 ? "done" : "error",
				resultText: m.output,
			});
			continue;
		}
		if (m.role === "user") {
			const text = contentToText(m.content);
			if (text.trim()) items.push({ kind: "user", id: nid(), text });
		} else if (m.role === "assistant") {
			const blocks = Array.isArray(m.content) ? m.content : [];
			const text = contentToText(m.content, "text");
			const thinking = contentToText(m.content, "thinking");
			if (text || thinking) {
				items.push({
					kind: "assistant",
					id: nid(),
					text,
					thinking,
					streaming: false,
				});
			}
			// 历史中的工具调用块
			for (const b of blocks as Array<Record<string, unknown>>) {
				if (b.type === "toolcall" || b.type === "toolCall" || b.type === "tool_use") {
					items.push({
						kind: "tool",
						id: nid(),
						toolCallId: (b.id as string) ?? nid(),
						toolName: (b.name as string) ?? "tool",
						args: b.arguments ?? b.args ?? b.input,
						status: "done",
						resultText: "",
					});
				}
			}
		} else if (m.role === "toolResult" || m.role === "tool_result") {
			// 回填到对应工具卡片
			const item = [...items]
				.reverse()
				.find(
					(i): i is ToolItem =>
						i.kind === "tool" && i.toolCallId === m.toolCallId,
				);
			if (item) {
				item.status = m.isError ? "error" : "done";
				item.resultText = resultToText(m.content ?? m);
			}
		}
	}
	return items;
}

export { argsSummary };
