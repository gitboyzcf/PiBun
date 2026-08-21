<script setup lang="ts">
import { NButton } from "naive-ui";
import { Add, FolderOpen, History } from "@icon-park/vue-next";
import { store } from "../store";
import { newSession, openSession } from "../actions";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toTimeString().slice(0, 5);
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-logo">π</span>
      <span class="brand-name">PiBun</span>
    </div>

    <n-button block dashed @click="newSession">
      <template #icon><add /></template>
      新会话
    </n-button>

    <div class="cwd-line" :title="store.settings?.cwd">
      <folder-open theme="outline" size="13" />
      <span class="cwd-text">{{ store.settings?.cwd }}</span>
    </div>

    <div class="session-list">
      <div
        v-for="s in store.sessions"
        :key="s.path"
        class="session-item"
        :class="{ active: store.current?.sessionFile === s.path }"
        @click="openSession(s.path)"
      >
        <div class="session-title">
          {{ s.name || s.firstMessage || "（空会话）" }}
        </div>
        <div class="session-meta">
          {{ fmtTime(s.modified) }} · {{ s.messageCount }} 条
        </div>
      </div>
      <div v-if="store.sessions.length === 0" class="empty-hint">
        <history theme="outline" size="28" fill="#c0c4cc" />
        <div>暂无历史会话</div>
      </div>
    </div>
  </aside>
</template>
