<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import type { ChatItem } from "../store";
import { showToast } from "../store";
import ToolCallCard from "./ToolCallCard.vue";

const props = defineProps<{ item: ChatItem }>();

const html = computed(() => {
  if (props.item.kind !== "assistant") return "";
  return marked.parse(props.item.text, { async: false }) as string;
});

const thinkingHtml = computed(() => {
  if (props.item.kind !== "assistant" || !props.item.thinking) return "";
  return marked.parse(props.item.thinking, { async: false }) as string;
});

function copyText(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("info", "已复制"))
    .catch(() => showToast("error", "复制失败"));
}
</script>

<template>
  <div v-if="item.kind === 'user'" class="msg-row user">
    <div class="bubble user-bubble">{{ item.text }}</div>
  </div>

  <div v-else-if="item.kind === 'assistant'" class="msg-row assistant">
    <div class="avatar">π</div>
    <div class="assistant-body">
      <details v-if="item.thinking" class="thinking-block">
        <summary>思考过程</summary>
        <div class="markdown" v-html="thinkingHtml"></div>
      </details>
      <div class="markdown" v-html="html"></div>
      <span v-if="item.streaming" class="cursor-blink">▍</span>
      <button
        v-if="!item.streaming && item.text"
        class="copy-btn"
        title="复制回复 (/copy)"
        @click="copyText(item.text)"
      >
        📋 复制
      </button>
    </div>
  </div>

  <ToolCallCard v-else-if="item.kind === 'tool'" :item="item" />

  <div v-else class="msg-row notice">
    <div class="notice-line">{{ item.text }}</div>
  </div>
</template>
