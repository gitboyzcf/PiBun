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
import { readdir } from "fs/promises";
import { join, relative } from "path";
import type {
	ActiveSession,
	BashResultPayload,
	FileHit,
	ForkMessage,
	ModelInfo,
	ProviderInfo,
	SessionStatsPayload,
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

	async prompt(
		sessionId: string,
		text: string,
		images?: Array<{ data: string; mimeType: string }>,
		streamingBehavior?: "steer" | "followUp",
	) {
		const managed = this.sessions.get(sessionId);
		if (!managed) throw new Error("会话不存在或已关闭");
		const { session } = managed;
		const imageContent = images?.map((img) => ({
			type: "image" as const,
			data: img.data,
			mimeType: img.mimeType,
		}));
		if (session.isStreaming) {
			await session.prompt(text, {
				streamingBehavior: streamingBehavior ?? "steer",
				...(imageContent ? { images: imageContent } : {}),
			});
		} else {
			await session.prompt(text, {
				...(imageContent ? { images: imageContent } : {}),
			});
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

	// ================= TUI 功能集 =================

	private require(sessionId: string): AgentSession {
		const managed = this.sessions.get(sessionId);
		if (!managed) throw new Error("会话不存在或已关闭");
		return managed.session;
	}

	/** footer 统计：token/cost/context/thinking/模型/工具 */
	getStats(sessionId: string): SessionStatsPayload | null {
		const managed = this.sessions.get(sessionId);
		if (!managed) return null;
		const { session } = managed;
		const s = session.getSessionStats();
		const ctx = session.getContextUsage() as
			| { tokens?: number; contextWindow?: number; percent?: number }
			| undefined;
		const m = session.model;
		return {
			sessionFile: s.sessionFile,
			sessionId: s.sessionId,
			userMessages: s.userMessages,
			assistantMessages: s.assistantMessages,
			toolCalls: s.toolCalls,
			totalMessages: s.totalMessages,
			tokens: { ...s.tokens },
			cost: s.cost,
			contextPercent:
				ctx?.percent ??
				(ctx?.tokens != null && ctx?.contextWindow
					? ctx.tokens / ctx.contextWindow
					: undefined),
			contextTokens: ctx?.tokens,
			contextWindow: ctx?.contextWindow,
			thinkingLevel: session.thinkingLevel,
			availableThinkingLevels: session.getAvailableThinkingLevels(),
			model: m
				? {
						provider: m.provider,
						id: m.id,
						name: (m as { name?: string }).name ?? m.id,
					}
				: undefined,
			activeTools: session.getActiveToolNames(),
		};
	}

	getForkMessages(sessionId: string): ForkMessage[] {
		return this.require(sessionId).getUserMessagesForForking();
	}

	async exportSession(sessionId: string, format: "html" | "jsonl") {
		try {
			const session = this.require(sessionId);
			const path =
				format === "html"
					? await session.exportToHtml()
					: session.exportToJsonl();
			return { path };
		} catch (e) {
			return { error: String(e) };
		}
	}

	getQueue(sessionId: string) {
		const session = this.require(sessionId);
		return {
			steering: [...session.getSteeringMessages()],
			followUp: [...session.getFollowUpMessages()],
		};
	}

	clearQueue(sessionId: string) {
		return this.require(sessionId).clearQueue();
	}

	setThinking(sessionId: string, level: string) {
		const session = this.require(sessionId);
		session.setThinkingLevel(level as never);
	}

	async compact(sessionId: string, instructions?: string) {
		await this.require(sessionId).compact(instructions || undefined);
	}

	rename(sessionId: string, name: string) {
		const managed = this.sessions.get(sessionId);
		if (!managed) return;
		managed.session.setSessionName(name);
		this.stateSink(this.toActive(managed.session, managed.cwd));
	}

	async navigateTree(sessionId: string, entryId: string) {
		const result = await this.require(sessionId).navigateTree(entryId);
		const managed = this.sessions.get(sessionId);
		if (managed) this.stateSink(this.toActive(managed.session, managed.cwd));
		return result;
	}

	async cloneSession(sessionId: string) {
		const managed = this.sessions.get(sessionId);
		if (!managed) throw new Error("会话不存在或已关闭");
		const file = managed.session.sessionFile;
		if (!file) throw new Error("会话未持久化，无法克隆");
		const rt = await this.getRuntime();
		const sm = SessionManager.forkFrom(file, managed.cwd);
		const { session } = await createAgentSession({
			cwd: managed.cwd,
			modelRuntime: rt,
			sessionManager: sm,
		});
		this.attach(session, managed.cwd);
		return this.toActive(session, managed.cwd);
	}

	async reloadResources(sessionId: string) {
		await this.require(sessionId).reload();
	}

	async execBash(sessionId: string, command: string, hidden: boolean) {
		try {
			const session = this.require(sessionId);
			const r = await session.executeBash(command, undefined, {
				excludeFromContext: hidden,
			});
			const result: BashResultPayload = {
				output: r.output ?? "",
				exitCode: r.exitCode ?? null,
				cancelled: !!r.cancelled,
				truncated: !!r.truncated,
			};
			return { result };
		} catch (e) {
			return { error: String(e) };
		}
	}

	abortBash(sessionId: string) {
		this.sessions.get(sessionId)?.session.abortBash();
	}

	/** @ 文件补全：递归扫描 cwd（跳过 node_modules/.git 等），模糊匹配 */
	async searchFiles(sessionId: string, query: string): Promise<FileHit[]> {
		const managed = this.sessions.get(sessionId);
		if (!managed) return [];
		const root = managed.cwd;
		const SKIP = new Set([
			"node_modules",
			".git",
			"dist",
			"build",
			".next",
			".cache",
			"coverage",
		]);
		const hits: FileHit[] = [];
		const q = query.toLowerCase();
		const walk = async (dir: string, depth: number): Promise<void> => {
			if (depth > 6 || hits.length >= 200) return;
			let entries;
			try {
				entries = await readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const e of entries) {
				if (hits.length >= 200) return;
				if (e.name.startsWith(".") && e.name !== ".env") continue;
				const full = join(dir, e.name);
				const rel = relative(root, full);
				if (e.isDirectory()) {
					if (SKIP.has(e.name)) continue;
					if (!q || e.name.toLowerCase().includes(q)) {
						hits.push({ path: rel, kind: "dir" });
					}
					await walk(full, depth + 1);
				} else if (!q || rel.toLowerCase().includes(q)) {
					hits.push({ path: rel, kind: "file" });
				}
			}
		};
		await walk(root, 0);
		// 文件优先、路径短的优先
		return hits
			.sort((a, b) =>
				a.kind !== b.kind
					? a.kind === "file"
						? -1
						: 1
					: a.path.length - b.path.length,
			)
			.slice(0, 12);
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
