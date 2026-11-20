<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Dialog } from '../../src/dialog';

// A dialog in place whose `finalFocus` is a container. A radio of one group is in the popup, which
// leaves in a `<Transition>`, and another one is after it in the container.
defineProps({ checked: Boolean });
const container = useTemplateRef<HTMLElement>('container');
</script>

<template>
  <Dialog.Root default-open :modal="false">
    <div ref="container">
      <Dialog.Portal disabled>
        <Transition name="return">
          <Dialog.Popup data-testid="popup" :final-focus="container">
            <input type="radio" name="choice" :checked aria-label="Inside" />
          </Dialog.Popup>
        </Transition>
      </Dialog.Portal>
      <input type="radio" name="choice" aria-label="Outside" />
      <button>After</button>
    </div>
  </Dialog.Root>
</template>

<style>
.return-leave-active {
  transition: opacity 300ms;
}
.return-leave-to {
  opacity: 0;
}
</style>
