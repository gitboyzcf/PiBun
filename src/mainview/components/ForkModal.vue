<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NModal, NButton, NEmpty } from "naive-ui";
import { Branch } from "@icon-park/vue-next";
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
  <n-modal
    :show="true"
    preset="card"
    title="分叉 / 树导航"
    style="width: 520px"
    @close="emit('close')"
  >
    <p class="modal-sub">选择一条历史消息，从该处继续对话（原内容保留为新分支）</p>
    <n-empty v-if="!loading && !messages.length" description="暂无可分叉的消息" />
    <div v-else class="fork-list">
      <button
        v-for="m in messages"
        :key="m.entryId"
        class="fork-item"
        @click="pick(m)"
      >
        <branch theme="outline" size="13" style="margin-right: 6px" />
        {{ m.text.slice(0, 100) }}{{ m.text.length > 100 ? "…" : "" }}
      </button>
    </div>
    <template #footer>
      <div class="modal-footer">
        <n-button @click="emit('close')">取消</n-button>
      </div>
    </template>
  </n-modal>
</template>
