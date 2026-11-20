<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';
import CallAtMount from './CallAtMount.vue';

// Two triggers outside the root, with a handle, and one trigger in the root. With `alert`, the parts
// are those of Alert Dialog. `scene.root` mounts the root, and `scene.inside` the trigger in the
// root. `atMount` runs in `onMounted` of a child of the root.
const props = defineProps({
  // A server render gets its props as JSON, so it gets no handle.
  handle: {
    type: Object as PropType<InstanceType<typeof Dialog.Handle>>,
    default: () => Dialog.createHandle(),
  },
  alert: Boolean,
  root: Object as PropType<Record<string, unknown>>,
  scene: {
    type: Object as PropType<{ root?: boolean; inside?: boolean }>,
    default: () => ({}),
  },
  atMount: Function as PropType<() => void>,
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart, handle: props.handle });
</script>

<template>
  <component :is="alert ? AlertDialog.Trigger : Dialog.Trigger" id="first" :handle payload="first">
    First
  </component>
  <component
    :is="alert ? AlertDialog.Trigger : Dialog.Trigger"
    id="second"
    :handle
    payload="second"
  >
    Second
  </component>
  <component
    :is="alert ? AlertDialog.Root : Dialog.Root"
    v-if="scene.root !== false"
    ref="rootPart"
    :handle
    v-bind="root"
  >
    <template #default="{ payload }">
      <component :is="alert ? AlertDialog.Trigger : Dialog.Trigger" v-if="scene.inside !== false" id="inside">
        Inside
      </component>
      <span data-testid="root-payload">{{ payload }}</span>
      <CallAtMount v-if="atMount" :call="atMount" />
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup" style="position: fixed; left: 200px; top: 100px">
          <span data-testid="payload">{{ payload }}</span>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </template>
  </component>
</template>
