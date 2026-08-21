/**
 * Slash 命令注册表 — 对齐 pi TUI 的 / 命令
 * 本地命令直接执行 GUI 动作；未识别的命令透传给 agent（扩展命令 /skill:name / 提示模板）
 */
import { store, showToast } from "./store";
import {
	newSession,
	compactSession,
	copyLastAssistant,
	cloneSession,
	exportSession,
	renameSession,
	reloadResources,
} from "./actions";

export interface SlashCommand {
	cmd: string;
	desc: string;
	/** 需要参数 */
	needsArgs?: boolean;
	run: (args: string) => void | Promise<void>;
}

function needSession(): boolean {
	if (!store.current) {
		showToast("info", "请先创建会话");
		return false;
	}
	return true;
}

export const SLASH_COMMANDS: SlashCommand[] = [
	{
		cmd: "/login",
		desc: "配置 API Key / 登录",
		run: () => (store.modal = "settings"),
	},
	{
		cmd: "/logout",
		desc: "移除 API Key",
		run: () => (store.modal = "settings"),
	},
	{
		cmd: "/model",
		desc: "切换模型 / thinking level",
		run: () => (store.modal = "settings"),
	},
	{
		cmd: "/settings",
		desc: "设置（服务商、模型、工作目录）",
		run: () => (store.modal = "settings"),
	},
	{
		cmd: "/new",
		desc: "开始新会话",
		run: () => newSession(),
	},
	{
		cmd: "/resume",
		desc: "恢复历史会话（左侧栏选择）",
		run: () => showToast("info", "在左侧栏点击历史会话即可恢复"),
	},
	{
		cmd: "/name",
		desc: "设置会话名称 /name <名称>",
		needsArgs: true,
		run: () => needSession() && (store.modal = "rename"),
	},
	{
		cmd: "/session",
		desc: "会话统计（文件、token、成本）",
		run: () => needSession() && (store.modal = "stats"),
	},
	{
		cmd: "/tree",
		desc: "跳到会话任意节点继续（分支）",
		run: () => needSession() && (store.modal = "fork"),
	},
	{
		cmd: "/fork",
		desc: "从之前的某条消息分叉",
		run: () => needSession() && (store.modal = "fork"),
	},
	{
		cmd: "/clone",
		desc: "克隆当前分支为新会话",
		run: () => needSession() && cloneSession(),
	},
	{
		cmd: "/compact",
		desc: "压缩上下文 /compact [指令]",
		run: (args) => needSession() && compactSession(args || undefined),
	},
	{
		cmd: "/copy",
		desc: "复制最后一条回复",
		run: () => copyLastAssistant(),
	},
	{
		cmd: "/export",
		desc: "导出会话为 HTML",
		run: () => needSession() && exportSession("html"),
	},
	{
		cmd: "/reload",
		desc: "重载扩展/技能/模板/上下文",
		run: () => needSession() && reloadResources(),
	},
	{
		cmd: "/hotkeys",
		desc: "快捷键说明",
		run: () => (store.modal = "hotkeys"),
	},
	{
		cmd: "/import",
		desc: "导入会话（暂未支持）",
		run: () => showToast("info", "导入功能暂未支持，可在侧栏直接打开历史会话"),
	},
	{
		cmd: "/share",
		desc: "分享（暂未支持）",
		run: () => showToast("info", "分享功能暂未支持，可用 /export 导出 HTML"),
	},
	{
		cmd: "/quit",
		desc: "退出应用",
		run: () => window.close(),
	},
];

export function matchCommands(input: string): SlashCommand[] {
	const q = input.toLowerCase();
	return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q)).slice(0, 8);
}

/** 执行输入：本地命令返回 true 已处理；否则返回 false 应透传给 agent */
export function executeSlash(input: string): boolean {
	const spaceIdx = input.indexOf(" ");
	const cmd = (spaceIdx > 0 ? input.slice(0, spaceIdx) : input).toLowerCase();
	const args = spaceIdx > 0 ? input.slice(spaceIdx + 1).trim() : "";
	const found = SLASH_COMMANDS.find((c) => c.cmd === cmd);
	if (!found) return false;
	found.run(args);
	return true;
}
