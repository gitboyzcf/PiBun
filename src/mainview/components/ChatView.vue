<script setup lang="ts">
import { nextTick, watch, ref } from "vue";
import { store } from "../store";
import MessageItem from "./MessageItem.vue";

const listRef = ref<HTMLElement>();

watch(
  () => [
    store.items.length,
    store.items[store.items.length - 1]?.kind === "assistant"
      ? (store.items[store.items.length - 1] as { text: string }).text
      : "",
  ],
  async () => {
    await nextTick();
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);
</script>

<template>
  <div ref="listRef" class="chat-view">
    <div v-if="!store.current" class="welcome">
      <div class="welcome-logo">π</div>
      <h2>PiBun</h2>
      <p>pi agent 可视化客户端 — 点击左侧「新会话」开始</p>
    </div>
    <template v-else>
      <MessageItem v-for="item in store.items" :key="item.id" :item="item" />
      <div v-if="store.current.isStreaming" class="typing-hint">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </div>
    </template>
  </div>
</template>
