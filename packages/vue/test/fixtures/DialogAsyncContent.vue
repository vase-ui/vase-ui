<script setup lang="ts">
import { defineAsyncComponent, type PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// An open dialog in a `<Suspense>`, with an async component in its popup. The component loads when
// `loaded` resolves.
const props = defineProps({
  loaded: { type: Object as PropType<Promise<void>>, required: true },
});
const Greeting = defineAsyncComponent(async () => {
  await props.loaded;
  return { render: () => 'Greetings' };
});
</script>

<template>
  <Suspense>
    <Dialog.Root default-open>
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup">
          <Greeting />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <template #fallback>Loading</template>
  </Suspense>
</template>
