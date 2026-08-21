<script setup lang="ts">
import { onMounted } from "vue";
import { NConfigProvider, NButton, NTooltip, NDropdown } from "naive-ui";
import {
  Setting,
  Edit,
  Branch,
  CopyOne,
  Compression,
  Export,
  ChartPie,
  Keyboard,
  MoreOne,
} from "@icon-park/vue-next";
import { store } from "./store";
import { bootstrap, compactSession, exportSession, cloneSession } from "./actions";
import { h, type Component } from "vue";
import { NIcon } from "naive-ui";
import Sidebar from "./components/Sidebar.vue";
import ChatView from "./components/ChatView.vue";
import InputBox from "./components/InputBox.vue";
import FooterBar from "./components/FooterBar.vue";
import SettingsModal from "./components/SettingsModal.vue";
import ForkModal from "./components/ForkModal.vue";
import StatsModal from "./components/StatsModal.vue";
import HotkeysModal from "./components/HotkeysModal.vue";
import RenameModal from "./components/RenameModal.vue";
import SplashScreen from "./components/SplashScreen.vue";

onMounted(bootstrap);

const themeOverrides = {
  common: {
    primaryColor: "#10a37f",
    primaryColorHover: "#0d8a6c",
    primaryColorPressed: "#0b7a5e",
    primaryColorSuppl: "#10a37f",
    borderRadius: "10px",
  },
};

// 头部「更多」菜单（窄窗口也不溢出）
const renderIcon = (icon: Component) => () =>
  h(NIcon, null, { default: () => h(icon, { theme: "outline", size: 14 }) });

const moreOptions = [
  { label: "分叉/树导航 (/tree)", key: "fork", icon: renderIcon(Branch) },
  { label: "克隆会话 (/clone)", key: "clone", icon: renderIcon(CopyOne) },
  { label: "压缩上下文 (/compact)", key: "compact", icon: renderIcon(Compression) },
  { label: "导出 HTML (/export)", key: "export", icon: renderIcon(Export) },
  { label: "会话统计 (/session)", key: "stats", icon: renderIcon(ChartPie) },
  { label: "快捷键", key: "hotkeys", icon: renderIcon(Keyboard) },
];

function onMoreSelect(key: string) {
  switch (key) {
    case "fork": store.modal = "fork"; break;
    case "clone": cloneSession(); break;
    case "compact": compactSession(); break;
    case "export": exportSession("html"); break;
    case "stats": store.modal = "stats"; break;
    case "hotkeys": store.modal = "hotkeys"; break;
  }
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div class="app-shell">
      <Sidebar />
      <main class="main-area">
        <header class="chat-header">
          <div class="chat-title">
            <span class="chat-name">{{
              store.current?.name || store.current?.id?.slice(0, 8) || "Pi Agent"
            }}</span>
            <span v-if="store.current?.model" class="model-badge">
              {{ store.current.model.name }}
            </span>
          </div>
          <div v-if="store.current" class="toolbar">
            <n-tooltip trigger="hover"><template #trigger>
              <n-button quaternary circle @click="store.modal = 'rename'">
                <template #icon><edit /></template>
              </n-button>
            </template>重命名 (/name)</n-tooltip>
            <n-dropdown
              trigger="click"
              :options="moreOptions"
              @select="onMoreSelect"
            >
              <n-button quaternary circle>
                <template #icon><more-one /></template>
              </n-button>
            </n-dropdown>
          </div>
          <n-button quaternary circle @click="store.modal = 'settings'">
            <template #icon><setting /></template>
          </n-button>
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
    </div>
    <SplashScreen :ready="store.ready" />
  </n-config-provider>
</template>
