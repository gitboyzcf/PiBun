/**
 * pi-agent-desktop RPC 协议定义（bun 主进程 <-> webview）
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
	/** 内部句柄 id（= pi sessionId） */
	id: string;
	sessionFile?: string;
	cwd: string;
	name?: string;
	model?: ModelInfo;
	isStreaming: boolean;
}

export interface SessionStatsPayload {
	sessionFile?: string;
	sessionId: string;
	userMessages: number;
	assistantMessages: number;
	toolCalls: number;
	totalMessages: number;
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
	cost: number;
	/** context 窗口占用（0-1），无则 undefined */
	contextPercent?: number;
	contextTokens?: number;
	contextWindow?: number;
	thinkingLevel: string;
	availableThinkingLevels: string[];
	model?: ModelInfo;
	activeTools: string[];
}

export interface ForkMessage {
	entryId: string;
	text: string;
}

export interface QueueState {
	steering: string[];
	followUp: string[];
}

export interface FileHit {
	path: string;
	kind: "file" | "dir";
}

export interface ImageAttachment {
	data: string; // base64
	mimeType: string;
	name: string;
}

export interface BashResultPayload {
	output: string;
	exitCode: number | null;
	cancelled: boolean;
	truncated: boolean;
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
			/** 会话统计 + thinking + context 用量（footer 数据源） */
			getStats: {
				params: { sessionId: string };
				response: { stats: SessionStatsPayload | null };
			};
			/** fork/tree 选择器数据：会话内全部 user 消息 */
			getForkMessages: {
				params: { sessionId: string };
				response: { messages: ForkMessage[] };
			};
			/** 导出会话，返回文件路径 */
			exportSession: {
				params: { sessionId: string; format: "html" | "jsonl" };
				response: { path?: string; error?: string };
			};
			/** 当前排队消息 */
			getQueue: {
				params: { sessionId: string };
				response: QueueState;
			};
			/** @ 文件补全：在会话 cwd 下模糊搜索 */
			searchFiles: {
				params: { sessionId: string; query: string };
				response: { files: FileHit[] };
			};
			/** 执行 shell 命令（! / !! 前缀） */
			execBash: {
				params: { sessionId: string; command: string; hidden: boolean };
				response: { result?: BashResultPayload; error?: string };
			};
		};
		messages: {
			/** 发送用户消息（可带图片附件） */
			prompt: {
				sessionId: string;
				text: string;
				images?: ImageAttachment[];
				/** 流式中发送时的排队方式 */
				streamingBehavior?: "steer" | "followUp";
			};
			/** 流式中插队（steer） */
			steer: { sessionId: string; text: string };
			/** 排队等 agent 完成后执行（followUp） */
			followUp: { sessionId: string; text: string };
			/** 中断当前运行 */
			abort: { sessionId: string };
			/** 中断 shell 命令 */
			abortBash: { sessionId: string };
			/** 切换模型 */
			setModel: { sessionId: string; provider: string; modelId: string };
			/** 设置 thinking level */
			setThinking: { sessionId: string; level: string };
			/** 手动压缩上下文 */
			compact: { sessionId: string; instructions?: string };
			/** 会话重命名 */
			rename: { sessionId: string; name: string };
			/** tree 导航：跳到会话中任意节点继续（同一文件内分支） */
			navigateTree: { sessionId: string; entryId: string };
			/** 克隆当前分支为新会话文件 */
			cloneSession: { sessionId: string };
			/** 清空排队消息（恢复内容给编辑器） */
			clearQueue: { sessionId: string };
			/** 重载扩展/技能/模板/上下文文件 */
			reloadResources: { sessionId: string };
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
