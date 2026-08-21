<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NTooltip } from "naive-ui";
import { Picture, Send, Pause, Right, History } from "@icon-park/vue-next";
import { store } from "../store";
import {
	sendPrompt,
	abortRun,
	newSession,
	execBash,
	searchFiles,
} from "../actions";
import { matchCommands, executeSlash, type SlashCommand } from "../commands";
import { rpc } from "../rpc";
import type { FileHit, ImageAttachment } from "../../shared/rpc-schema";

const text = ref("");
const attachments = ref<ImageAttachment[]>([]);
const textareaRef = ref<HTMLTextAreaElement>();
const fileInputRef = ref<HTMLInputElement>();

// ---- slash 命令菜单 ----
const slashMatches = ref<SlashCommand[]>([]);
const slashIndex = ref(0);

// ---- @ 文件补全 ----
const mention = ref<{ start: number; query: string } | null>(null);
const fileHits = ref<FileHit[]>([]);
const fileIndex = ref(0);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

// ---- thinking level 边框色（对齐 TUI 编辑器行为）----
const THINKING_COLORS: Record<string, string> = {
	off: "#9ca3af",
	minimal: "#a3a3a3",
	low: "#60a5fa",
	medium: "#10a37f",
	high: "#f59e0b",
	xhigh: "#ef4444",
	max: "#dc2626",
};
const borderColor = computed(() => {
	if (isBashMode.value) return "#7c3aed";
	const level = store.stats?.thinkingLevel ?? "medium";
	return THINKING_COLORS[level] ?? "#10a37f";
});

const isBashMode = computed(() => text.value.startsWith("!"));

const queueCount = computed(
	() => store.queue.steering.length + store.queue.followUp.length,
);

// abort 后恢复排队文本
watch(
	() => store.restoredText,
	(v) => {
		if (v) {
			text.value = v;
			store.restoredText = "";
			textareaRef.value?.focus();
		}
	},
);

// 输入框自动增高（Codex 手感）
watch(text, () => {
	const ta = textareaRef.value;
	if (!ta) return;
	ta.style.height = "auto";
	ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
});

watch(text, (v) => {
	// slash 菜单：以 / 开头且未含空格
	if (v.startsWith("/") && !v.includes(" ")) {
		slashMatches.value = matchCommands(v);
		slashIndex.value = 0;
	} else {
		slashMatches.value = [];
	}
	// @ 补全：光标前最近的 @query
	const ta = textareaRef.value;
	if (!ta) return;
	const pos = ta.selectionStart ?? v.length;
	const before = v.slice(0, pos);
	const atIdx = before.lastIndexOf("@");
	if (atIdx >= 0 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
		const query = before.slice(atIdx + 1);
		if (!/[\s@]/.test(query) && query.length <= 60) {
			mention.value = { start: atIdx, query };
			clearTimeout(searchTimer);
			searchTimer = setTimeout(async () => {
				fileHits.value = await searchFiles(query);
				fileIndex.value = 0;
			}, 150);
			return;
		}
	}
	mention.value = null;
	fileHits.value = [];
});

function insertMention(hit: FileHit) {
	if (!mention.value) return;
	const ta = textareaRef.value!;
	const pos = ta.selectionStart ?? text.value.length;
	text.value =
		text.value.slice(0, mention.value.start) +
		"@" +
		hit.path +
		" " +
		text.value.slice(pos);
	mention.value = null;
	fileHits.value = [];
	ta.focus();
}

function pickSlash(c: SlashCommand) {
	if (c.needsArgs) {
		text.value = c.cmd + " ";
		slashMatches.value = [];
		textareaRef.value?.focus();
		return;
	}
	text.value = "";
	slashMatches.value = [];
	c.run("");
}

function ensureSessionThen(fn: () => void) {
	if (!store.current) {
		newSession().then(() => store.current && fn());
	} else {
		fn();
	}
}

function submit(mode?: "steer" | "followUp") {
	const v = text.value;
	if (!v.trim() && attachments.value.length === 0) return;

	// bash 模式：! 或 !! 前缀
	if (v.startsWith("!")) {
		const hidden = v.startsWith("!!");
		const command = v.slice(hidden ? 2 : 1).trim();
		if (command) ensureSessionThen(() => execBash(command, hidden));
		text.value = "";
		return;
	}

	// slash 命令（含参数形式，如 /compact 保留关键决策）
	if (v.startsWith("/") && executeSlash(v)) {
		text.value = "";
		return;
	}

	ensureSessionThen(() => {
		sendPrompt(v, attachments.value.length ? attachments.value : undefined,
			store.current?.isStreaming ? (mode ?? "steer") : undefined);
	});
	text.value = "";
	attachments.value = [];
}

function onKeydown(e: KeyboardEvent) {
	if (e.isComposing) return;
	// slash 菜单导航
	if (slashMatches.value.length) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			slashIndex.value = (slashIndex.value + 1) % slashMatches.value.length;
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			slashIndex.value =
				(slashIndex.value - 1 + slashMatches.value.length) %
				slashMatches.value.length;
			return;
		}
		if (e.key === "Enter" || e.key === "Tab") {
			e.preventDefault();
			pickSlash(slashMatches.value[slashIndex.value]);
			return;
		}
		if (e.key === "Escape") {
			slashMatches.value = [];
			return;
		}
	}
	// 文件补全导航
	if (fileHits.value.length) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			fileIndex.value = (fileIndex.value + 1) % fileHits.value.length;
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			fileIndex.value =
				(fileIndex.value - 1 + fileHits.value.length) % fileHits.value.length;
			return;
		}
		if (e.key === "Enter" || e.key === "Tab") {
			e.preventDefault();
			insertMention(fileHits.value[fileIndex.value]);
			return;
		}
		if (e.key === "Escape") {
			fileHits.value = [];
			return;
		}
	}
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		// TUI：流式中 Alt+Enter = followUp（等 agent 完成后执行）
		submit(e.altKey ? "followUp" : undefined);
	}
	if (e.key === "Escape" && store.current?.isStreaming) {
		abortRun();
	}
}

