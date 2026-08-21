<script setup lang="ts">
import { store } from "../store";

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h2 class="modal-title">会话统计</h2>
      <template v-if="store.stats">
        <div class="stats-grid">
          <div class="stats-label">会话文件</div>
          <div class="stats-value mono">{{ store.stats.sessionFile ?? "（内存会话）" }}</div>
          <div class="stats-label">会话 ID</div>
          <div class="stats-value mono">{{ store.stats.sessionId }}</div>
          <div class="stats-label">模型</div>
          <div class="stats-value">{{ store.stats.model?.name ?? "-" }}</div>
          <div class="stats-label">Thinking</div>
          <div class="stats-value">{{ store.stats.thinkingLevel }}</div>
          <div class="stats-label">消息</div>
          <div class="stats-value">
            共 {{ store.stats.totalMessages }} 条（用户 {{ store.stats.userMessages }} /
            助手 {{ store.stats.assistantMessages }} / 工具调用 {{ store.stats.toolCalls }}）
          </div>
          <div class="stats-label">Token</div>
          <div class="stats-value">
            输入 {{ store.stats.tokens.input.toLocaleString() }} · 输出
            {{ store.stats.tokens.output.toLocaleString() }} · 缓存读
            {{ store.stats.tokens.cacheRead.toLocaleString() }} · 缓存写
            {{ store.stats.tokens.cacheWrite.toLocaleString() }}
          </div>
          <div class="stats-label">成本</div>
          <div class="stats-value">${{ store.stats.cost.toFixed(4) }}</div>
          <div class="stats-label">上下文占用</div>
          <div class="stats-value">
            <template v-if="store.stats.contextPercent != null">
              {{ (store.stats.contextPercent * 100).toFixed(1) }}%
              （{{ store.stats.contextTokens?.toLocaleString() }} /
              {{ store.stats.contextWindow?.toLocaleString() }}）
            </template>
            <template v-else>-</template>
          </div>
          <div class="stats-label">启用工具</div>
          <div class="stats-value">{{ store.stats.activeTools.join(", ") || "-" }}</div>
        </div>
      </template>
      <div v-else class="empty-hint">暂无统计</div>
      <div class="modal-footer">
        <button class="btn primary" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>
