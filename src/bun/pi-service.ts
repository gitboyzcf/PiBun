/**
 * PiService - pi agent SDK 封装
 * 在 Electrobun 主进程（Bun 运行时）内直接使用 pi SDK（spike 已验证兼容）。
 * API key 通过 ModelRuntime.setRuntimeApiKey 持久化到 pi 的 auth.json。
 */
import {
	createAgentSession,
	ModelRuntime,
	SessionManager,
	type AgentSession,
	type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import { existsSync } from "fs";
import type {
	ActiveSession,
	ModelInfo,
	ProviderInfo,
	SessionSummary,
} from "../shared/rpc-schema";

/** UI 展示的 provider 候选（按此顺序排在前面），其余已注册 provider 追加在后 */
const PROVIDER_CANDIDATES: Array<{ id: string; name: string; envVar: string }> = [
	{ id: "anthropic", name: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY" },
	{ id: "openai", name: "OpenAI (GPT)", envVar: "OPENAI_API_KEY" },
	{ id: "google", name: "Google (Gemini)", envVar: "GEMINI_API_KEY" },
	{ id: "deepseek", name: "DeepSeek", envVar: "DEEPSEEK_API_KEY" },
	{ id: "moonshotai-cn", name: "Moonshot 国内版 (Kimi)", envVar: "MOONSHOT_API_KEY" },
	{ id: "kimi-coding", name: "Kimi Coding", envVar: "KIMI_API_KEY" },
	{ id: "zai-coding-cn", name: "智谱 Coding 国内版", envVar: "ZAI_API_KEY" },
	{ id: "zai", name: "Z.AI (智谱)", envVar: "ZAI_API_KEY" },
	{ id: "openrouter", name: "OpenRouter", envVar: "OPENROUTER_API_KEY" },
	{ id: "xai", name: "xAI (Grok)", envVar: "XAI_API_KEY" },
	{ id: "groq", name: "Groq", envVar: "GROQ_API_KEY" },
	{ id: "mistral", name: "Mistral", envVar: "MISTRAL_API_KEY" },
	{ id: "minimax-cn", name: "MiniMax 国内版", envVar: "MINIMAX_API_KEY" },
];

interface ManagedSession {
	session: AgentSession;
	cwd: string;
	unsubscribe: () => void;
}

type EventSink = (sessionId: string, event: AgentSessionEvent) => void;
type StateSink = (session: ActiveSession) => void;

class PiService {
	private runtime: ModelRuntime | null = null;
	private sessions = new Map<string, ManagedSession>();
	private currentId: string | null = null;
	private eventSink: EventSink = () => {};
	private stateSink: StateSink = () => {};

	onEvent(sink: EventSink) {
		this.eventSink = sink;
	}
	onState(sink: StateSink) {
		this.stateSink = sink;
	}

	async getRuntime(): Promise<ModelRuntime> {
		if (!this.runtime) {
			this.runtime = await ModelRuntime.create({
				allowModelNetwork: true,
				modelRefreshTimeoutMs: 8000,
			});
		}
		return this.runtime;
	}

	/** provider 列表 + 认证状态 */
	async getProviders(): Promise<ProviderInfo[]> {
		const rt = await this.getRuntime();
		const available = new Set(rt.getProviders().map((p) => p.id));
		const listed = PROVIDER_CANDIDATES.filter((p) => available.has(p.id));
		// 兜底：runtime 支持但不在候选名单的也列出来
		const extra = [...available]
			.filter((id) => !PROVIDER_CANDIDATES.some((p) => p.id === id))
			.map((id) => ({ id, name: id, envVar: "" }));
		return [...listed, ...extra].map((p) => ({
			...p,
			hasAuth: rt.hasConfiguredAuth(p.id) || !!process.env[p.envVar],
		}));
	}

	async setApiKey(provider: string, apiKey: string) {
		const rt = await this.getRuntime();
		try {
			await rt.setRuntimeApiKey(provider, apiKey.trim());
			return { ok: true as const };
		} catch (e) {
			return { ok: false as const, error: String(e) };
		}
	}

	async removeApiKey(provider: string) {
		const rt = await this.getRuntime();
		try {
			await rt.removeRuntimeApiKey(provider);
			return { ok: true as const };
		} catch (e) {
			return { ok: false as const, error: String(e) };
		}
	}

	async listModels(provider: string): Promise<ModelInfo[]> {
		const rt = await this.getRuntime();
		return rt.getModels(provider).map((m) => ({
			provider,
			id: m.id,
			name: (m as { name?: string }).name ?? m.id,
		}));
	}

	async listSessions(cwd?: string): Promise<SessionSummary[]> {
		const infos = cwd
			? await SessionManager.list(cwd)
			: await SessionManager.listAll();
		return infos
			.map((s) => ({
				path: s.path,
				id: s.id,
				cwd: s.cwd,
				name: s.name,
				created: s.created.toISOString(),
				modified: s.modified.toISOString(),
				messageCount: s.messageCount,
				firstMessage: s.firstMessage?.slice(0, 120) ?? "",
			}))
			.sort((a, b) => b.modified.localeCompare(a.modified));
	}

	async newSession(cwd: string, provider?: string, modelId?: string) {
		if (!cwd || !existsSync(cwd)) {
			return { error: `工作目录不存在: ${cwd || "(空)"}` };
		}
		try {
			const rt = await this.getRuntime();
			const model =
				provider && modelId ? rt.getModel(provider, modelId) : undefined;
			const { session } = await createAgentSession({
				cwd,
				modelRuntime: rt,
				sessionManager: SessionManager.create(cwd),
				...(model ? { model } : {}),
			});
			this.attach(session, cwd);
			return { session: this.toActive(session, cwd) };
		} catch (e) {
			return { error: String(e) };
		}
	}

	async openSession(path: string) {
		try {
			const rt = await this.getRuntime();
			const sm = SessionManager.open(path);
			const cwd = sm.getCwd() || process.cwd();
			const { session } = await createAgentSession({
				cwd,
				modelRuntime: rt,
				sessionManager: sm,
			});
			this.attach(session, cwd);
			return { session: this.toActive(session, cwd) };
		} catch (e) {
			return { error: String(e) };
		}
	}

	getHistory(sessionId: string): unknown[] {
		const managed = this.sessions.get(sessionId);
		return managed ? (managed.session.messages as unknown[]) : [];
	}

	getCurrent(): ActiveSession | null {
		if (!this.currentId) return null;
		const managed = this.sessions.get(this.currentId);
		return managed ? this.toActive(managed.session, managed.cwd) : null;
	}

	async prompt(sessionId: string, text: string) {
		const managed = this.sessions.get(sessionId);
		if (!managed) throw new Error("会话不存在或已关闭");
		const { session } = managed;
		if (session.isStreaming) {
			await session.prompt(text, { streamingBehavior: "steer" });
		} else {
			await session.prompt(text);
		}
	}

	async steer(sessionId: string, text: string) {
		const managed = this.sessions.get(sessionId);
		if (!managed) throw new Error("会话不存在或已关闭");
		await managed.session.steer(text);
	}

	async abort(sessionId: string) {
		const managed = this.sessions.get(sessionId);
		if (managed) await managed.session.abort();
	}

	async setModel(sessionId: string, provider: string, modelId: string) {
		const managed = this.sessions.get(sessionId);
		if (!managed) throw new Error("会话不存在或已关闭");
		const rt = await this.getRuntime();
		const model = rt.getModel(provider, modelId);
		if (!model) throw new Error(`模型不存在: ${provider}/${modelId}`);
		await managed.session.setModel(model);
		this.stateSink(this.toActive(managed.session, managed.cwd));
	}

	private attach(session: AgentSession, cwd: string) {
		// 同 id 旧会话先清理
		this.sessions.get(session.sessionId)?.unsubscribe();
		const unsubscribe = session.subscribe((event) => {
			this.eventSink(session.sessionId, event);
			if (
				event.type === "agent_start" ||
				event.type === "agent_settled" ||
				event.type === "session_info_changed"
			) {
				this.stateSink(this.toActive(session, cwd));
			}
		});
		this.sessions.set(session.sessionId, { session, cwd, unsubscribe });
		this.currentId = session.sessionId;
	}

	private toActive(session: AgentSession, cwd: string): ActiveSession {
		const m = session.model;
		return {
			id: session.sessionId,
			sessionFile: session.sessionFile,
			cwd,
			name: session.sessionName,
			model: m
				? { provider: m.provider, id: m.id, name: (m as { name?: string }).name ?? m.id }
				: undefined,
			isStreaming: session.isStreaming,
		};
	}
}

export const piService = new PiService();
