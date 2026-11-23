<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from 'vue';
import { Dialog } from '../../src/dialog';

// A dialog in place that is open at the mount. Its popup holds a box that scrolls and holds no
// control, and then a field. The box measures its overflow after its mount, and it takes a tab
// stop in the next update.
const box = useTemplateRef<HTMLElement>('box');
const overflows = shallowRef(false);
watch(
  box,
  (element) => (overflows.value = !!element && element.scrollHeight > element.clientHeight),
  { flush: 'post' },
);
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Portal disabled>
      <Dialog.Popup data-testid="popup">
        <div
          ref="box"
          data-testid="box"
          :tabindex="overflows ? 0 : undefined"
          style="height: 40px; overflow: auto"
        >
          <p style="height: 200px">Text</p>
        </div>
        <input data-testid="field" aria-label="Field" />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
