<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NModal, NSelect, NInput, NButton, NPopconfirm } from "naive-ui";
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

const providerOptions = computed(() =>
  store.providers.map((p) => ({
    label: `${p.name}${p.hasAuth ? " ✓" : ""}`,
    value: p.id,
  })),
);

const modelOptions = computed(() => [
  { label: "（默认）", value: "" },
  ...store.models.map((m) => ({ label: m.name, value: m.id })),
]);

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

function onSelectModel(modelId: string) {
  if (modelId) selectModel(selectedProvider.value, modelId);
}

async function onSaveCwd() {
  if (cwdInput.value.trim()) await saveCwd(cwdInput.value.trim());
}
</script>

<template>
  <n-modal
    :show="true"
    preset="card"
    title="设置"
    style="width: 540px"
    @close="emit('close')"
  >
    <section class="form-section">
      <label class="form-label">模型服务商</label>
      <n-select v-model:value="selectedProvider" :options="providerOptions" />
    </section>

    <section class="form-section">
      <label class="form-label">
        API Key
        <span v-if="currentProvider?.hasAuth" class="auth-ok">已配置 ✓</span>
      </label>
      <div class="key-row">
        <n-input
          v-model:value="apiKeyInput"
          type="password"
          show-password-on="click"
          :placeholder="currentProvider?.hasAuth ? '已保存，输入可覆盖' : '粘贴你的 API Key'"
        />
        <n-button type="primary" :loading="saving" @click="onSaveKey">保存</n-button>
      </div>
      <n-popconfirm v-if="currentProvider?.hasAuth" @positive-click="removeApiKey(selectedProvider)">
        <template #trigger>
          <n-button text type="error" size="tiny" style="margin-top: 4px">移除该 Key</n-button>
        </template>
        确定移除 {{ currentProvider?.name }} 的 API Key？
      </n-popconfirm>
    </section>

    <section class="form-section">
      <label class="form-label">默认模型</label>
      <n-select
        :value="store.settings?.modelId"
        :options="modelOptions"
        filterable
        @update:value="onSelectModel"
      />
    </section>

    <section class="form-section">
      <label class="form-label">工作目录（agent 读写文件的位置）</label>
      <div class="key-row">
        <n-input v-model:value="cwdInput" placeholder="D:\your\project" />
        <n-button @click="onSaveCwd">应用</n-button>
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

    <template #footer>
      <div class="modal-footer">
        <n-button type="primary" @click="emit('close')">完成</n-button>
      </div>
    </template>
  </n-modal>
</template>
