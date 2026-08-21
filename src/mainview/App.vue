<script setup lang="ts">
import { onMounted } from "vue";
import { store } from "./store";
import { bootstrap, compactSession, exportSession, cloneSession } from "./actions";
import Sidebar from "./components/Sidebar.vue";
import ChatView from "./components/ChatView.vue";
import InputBox from "./components/InputBox.vue";
import FooterBar from "./components/FooterBar.vue";
import SettingsModal from "./components/SettingsModal.vue";
import ForkModal from "./components/ForkModal.vue";
import StatsModal from "./components/StatsModal.vue";
import HotkeysModal from "./components/HotkeysModal.vue";
import RenameModal from "./components/RenameModal.vue";

onMounted(bootstrap);
</script>

<template>
  <div class="app-shell">
    <Sidebar />
    <main class="main-area">
      <header class="chat-header">
        <div class="chat-title">
          <span class="chat-name">{{
            store.current?.name || store.current?.id?.slice(0, 8) || "PiBun"
          }}</span>
          <span v-if="store.current?.model" class="model-badge">
            {{ store.current.model.name }}
          </span>
        </div>
        <div v-if="store.current" class="toolbar">
          <button class="icon-btn" title="重命名 (/name)" @click="store.modal = 'rename'">✏️</button>
          <button class="icon-btn" title="分叉/树导航 (/tree)" @click="store.modal = 'fork'">🌿</button>
          <button class="icon-btn" title="克隆会话 (/clone)" @click="cloneSession">📑</button>
          <button class="icon-btn" title="压缩上下文 (/compact)" @click="compactSession()">🗜</button>
          <button class="icon-btn" title="导出 HTML (/export)" @click="exportSession('html')">📤</button>
          <button class="icon-btn" title="会话统计 (/session)" @click="store.modal = 'stats'">📊</button>
          <button class="icon-btn" title="快捷键" @click="store.modal = 'hotkeys'">⌨️</button>
        </div>
        <button class="icon-btn" title="设置" @click="store.modal = 'settings'">⚙</button>
      </header>

      <ChatView />
      <FooterBar />
      <InputBox />
    </main>

    <SettingsModal v-if="store.modal === 'settings'" @close="store.modal = null" />
    <ForkModal v-if="store.modal === 'fork'" @close="store.modal = null" />
    <StatsModal v-if="store.modal === 'stats'" @close="store.modal = null" />
    <HotkeysModal v-if="store.modal === 'hotkeys'" @close="store.modal = null" />
    <RenameModal v-if="store.modal === 'rename'" @close="store.modal = null" />

    <div class="toast-stack">
      <div
        v-for="t in store.toasts"
        :key="t.id"
        class="toast"
        :class="t.level"
      >
        {{ t.text }}
      </div>
    </div>
  </div>
</template>
