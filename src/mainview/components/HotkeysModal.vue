<script setup lang="ts">
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
      ["点击 footer 🧠", "切换 thinking level"],
      ["输入框边框颜色", "当前 thinking level 指示"],
      ["↩ 取回", "把排队消息恢复到输入框"],
    ],
  },
];
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h2 class="modal-title">快捷键</h2>
      <div v-for="g in groups" :key="g.title" class="form-section">
        <label class="form-label">{{ g.title }}</label>
        <div class="hotkey-list">
          <div v-for="[k, d] in g.items" :key="k" class="hotkey-row">
            <kbd class="hotkey-key">{{ k }}</kbd>
            <span>{{ d }}</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn primary" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>
