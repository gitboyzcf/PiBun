<script setup lang="ts">
import { NModal, NButton } from "naive-ui";

const emit = defineEmits<{ close: [] }>();

const groups = [
  {
    title: "输入",
    items: [
      ["Enter", "发送（流式中 = 插队 steer）"],
      ["Alt+Enter", "排队 followUp（agent 完成后执行）"],
      ["Shift+Enter", "换行"],
      ["Esc", "停止当前运行"],
      ["Ctrl+V", "粘贴图片"],
      ["/", "命令菜单"],
      ["@", "引用项目文件"],
      ["! / !!", "执行 shell（!! 不发给模型）"],
    ],
  },
  {
    title: "界面",
    items: [
      ["点击 footer thinking 按钮", "切换 thinking level"],
      ["输入框边框颜色", "当前 thinking level 指示"],
      ["「取回」按钮", "把排队消息恢复到输入框"],
    ],
  },
];
</script>

<template>
  <n-modal
    :show="true"
    preset="card"
    title="快捷键"
    style="width: 460px"
    @close="emit('close')"
  >
    <div v-for="g in groups" :key="g.title" class="form-section">
      <label class="form-label">{{ g.title }}</label>
      <div class="hotkey-list">
        <div v-for="[k, d] in g.items" :key="k" class="hotkey-row">
          <kbd class="hotkey-key">{{ k }}</kbd>
          <span>{{ d }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="modal-footer">
        <n-button type="primary" @click="emit('close')">关闭</n-button>
      </div>
    </template>
  </n-modal>
</template>
