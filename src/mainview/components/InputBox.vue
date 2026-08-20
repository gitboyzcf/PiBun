<script setup lang="ts">
import { ref } from "vue";
import { store } from "../store";
import { sendPrompt, abortRun, newSession } from "../actions";

const text = ref("");

function submit() {
  if (!store.current) {
    newSession().then(() => {
      if (store.current && text.value.trim()) {
        sendPrompt(text.value);
        text.value = "";
      }
    });
    return;
  }
  if (!text.value.trim()) return;
  sendPrompt(text.value);
  text.value = "";
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="input-area">
    <div class="input-box">
      <textarea
        v-model="text"
        placeholder="给 pi 发送消息…（Enter 发送，Shift+Enter 换行）"
        rows="3"
        @keydown="onKeydown"
      ></textarea>
      <button
        v-if="store.current?.isStreaming"
        class="send-btn stop"
        title="停止"
        @click="abortRun"
      >
        ■
      </button>
      <button v-else class="send-btn" title="发送" @click="submit">➤</button>
    </div>
    <div class="input-hint">
      {{ store.current ? `工作目录：${store.current.cwd}` : "发送消息将自动创建会话" }}
    </div>
  </div>
</template>
