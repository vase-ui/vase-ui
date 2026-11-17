<script setup lang="ts">
import type { Directive } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

defineProps<{ visible: boolean }>();

const emit = defineEmits<{ beforeLeave: [element: Element] }>();

const vMark: Directive<HTMLElement> = {
  mounted(element) {
    element.setAttribute('data-marked', '');
  },
};
</script>

<template>
  <Dialog.Root default-open :modal="false" disable-pointer-dismissal>
    <Transition :css="false" @before-leave="emit('beforeLeave', $event)">
      <Dialog.Portal v-show="visible" v-mark disabled class="portal" data-testid="portal">
        <Dialog.Popup :initial-focus="false">Panel</Dialog.Popup>
      </Dialog.Portal>
    </Transition>
  </Dialog.Root>
</template>

<style scoped>
.portal {
  outline-style: dashed;
}
</style>
