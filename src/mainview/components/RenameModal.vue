<script setup lang="ts">
import { ref } from "vue";
import { NModal, NInput, NButton } from "naive-ui";
import { store } from "../store";
import { renameSession } from "../actions";

const emit = defineEmits<{ close: [] }>();
const name = ref(store.current?.name ?? "");

function submit() {
  if (name.value.trim()) renameSession(name.value);
  emit("close");
}
</script>

<template>
  <n-modal
    :show="true"
    preset="card"
    title="会话命名"
    style="width: 380px"
    @close="emit('close')"
  >
    <n-input
      v-model:value="name"
      placeholder="输入会话名称"
      @keydown.enter="submit"
    />
    <template #footer>
      <div class="modal-footer">
        <n-button @click="emit('close')">取消</n-button>
        <n-button type="primary" @click="submit">确定</n-button>
      </div>
    </template>
  </n-modal>
</template>
