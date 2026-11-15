<script setup lang="ts">
import { defineComponent, onMounted } from 'vue';
import type { Directive } from 'vue';
import * as Toast from '../index.parts';
import { useToastProviderContext } from '../provider/ToastProviderContext';

const props = withDefaults(
  defineProps<{
    /** The nodes that the viewport keeps beside its element. */
    nodes?: 'none' | 'guards' | 'alert';
    mode?: 'show' | 'transition';
    shown?: boolean;
  }>(),
  { nodes: 'none', mode: 'show', shown: true },
);

// The focus guards render while there is a toast and a place to return the focus to. The alert
// region renders while there is a high priority toast.
const ToastAdder = defineComponent({
  setup() {
    const store = useToastProviderContext();
    onMounted(() => {
      if (props.nodes === 'guards') {
        store.addToast({ title: 'toast', timeout: 0 });
        store.set('prevFocusElement', document.body);
      } else if (props.nodes === 'alert') {
        store.addToast({ title: 'toast', priority: 'high', timeout: 0 });
      }
    });
    return () => null;
  },
});

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <Toast.Provider>
    <ToastAdder />
    <Transition v-if="mode === 'transition'">
      <Toast.Viewport v-if="shown" v-mark="'marked'" class="viewport" data-testid="viewport" />
    </Transition>
    <Toast.Viewport
      v-else
      v-show="shown"
      v-mark="'marked'"
      class="viewport"
      data-testid="viewport"
    />
  </Toast.Provider>
</template>

<style scoped>
.viewport {
  outline-style: dashed;
}
</style>
