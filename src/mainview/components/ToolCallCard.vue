<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import {
  Terminal,
  DocDetail,
  Edit,
  Save,
  Command,
  FolderOpen,
  More,
  Right,
  Down,
  Loading,
  CheckOne,
  CloseOne,
} from "@icon-park/vue-next";
import type { ToolItem } from "../store";
import { argsSummary } from "../store";

const props = defineProps<{ item: ToolItem }>();
const open = ref(false);

const TOOL_ICONS: Record<string, Component> = {
  bash: Terminal,
  read: DocDetail,
  edit: Edit,
  write: Save,
  grep: Command,
  find: FolderOpen,
  ls: FolderOpen,
};

const icon = computed(
  () => TOOL_ICONS[props.item.toolName.replace("(隐藏)", "")] ?? More,
);

const summary = computed(() => argsSummary(props.item.args));
const argsText = computed(() => {
  try {
    return JSON.stringify(props.item.args, null, 2);
  } catch {
    return String(props.item.args);
  }
});
</script>

<template>
  <div class="msg-row tool">
    <div class="tool-card" :class="item.status">
      <button class="tool-head" @click="open = !open">
        <component :is="icon" theme="outline" size="15" class="tool-icon" />
        <span class="tool-name">{{ item.toolName }}</span>
        <span class="tool-summary">{{ summary }}</span>
        <span class="tool-status">
          <loading v-if="item.status === 'running'" theme="outline" size="14" class="spin" />
          <close-one v-else-if="item.status === 'error'" theme="filled" size="14" fill="#dc2626" />
          <check-one v-else theme="filled" size="14" fill="#10a37f" />
        </span>
        <down v-if="open" theme="outline" size="13" class="tool-caret" />
        <right v-else theme="outline" size="13" class="tool-caret" />
      </button>
      <div v-if="open" class="tool-detail">
        <div class="tool-section">
          <div class="tool-section-title">参数</div>
          <pre>{{ argsText }}</pre>
        </div>
        <div v-if="item.resultText" class="tool-section">
          <div class="tool-section-title">结果</div>
          <pre>{{ item.resultText }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
