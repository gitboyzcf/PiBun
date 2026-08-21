<script setup lang="ts">
import { ref } from "vue";
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
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal modal-sm">
      <h2 class="modal-title">会话命名</h2>
      <input
        v-model="name"
        class="form-control"
        placeholder="输入会话名称"
        @keydown.enter="submit"
      />
      <div class="modal-footer">
        <button class="btn" @click="emit('close')">取消</button>
        <button class="btn primary" @click="submit">确定</button>
      </div>
    </div>
  </div>
</template>
