<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';
import DialogNested from './DialogNested.vue';

type Item = { key: string; attrs?: Record<string, unknown> };
type Props = Record<string, unknown>;

// Each trigger has the text and the `data-key` of its key. With no `triggers`, the root has one
// trigger with the key `t`. Text inputs stand before and after the root. The input after it and the
// outside button are at the bottom right of the view. The popup holds a text field and a button,
// and the parts that their props name. With `alert`, the root and the triggers are those of Alert
// Dialog. `nested` puts a second dialog in the popup, and `inTree` puts one after the portal. The popup is fixed at the top left of the view, above the fixed element of
// a modal dialog.
defineProps({
  alert: Boolean,
  root: Object as PropType<Props>,
  triggers: { type: Array as PropType<Item[]>, default: () => [{ key: 't' }] },
  portal: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  viewport: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  title: Object as PropType<Props>,
  description: Object as PropType<Props>,
  close: Object as PropType<Props>,
  noPopup: Boolean,
  noPortal: Boolean,
  nested: Object as PropType<InstanceType<typeof DialogNested>['$props']>,
  inTree: Object as PropType<InstanceType<typeof DialogNested>['$props']>,
  /** `scene.nested` set to `false` unmounts the dialog of `nested`, and `scene.popup` the popup. */
  scene: { type: Object as PropType<{ nested?: boolean; popup?: boolean }>, default: () => ({}) },
});
const POPUP_STYLE = 'position: fixed; left: 200px; top: 100px';
const rootPart = useTemplateRef('rootPart');
const popupPart = useTemplateRef('popupPart');
defineExpose({ root: rootPart, popup: popupPart });
</script>

<template>
  <input id="before" aria-label="Before" />
  <component :is="alert ? AlertDialog.Root : Dialog.Root" ref="rootPart" v-bind="root">
    <template #default="{ payload }">
      <component
        :is="alert ? AlertDialog.Trigger : Dialog.Trigger"
        v-for="trigger in triggers"
        :key="trigger.key"
        :data-key="trigger.key"
        v-bind="trigger.attrs"
      >
        {{ trigger.key }}
      </component>
      <Dialog.Portal v-if="!noPortal" v-bind="portal">
        <Dialog.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
        <Dialog.Viewport v-if="viewport" data-testid="viewport" v-bind="viewport">
          <Dialog.Popup
            v-if="!noPopup && scene.popup !== false"
            ref="popupPart"
            data-testid="popup"
            :style="POPUP_STYLE"
            v-bind="popup"
          >
            <Dialog.Title v-if="title" v-bind="title">Title</Dialog.Title>
            <Dialog.Description v-if="description" v-bind="description">
              Description
            </Dialog.Description>
            <span data-testid="payload">{{ payload }}</span>
            <input data-testid="field" aria-label="Field" />
            <button data-testid="button">Button</button>
            <Dialog.Close v-if="close" v-bind="close">Close</Dialog.Close>
            <DialogNested v-if="nested && scene.nested !== false" v-bind="nested" />
          </Dialog.Popup>
        </Dialog.Viewport>
        <Dialog.Popup
          v-else-if="!noPopup && scene.popup !== false"
          ref="popupPart"
          data-testid="popup"
          :style="POPUP_STYLE"
          v-bind="popup"
        >
          <Dialog.Title v-if="title" v-bind="title">Title</Dialog.Title>
          <Dialog.Description v-if="description" v-bind="description">
            Description
          </Dialog.Description>
          <span data-testid="payload">{{ payload }}</span>
          <input data-testid="field" aria-label="Field" />
          <button data-testid="button">Button</button>
          <Dialog.Close v-if="close" v-bind="close">Close</Dialog.Close>
          <DialogNested v-if="nested && scene.nested !== false" v-bind="nested" />
        </Dialog.Popup>
      </Dialog.Portal>
      <DialogNested v-if="inTree" v-bind="inTree" />
    </template>
  </component>
  <input id="after" aria-label="After" style="position: fixed; right: 0; bottom: 30px" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
