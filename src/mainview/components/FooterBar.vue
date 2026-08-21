<script setup lang="ts">
import { computed } from "vue";
import { store } from "../store";
import { cycleThinking, refreshStats } from "../actions";
import { watch } from "vue";

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
      🤖 {{ store.stats?.model?.name ?? "未选模型" }}
    </span>
    <button
      class="footer-item footer-btn"
      title="点击切换 thinking level"
      @click="cycleThinking"
    >
      🧠 {{ store.stats?.thinkingLevel ?? "-" }}
    </button>
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
      📁 {{ store.current.cwd }}
    </span>
  </div>
</template>
