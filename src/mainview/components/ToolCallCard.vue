<script setup lang="ts">
import { computed, ref } from "vue";
import type { ToolItem } from "../store";
import { argsSummary } from "../store";

const props = defineProps<{ item: ToolItem }>();
const open = ref(false);

const icon = computed(() => {
  switch (props.item.toolName) {
    case "bash": return "⌘";
    case "read": return "📄";
    case "edit": return "✏️";
    case "write": return "📝";
    case "grep": return "🔍";
    case "find": return "🗂";
    case "ls": return "📁";
    default: return "🔧";
  }
});

const summary = computed(() => argsSummary(props.item.args));
const argsText = computed(() => {
  try {
    return JSON.stringify(props.item.args, null, 2);
  } catch {
    return String(props.item.args);
  }
});
</script>

<template>
  <div class="msg-row tool">
    <div class="tool-card" :class="item.status">
      <button class="tool-head" @click="open = !open">
        <span class="tool-icon">{{ icon }}</span>
        <span class="tool-name">{{ item.toolName }}</span>
        <span class="tool-summary">{{ summary }}</span>
        <span class="tool-status">
          <template v-if="item.status === 'running'">⏳ 运行中</template>
          <template v-else-if="item.status === 'error'">❌ 失败</template>
          <template v-else>✅</template>
        </span>
        <span class="tool-caret">{{ open ? "▾" : "▸" }}</span>
      </button>
      <div v-if="open" class="tool-detail">
        <div class="tool-section">
          <div class="tool-section-title">参数</div>
          <pre>{{ argsText }}</pre>
        </div>
        <div v-if="item.resultText" class="tool-section">
          <div class="tool-section-title">结果</div>
          <pre>{{ item.resultText }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
