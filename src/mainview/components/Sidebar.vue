<script setup lang="ts">
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

    <button class="new-session-btn" @click="newSession">＋ 新会话</button>

    <div class="cwd-line" :title="store.settings?.cwd">
      📁 {{ store.settings?.cwd }}
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
        暂无历史会话
      </div>
    </div>
  </aside>
</template>
