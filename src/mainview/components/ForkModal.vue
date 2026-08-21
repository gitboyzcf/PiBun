<script setup lang="ts">
import { onMounted, ref } from "vue";
import { store } from "../store";
import { rpc } from "../rpc";
import { navigateTree } from "../actions";
import type { ForkMessage } from "../../shared/rpc-schema";

const emit = defineEmits<{ close: [] }>();
const messages = ref<ForkMessage[]>([]);
const loading = ref(true);

onMounted(async () => {
  if (store.current) {
    const { messages: list } = await rpc.request.getForkMessages({
      sessionId: store.current.id,
    });
    messages.value = list.reverse(); // 最近的在前
  }
  loading.value = false;
});

function pick(m: ForkMessage) {
  navigateTree(m.entryId);
  emit("close");
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h2 class="modal-title">分叉 / 树导航</h2>
      <p class="modal-sub">选择一条历史消息，从该处继续对话（原内容保留为新分支）</p>
      <div v-if="loading" class="empty-hint">加载中…</div>
      <div v-else-if="!messages.length" class="empty-hint">暂无可分叉的消息</div>
      <div v-else class="fork-list">
        <button
          v-for="m in messages"
          :key="m.entryId"
          class="fork-item"
          @click="pick(m)"
        >
          {{ m.text.slice(0, 100) }}{{ m.text.length > 100 ? "…" : "" }}
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>
