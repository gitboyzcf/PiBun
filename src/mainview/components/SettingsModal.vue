<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { store } from "../store";
import {
  saveApiKey,
  removeApiKey,
  loadModels,
  selectModel,
  saveCwd,
} from "../actions";

const emit = defineEmits<{ close: [] }>();

const selectedProvider = ref(store.settings?.provider ?? "anthropic");
const apiKeyInput = ref("");
const saving = ref(false);
const cwdInput = ref(store.settings?.cwd ?? "");

const currentProvider = computed(() =>
  store.providers.find((p) => p.id === selectedProvider.value),
);

watch(selectedProvider, (p) => loadModels(p), { immediate: true });

async function onSaveKey() {
  if (!apiKeyInput.value.trim()) return;
  saving.value = true;
  const ok = await saveApiKey(selectedProvider.value, apiKeyInput.value);
  saving.value = false;
  if (ok) apiKeyInput.value = "";
}

function onSelectModel(e: Event) {
  const modelId = (e.target as HTMLSelectElement).value;
  if (modelId) selectModel(selectedProvider.value, modelId);
}

async function onSaveCwd() {
  if (cwdInput.value.trim()) await saveCwd(cwdInput.value.trim());
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h2 class="modal-title">设置</h2>

      <section class="form-section">
        <label class="form-label">模型服务商</label>
        <select v-model="selectedProvider" class="form-control">
          <option v-for="p in store.providers" :key="p.id" :value="p.id">
            {{ p.name }}{{ p.hasAuth ? " ✓" : "" }}
          </option>
        </select>
      </section>

      <section class="form-section">
        <label class="form-label">
          API Key
          <span v-if="currentProvider?.hasAuth" class="auth-ok">已配置 ✓</span>
        </label>
        <div class="key-row">
          <input
            v-model="apiKeyInput"
            type="password"
            class="form-control"
            :placeholder="currentProvider?.hasAuth ? '已保存，输入可覆盖' : '粘贴你的 API Key'"
          />
          <button class="btn primary" :disabled="saving" @click="onSaveKey">
            {{ saving ? "保存中…" : "保存" }}
          </button>
        </div>
        <button
          v-if="currentProvider?.hasAuth"
          class="btn danger-link"
          @click="removeApiKey(selectedProvider)"
        >
          移除该 Key
        </button>
      </section>

      <section class="form-section">
        <label class="form-label">默认模型</label>
        <select
          class="form-control"
          :value="store.settings?.modelId"
          @change="onSelectModel"
        >
          <option value="">（默认）</option>
          <option v-for="m in store.models" :key="m.id" :value="m.id">
            {{ m.name }}
          </option>
        </select>
      </section>

      <section class="form-section">
        <label class="form-label">工作目录（agent 读写文件的位置）</label>
        <div class="key-row">
          <input v-model="cwdInput" class="form-control" placeholder="D:\your\project" />
          <button class="btn" @click="onSaveCwd">应用</button>
        </div>
        <div v-if="store.settings?.recentCwds.length" class="recent-cwds">
          <span
            v-for="c in store.settings.recentCwds"
            :key="c"
            class="cwd-chip"
            @click="cwdInput = c"
          >
            {{ c }}
          </span>
        </div>
      </section>

      <div class="modal-footer">
        <button class="btn primary" @click="emit('close')">完成</button>
      </div>
    </div>
  </div>
</template>
