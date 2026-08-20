/**
 * PiBun RPC 协议定义（bun 主进程 <-> webview）
 * Electrobun 约定：
 *  - bun.requests    : webview 发起、bun 处理的请求
 *  - bun.messages    : webview 发往 bun 的单向消息
 *  - webview.requests: bun 发起、webview 处理的请求
 *  - webview.messages: bun 发往 webview 的单向消息
 */

export interface ProviderInfo {
	id: string;
	name: string;
	envVar: string;
	hasAuth: boolean;
}

export interface ModelInfo {
	provider: string;
	id: string;
	name: string;
}

export interface SessionSummary {
	path: string;
	id: string;
	cwd: string;
	name?: string;
	created: string;
	modified: string;
	messageCount: number;
	firstMessage: string;
}

export interface AppSettings {
	cwd: string;
	provider: string;
	modelId: string;
	theme: "light" | "dark";
	recentCwds: string[];
}

export interface ActiveSession {
	/** PiBun 内部句柄 id（= pi sessionId） */
	id: string;
	sessionFile?: string;
	cwd: string;
	name?: string;
	model?: ModelInfo;
	isStreaming: boolean;
}

export type PiBunRpcSchema = {
	bun: {
		requests: {
			/** 获取应用设置 + 各 provider 认证状态 */
			getBootstrap: {
				params: void;
				response: {
					settings: AppSettings;
					providers: ProviderInfo[];
					activeSession: ActiveSession | null;
				};
			};
			/** 保存 API key（写入 pi 的 auth.json） */
			setApiKey: {
				params: { provider: string; apiKey: string };
				response: { ok: boolean; error?: string };
			};
			removeApiKey: {
				params: { provider: string };
				response: { ok: boolean; error?: string };
			};
			/** 列出某 provider 可用模型 */
			listModels: {
				params: { provider: string };
				response: { models: ModelInfo[] };
			};
			/** 历史会话列表 */
			listSessions: {
				params: { cwd?: string };
				response: { sessions: SessionSummary[] };
			};
			/** 新建会话并设为当前 */
			newSession: {
				params: { cwd: string; provider?: string; modelId?: string };
				response: { session: ActiveSession } & { error?: string };
			};
			/** 打开历史会话 */
			openSession: {
				params: { path: string };
				response: { session: ActiveSession; error?: string };
			};
			/** 取当前会话完整消息历史 */
			getHistory: {
				params: { sessionId: string };
				response: { messages: unknown[] };
			};
			saveSettings: {
				params: Partial<AppSettings>;
				response: { ok: boolean };
			};
		};
		messages: {
			/** 发送用户消息 */
			prompt: { sessionId: string; text: string };
			/** 流式中插队（steer） */
			steer: { sessionId: string; text: string };
			/** 中断当前运行 */
			abort: { sessionId: string };
			/** 切换模型 */
			setModel: { sessionId: string; provider: string; modelId: string };
		};
	};
	webview: {
		requests: {};
		messages: {
			/** pi agent 事件透传（AgentSessionEvent 原样转发） */
			agentEvent: { sessionId: string; event: unknown };
			/** 会话状态变化（streaming/名字/模型等） */
			sessionState: { session: ActiveSession };
			/** 错误通知 */
			toast: { level: "info" | "error"; text: string };
		};
	};
};
