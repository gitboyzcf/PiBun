<script setup lang="ts">
import { nextTick, watch, ref, TransitionGroup } from "vue";
import { NButton } from "naive-ui";
import { Down, Robot } from "@icon-park/vue-next";
import { store } from "../store";
import MessageItem from "./MessageItem.vue";

const listRef = ref<HTMLElement>();
/** 用户是否贴在底部（Codex 行为：贴底才跟随流式滚动） */
const stickToBottom = ref(true);
const showJumpBtn = ref(false);

function onScroll() {
  const el = listRef.value;
  if (!el) return;
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
  stickToBottom.value = dist < 80;
  showJumpBtn.value = dist > 240;
}

async function maybeScroll(force = false) {
  await nextTick();
  const el = listRef.value;
  if (!el) return;
  if (force || stickToBottom.value) {
    el.scrollTop = el.scrollHeight;
  }
}

function jumpToBottom() {
  const el = listRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  stickToBottom.value = true;
  showJumpBtn.value = false;
}

watch(
  () => [
    store.items.length,
    store.items[store.items.length - 1]?.kind === "assistant"
      ? (store.items[store.items.length - 1] as { text: string }).text
      : "",
    store.items[store.items.length - 1]?.kind === "tool"
      ? (store.items[store.items.length - 1] as { resultText: string })
          .resultText
      : "",
  ],
  () => maybeScroll(),
);

// 切换会话时强制回底
watch(
  () => store.current?.id,
  () => {
    stickToBottom.value = true;
    maybeScroll(true);
  },
);
</script>

<template>
  <div class="chat-wrap">
    <div ref="listRef" class="chat-view" @scroll.passive="onScroll">
      <div v-if="!store.current" class="welcome">
        <div class="welcome-logo"><robot theme="outline" size="34" fill="#fff" /></div>
        <h2>PiBun</h2>
        <p>pi agent 可视化客户端 — 点击左侧「新会话」开始</p>
        <p class="welcome-tips">/ 命令 · @ 引用文件 · ! 执行 shell · 支持粘贴图片</p>
      </div>
      <TransitionGroup v-else name="msg" tag="div" class="msg-list">
        <MessageItem v-for="item in store.items" :key="item.id" :item="item" />
        <div v-if="store.current.isStreaming" key="__typing" class="typing-hint">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </TransitionGroup>
    </div>

    <Transition name="fade">
      <n-button
        v-if="showJumpBtn"
        class="jump-bottom"
        circle
        size="small"
        @click="jumpToBottom"
      >
        <template #icon><down theme="outline" size="14" /></template>
      </n-button>
    </Transition>
  </div>
</template>
