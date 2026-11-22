<script setup lang="ts">
import { computed, type PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';
import type { AlertDialogHandle } from '../../src/dialog/root';
import CallAtMount from './CallAtMount.vue';

type Handle = InstanceType<typeof Dialog.Handle>;

// Triggers with a handle, outside the roots of `scene.roots`, which can have another handle. Each
// trigger has the id and the text of its key and the payload of `scene.payloads`. The popup of each
// root has the `data-testid` `popup-<key>`, its payload in `payload-<key>` and a close button.
// `scene.section` puts the triggers in a `<section>` in place of a `<div>`, so they mount again.
// With `alert`, the root and the triggers are those of Alert Dialog, and each popup has a backdrop.
// `atMount` runs in `onMounted` of a child of each root.
const props = defineProps({
  scene: {
    type: Object as PropType<{
      triggerHandle: Handle;
      rootHandle: Handle | undefined;
      roots: string[];
      triggers: string[];
      payloads?: Record<string, unknown>;
      section?: boolean;
      triggersAfter?: boolean;
    }>,
    required: true,
  },
  alert: Boolean,
  root: Object as PropType<Record<string, unknown>>,
  atMount: Function as PropType<() => void>,
});
// The template gives the handles to the parts of the two families.
const triggerHandle = computed(() => props.scene.triggerHandle as AlertDialogHandle);
const rootHandle = computed(() => props.scene.rootHandle as AlertDialogHandle | undefined);
</script>

<template>
  <component :is="scene.section ? 'section' : 'div'" v-if="!scene.triggersAfter">
    <component
      :is="alert ? AlertDialog.Trigger : Dialog.Trigger"
      v-for="key in scene.triggers"
      :id="key"
      :key="key"
      :handle="triggerHandle"
      :payload="scene.payloads?.[key]"
    >
      {{ key }}
    </component>
  </component>
  <component
    :is="alert ? AlertDialog.Root : Dialog.Root"
    v-for="key in scene.roots"
    :key="key"
    :handle="rootHandle"
    v-bind="root"
  >
    <template #default="{ payload }">
      <CallAtMount v-if="atMount" :call="atMount" />
      <Dialog.Portal>
        <Dialog.Backdrop
          v-if="alert"
          :data-testid="`backdrop-${key}`"
          style="position: fixed; inset: 0"
        />
        <Dialog.Popup
          :data-testid="`popup-${key}`"
          style="position: fixed; left: 200px; top: 100px"
        >
          <span :data-testid="`payload-${key}`">{{ payload }}</span>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </template>
  </component>
  <component :is="scene.section ? 'section' : 'div'" v-if="scene.triggersAfter">
    <component
      :is="alert ? AlertDialog.Trigger : Dialog.Trigger"
      v-for="key in scene.triggers"
      :id="key"
      :key="key"
      :handle="triggerHandle"
      :payload="scene.payloads?.[key]"
    >
      {{ key }}
    </component>
  </component>
</template>
