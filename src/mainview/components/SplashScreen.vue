<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import logoUrl from "../assets/logo.png";

const props = defineProps<{ ready: boolean }>();

const visible = ref(true);
const leaving = ref(false);
const start = Date.now();

watch(
  () => props.ready,
  (ready) => {
    if (!ready) return;
    // 最短展示 900ms，避免一闪而过
    const elapsed = Date.now() - start;
    const wait = Math.max(0, 900 - elapsed);
    setTimeout(() => {
      leaving.value = true;
      setTimeout(() => (visible.value = false), 450);
    }, wait);
  },
);

onMounted(() => {
  // 兜底：8 秒未完成也放行
  setTimeout(() => {
    if (visible.value && !leaving.value) {
      leaving.value = true;
      setTimeout(() => (visible.value = false), 450);
    }
  }, 8000);
});
</script>

<template>
  <div v-if="visible" class="splash" :class="{ leaving }">
    <div class="splash-inner">
      <div class="splash-logo-wrap">
        <img :src="logoUrl" class="splash-logo" alt="PiBun" />
        <div class="splash-ring"></div>
      </div>
      <div class="splash-brand">PiBun</div>
      <div class="splash-slogan">pi agent 可视化客户端</div>
      <div class="splash-bar"><div class="splash-bar-fill"></div></div>
    </div>
    <div class="splash-version">v0.1.0 · Electrobun + Bun</div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background:
    radial-gradient(1200px 600px at 20% 0%, rgba(16, 163, 127, 0.08), transparent),
    radial-gradient(900px 500px at 90% 100%, rgba(16, 163, 127, 0.06), transparent),
    #ffffff;
  transition: opacity 0.45s ease;
}
.splash.leaving {
  opacity: 0;
  pointer-events: none;
}
.splash-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: rise 0.5s cubic-bezier(0.21, 1.02, 0.73, 1);
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
}
.splash-logo-wrap {
  position: relative;
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
}
.splash-logo {
  width: 96px;
  height: 96px;
  border-radius: 24px;
  box-shadow: 0 12px 32px rgba(16, 163, 127, 0.28);
  animation: breathe 2.4s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    transform: scale(1.04);
    box-shadow: 0 16px 40px rgba(16, 163, 127, 0.36);
  }
}
.splash-ring {
  position: absolute;
  inset: 0;
  border-radius: 30px;
  border: 2px solid rgba(16, 163, 127, 0.35);
  animation: ring-pulse 2.4s ease-out infinite;
}
@keyframes ring-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.9;
  }
  70%,
  100% {
    transform: scale(1.18);
    opacity: 0;
  }
}
.splash-brand {
  margin-top: 20px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #1f2328;
}
.splash-slogan {
  margin-top: 6px;
  font-size: 13px;
  color: #6b7280;
}
.splash-bar {
  margin-top: 26px;
  width: 180px;
  height: 4px;
  border-radius: 99px;
  background: #ececf1;
  overflow: hidden;
}
.splash-bar-fill {
  height: 100%;
  width: 40%;
  border-radius: 99px;
  background: linear-gradient(90deg, #10a37f, #13ba90);
  animation: slide 1.2s ease-in-out infinite;
}
@keyframes slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
.splash-version {
  position: absolute;
  bottom: 22px;
  font-size: 11px;
  color: #9ca3af;
}
</style>
