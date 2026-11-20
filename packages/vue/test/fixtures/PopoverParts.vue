<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Popover } from '../../src/popover';

type Item = { key: string; attrs?: Record<string, unknown> };
type Props = Record<string, unknown>;

// Each trigger has the text and the `data-key` of its key. With no `triggers`, the root has one
// trigger with the key `t`. Text inputs stand before and after the root. The popup holds two
// buttons, and the parts that their props name.
defineProps({
  root: Object as PropType<Props>,
  triggers: { type: Array as PropType<Item[]>, default: () => [{ key: 't' }] },
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  arrow: Object as PropType<Props>,
  title: Object as PropType<Props>,
  description: Object as PropType<Props>,
  close: Object as PropType<Props>,
  noPopup: Boolean,
  noPortal: Boolean,
  /** A second popover in the popup, with its own trigger. */
  nested: Object as PropType<{ root?: Props; portal?: Props; popup?: Props }>,
});
const rootPart = useTemplateRef('rootPart');
const popupPart = useTemplateRef('popupPart');
defineExpose({ root: rootPart, popup: popupPart });
</script>

<template>
  <input id="before" aria-label="Before" />
  <Popover.Root ref="rootPart" v-bind="root">
    <template #default="{ payload }">
      <Popover.Trigger
        v-for="trigger in triggers"
        :key="trigger.key"
        :data-key="trigger.key"
        v-bind="trigger.attrs"
      >
        {{ trigger.key }}
      </Popover.Trigger>
      <Popover.Portal v-if="!noPortal" v-bind="portal">
        <Popover.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
        <Popover.Positioner data-testid="positioner" v-bind="positioner">
          <Popover.Popup v-if="!noPopup" ref="popupPart" data-testid="popup" v-bind="popup">
            <Popover.Arrow v-if="arrow" data-testid="arrow" v-bind="arrow" />
            <Popover.Title v-if="title" v-bind="title">Title</Popover.Title>
            <Popover.Description v-if="description" v-bind="description">
              Description
            </Popover.Description>
            <span data-testid="payload">{{ payload }}</span>
            <button data-testid="first">First</button>
            <button data-testid="second">Second</button>
            <Popover.Close v-if="close" v-bind="close">Close</Popover.Close>
            <Popover.Root v-if="nested" v-bind="nested.root">
              <Popover.Trigger data-key="nested">nested</Popover.Trigger>
              <Popover.Portal v-bind="nested.portal">
                <Popover.Positioner data-testid="nested-positioner">
                  <Popover.Popup data-testid="nested-popup" v-bind="nested.popup">
                    <button data-testid="nested-button">Nested</button>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </template>
  </Popover.Root>
  <input id="after" aria-label="After" />
  <button id="outside">Outside</button>
</template>
