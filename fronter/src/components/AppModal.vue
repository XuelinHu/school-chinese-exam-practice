<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-mask" @click.self="close">
      <div class="modal" :class="[`modal-${size}`, { 'modal-plain': plain }]" role="dialog" aria-modal="true">
        <header v-if="!plain" class="modal-head">
          <h3>{{ title }}</h3>
          <button class="modal-x" type="button" :aria-label="t('close')" @click="close">×</button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { watch, onUnmounted } from 'vue';
import { t } from '../i18n/index.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg | xl
  plain: { type: Boolean, default: false }, // 无头无内边距，给智能体弹框用
  closeOnEsc: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue', 'close']);

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.closeOnEsc) close();
}

// 打开时锁滚动 + 监听 Esc；关闭时全部还原，避免弹框关掉后页面还锁着
watch(
  () => props.modelValue,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) window.addEventListener('keydown', onKeydown);
    else window.removeEventListener('keydown', onKeydown);
  }
);

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKeydown);
});
</script>
