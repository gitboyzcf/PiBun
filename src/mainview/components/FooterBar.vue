<script setup lang="ts">
import { computed, watch } from "vue";
import { NButton } from "naive-ui";
import { Robot, Brain, FolderOpen } from "@icon-park/vue-next";
import { store } from "../store";
import { cycleThinking, refreshStats } from "../actions";

// agent 运行结束后刷新统计
watch(
  () => store.current?.isStreaming,
  (streaming, was) => {
    if (was && !streaming) refreshStats();
  },
);

const tokenText = computed(() => {
  const t = store.stats?.tokens;
  if (!t) return "";
  const fmt = (n: number) =>
    n >= 1_000_000
      ? (n / 1_000_000).toFixed(1) + "M"
      : n >= 1000
        ? (n / 1000).toFixed(1) + "k"
        : String(n);
  return `↑${fmt(t.input)} ↓${fmt(t.output)}`;
});

const costText = computed(() => {
  const c = store.stats?.cost;
  return c ? `$${c.toFixed(4)}` : "";
});

const contextText = computed(() => {
  const p = store.stats?.contextPercent;
  return p != null ? `上下文 ${(p * 100).toFixed(0)}%` : "";
});

const contextColor = computed(() => {
  const p = store.stats?.contextPercent ?? 0;
  return p > 0.85 ? "#dc2626" : p > 0.65 ? "#f59e0b" : "#6b7280";
});
</script>

<template>
  <div v-if="store.current" class="footer-bar">
    <span class="footer-item footer-model" :title="store.stats?.model?.id">
      <robot theme="outline" size="14" />
      {{ store.stats?.model?.name ?? "未选模型" }}
    </span>
    <n-button size="tiny" round quaternary @click="cycleThinking">
      <template #icon><brain theme="outline" size="13" /></template>
      {{ store.stats?.thinkingLevel ?? "-" }}
    </n-button>
    <span v-if="tokenText" class="footer-item">{{ tokenText }}</span>
    <span v-if="costText" class="footer-item">{{ costText }}</span>
    <span
      v-if="contextText"
      class="footer-item"
      :style="{ color: contextColor }"
      >{{ contextText }}</span
    >
    <span class="footer-spacer"></span>
    <span class="footer-item footer-cwd" :title="store.current.cwd">
      <folder-open theme="outline" size="13" />
      {{ store.current.cwd }}
    </span>
  </div>
</template>
