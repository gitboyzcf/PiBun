<script setup lang="ts">
import { onMounted } from "vue";
import { store } from "./store";
import { bootstrap } from "./actions";
import Sidebar from "./components/Sidebar.vue";
import ChatView from "./components/ChatView.vue";
import InputBox from "./components/InputBox.vue";
import SettingsModal from "./components/SettingsModal.vue";

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
        <button class="icon-btn" title="设置" @click="store.settingsOpen = true">⚙</button>
      </header>

      <ChatView />
      <InputBox />
    </main>

    <SettingsModal v-if="store.settingsOpen" @close="store.settingsOpen = false" />

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
