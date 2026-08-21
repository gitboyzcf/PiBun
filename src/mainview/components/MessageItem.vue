<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import { NButton } from "naive-ui";
import { Copy } from "@icon-park/vue-next";
import logoUrl from "../assets/logo.png";
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
    <img :src="logoUrl" class="avatar" alt="" />
    <div class="assistant-body">
      <details v-if="item.thinking" class="thinking-block">
        <summary>思考过程</summary>
        <div class="markdown" v-html="thinkingHtml"></div>
      </details>
      <div class="markdown" v-html="html"></div>
      <span v-if="item.streaming" class="cursor-blink">▍</span>
      <div v-if="!item.streaming && item.text" class="msg-actions">
        <n-button size="tiny" quaternary @click="copyText(item.text)">
          <template #icon><copy theme="outline" size="12" /></template>
          复制
        </n-button>
      </div>
    </div>
  </div>

  <ToolCallCard v-else-if="item.kind === 'tool'" :item="item" />

  <div v-else class="msg-row notice">
    <div class="notice-line">{{ item.text }}</div>
  </div>
</template>
