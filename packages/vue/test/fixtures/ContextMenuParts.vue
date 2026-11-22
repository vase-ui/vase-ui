<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { ContextMenu } from '../../src/context-menu';

type Props = Record<string, unknown>;

// A trigger of 300 by 200 px at the top left of the view, with an input before it. With `inner`, a
// second context menu has its trigger in the first one.
defineProps({
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  inner: Object as PropType<Props>,
  /** The parts that a test removes: `trigger`. */
  shown: { type: Object as PropType<{ trigger?: boolean }>, default: () => ({}) },
  /** The props of the submenu trigger. */
  submenu: Object as PropType<Props>,
  /** The props of the popup of the submenu. */
  subPopup: Object as PropType<Props>,
  items: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
});

const rootPart = useTemplateRef<{ close(): void }>('rootPart');
const triggerPart = useTemplateRef<{ element: Element | null }>('triggerPart');
const positionerPart = useTemplateRef<{ element: Element | null }>('positionerPart');
defineExpose({ root: rootPart, trigger: triggerPart, positioner: positionerPart });
</script>

<template>
  <input id="before" aria-label="Before" />
  <ContextMenu.Root ref="rootPart" v-bind="root">
    <ContextMenu.Trigger
      v-if="shown.trigger !== false"
      ref="triggerPart"
      data-testid="trigger"
      style="display: block; width: 300px; height: 200px; background: #eee"
      v-bind="trigger"
    >
      Area
      <ContextMenu.Root v-if="inner" v-bind="inner">
        <ContextMenu.Trigger
          data-testid="inner-trigger"
          style="display: block; width: 100px; height: 60px"
        >
          Inner
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="inner-popup">
              <ContextMenu.Item data-key="inner-a">Inner a</ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </ContextMenu.Trigger>
    <ContextMenu.Portal v-bind="portal">
      <ContextMenu.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
      <ContextMenu.Positioner ref="positionerPart" data-testid="positioner" v-bind="positioner">
        <ContextMenu.Popup data-testid="popup" v-bind="popup">
          <ContextMenu.Item
            v-for="key in ['a', 'b', 'c']"
            :key="key"
            :data-key="key"
            v-bind="items[key]"
          >
            {{ key }}
          </ContextMenu.Item>
          <ContextMenu.SubmenuRoot>
            <ContextMenu.SubmenuTrigger data-key="sub" :delay="0" v-bind="submenu"
              >More</ContextMenu.SubmenuTrigger
            >
            <ContextMenu.Portal>
              <ContextMenu.Positioner data-testid="sub-positioner">
                <ContextMenu.Popup data-testid="sub-popup" v-bind="subPopup">
                  <ContextMenu.Item data-key="s1">s1</ContextMenu.Item>
                </ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.SubmenuRoot>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
  <input id="after" aria-label="After" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