// ---- 图片附件 ----
function readImageFile(file: File) {
	if (!file.type.startsWith("image/")) return;
	const reader = new FileReader();
	reader.onload = () => {
		const dataUrl = reader.result as string;
		attachments.value.push({
			data: dataUrl.split(",")[1] ?? "",
			mimeType: file.type,
			name: file.name,
		});
	};
	reader.readAsDataURL(file);
}

function onPaste(e: ClipboardEvent) {
	for (const item of e.clipboardData?.items ?? []) {
		if (item.type.startsWith("image/")) {
			const file = item.getAsFile();
			if (file) {
				e.preventDefault();
				readImageFile(file);
			}
		}
	}
}

function onPickImages(e: Event) {
	for (const file of (e.target as HTMLInputElement).files ?? []) {
		readImageFile(file);
	}
	(e.target as HTMLInputElement).value = "";
}

function restoreQueue() {
	if (!store.current) return;
	rpc.send.clearQueue({ sessionId: store.current.id });
	const parts = [...store.queue.steering, ...store.queue.followUp];
	if (parts.length) text.value = parts.join("\n");
	store.queue = { steering: [], followUp: [] };
}
</script>

<template>
  <div class="input-area">
    <!-- 排队消息指示（TUI message queue） -->
    <div v-if="queueCount" class="queue-bar">
      <span class="queue-label">排队 {{ queueCount }} 条</span>
      <span
        v-for="(q, i) in [...store.queue.steering, ...store.queue.followUp]"
        :key="i"
        class="queue-chip"
        :title="q"
      >
        {{ q.slice(0, 30) }}{{ q.length > 30 ? "…" : "" }}
      </span>
      <button class="queue-restore" title="取回排队消息" @click="restoreQueue">↩ 取回</button>
    </div>

    <!-- 附件预览 -->
    <div v-if="attachments.length" class="attach-bar">
      <span v-for="(a, i) in attachments" :key="i" class="attach-chip">
        🖼 {{ a.name }}
        <button class="attach-remove" @click="attachments.splice(i, 1)">×</button>
      </span>
    </div>

    <div
      class="input-box"
      :class="{ bash: isBashMode }"
      :style="{ borderColor }"
    >
      <!-- slash 命令菜单 -->
      <div v-if="slashMatches.length" class="popup-menu">
        <div
          v-for="(c, i) in slashMatches"
          :key="c.cmd"
          class="popup-item"
          :class="{ active: i === slashIndex }"
          @mousedown.prevent="pickSlash(c)"
        >
          <span class="popup-cmd">{{ c.cmd }}</span>
          <span class="popup-desc">{{ c.desc }}</span>
        </div>
      </div>

      <!-- @ 文件补全 -->
      <div v-else-if="fileHits.length" class="popup-menu">
        <div
          v-for="(f, i) in fileHits"
          :key="f.path"
          class="popup-item"
          :class="{ active: i === fileIndex }"
          @mousedown.prevent="insertMention(f)"
        >
          <span class="popup-cmd">{{ f.kind === "dir" ? "📁" : "📄" }} {{ f.path }}</span>
        </div>
      </div>

      <n-button quaternary circle title="添加图片（也可直接粘贴）" @click="fileInputRef?.click()">
        <template #icon><picture theme="outline" size="17" /></template>
      </n-button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="onPickImages"
      />

      <textarea
        ref="textareaRef"
        v-model="text"
        :placeholder="
          isBashMode
            ? 'bash 命令（!! 开头则不发给模型）'
            : '给 pi 发送消息… / 命令 · @ 文件 · ! shell'
        "
        rows="3"
        @keydown="onKeydown"
        @paste="onPaste"
      ></textarea>

      <template v-if="store.current?.isStreaming">
        <n-tooltip trigger="hover"><template #trigger>
          <n-button circle type="info" @click="submit('steer')">
            <template #icon><right theme="outline" size="15" fill="#fff" /></template>
          </n-button>
        </template>插队发送（当前步骤后执行）</n-tooltip>
        <n-tooltip trigger="hover"><template #trigger>
          <n-button circle color="#b45309" @click="submit('followUp')">
            <template #icon><history theme="outline" size="15" fill="#fff" /></template>
          </n-button>
        </template>排队（agent 全部完成后执行）</n-tooltip>
        <n-tooltip trigger="hover"><template #trigger>
          <n-button circle type="error" @click="abortRun">
            <template #icon><pause theme="outline" size="15" fill="#fff" /></template>
          </n-button>
        </template>停止 (Esc)</n-tooltip>
      </template>
      <n-button v-else circle type="primary" title="发送 (Enter)" @click="submit()">
        <template #icon><send theme="outline" size="15" fill="#fff" /></template>
      </n-button>
    </div>

    <div class="input-hint">
      <template v-if="isBashMode">bash 模式 · Enter 执行</template>
      <template v-else-if="store.current">
        Enter 发送{{ store.current.isStreaming ? "=插队 · Alt+Enter=排队 · Esc=停止" : " · Shift+Enter 换行" }}
      </template>
      <template v-else>发送消息将自动创建会话</template>
    </div>
  </div>
</template>
