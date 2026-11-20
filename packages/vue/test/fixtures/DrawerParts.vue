<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Drawer } from '../../src/drawer';

type Props = Record<string, unknown>;

// A drawer with one trigger, and the parts that their props name. The viewport covers the view,
// and the popup is a sheet of 300 px at the edge of its swipe direction. The popup holds a text, a
// text field, a button, a scroller of 600 px of content in 100 px, and the parts that their props
// name. With `transition`, the popup and the backdrop leave in 200 ms to their closed place.
// `nested` puts a second drawer with the same parts in the popup.
const props = defineProps({
  root: Object as PropType<Props>,
  trigger: { type: Object as PropType<Props>, default: () => ({}) },
  swipeArea: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  viewport: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  content: Object as PropType<Props>,
  close: Object as PropType<Props>,
  transition: Boolean,
  nested: Object as PropType<Props>,
  testPrefix: { type: String, default: '' },
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });
const id = (name: string) => `${props.testPrefix}${name}`;
</script>

<template>
  <Drawer.Root ref="rootPart" v-bind="root">
    <Drawer.Trigger v-if="trigger" :data-testid="id('trigger')" v-bind="trigger">Open</Drawer.Trigger>
    <Drawer.SwipeArea
      v-if="swipeArea"
      :data-testid="id('swipe-area')"
      class="drawer-test-area"
      v-bind="swipeArea"
    />
    <Drawer.Portal v-bind="portal">
      <Transition
        name="drawer-test"
        :css="transition"
        :appear="transition"
      >
        <Drawer.Backdrop
          v-if="backdrop"
          :data-testid="id('backdrop')"
          class="drawer-test-backdrop"
          v-bind="backdrop"
        />
      </Transition>
      <Drawer.Viewport :data-testid="id('viewport')" class="drawer-test-viewport" v-bind="viewport">
        <Transition name="drawer-test" :css="transition" :appear="transition">
          <Drawer.Popup :data-testid="id('popup')" class="drawer-test-popup" v-bind="popup">
            <p :data-testid="id('text')">Text of the drawer that a person can select.</p>
            <input :data-testid="id('field')" aria-label="Field" value="Value" />
            <button :data-testid="id('button')">Button</button>
            <div :data-testid="id('scroller')" class="drawer-test-scroller">
              <div style="height: 600px">Long</div>
            </div>
            <Drawer.Content v-if="content" :data-testid="id('content')" v-bind="content">
              Content
            </Drawer.Content>
            <Drawer.Close v-if="close" v-bind="close">Close</Drawer.Close>
            <DrawerParts v-if="nested" v-bind="nested" test-prefix="nested-" />
          </Drawer.Popup>
        </Transition>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>

<style>
.drawer-test-viewport {
  position: fixed;
  inset: 0;
}
.drawer-test-backdrop {
  position: fixed;
  inset: 0;
}
.drawer-test-popup {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 300px;
  background: white;
  transition: transform 200ms linear;
  transform: translate(
    var(--drawer-swipe-movement-x),
    calc(var(--drawer-snap-point-offset) + var(--drawer-swipe-movement-y))
  );
}
.drawer-test-popup[data-swipe-direction='up'] {
  top: 0;
  bottom: auto;
}
.drawer-test-popup[data-swipe-direction='right'],
.drawer-test-popup[data-swipe-direction='left'] {
  top: 0;
  height: auto;
  width: 300px;
}
.drawer-test-popup[data-swipe-direction='right'] {
  left: auto;
}
.drawer-test-scroller {
  height: 100px;
  overflow-y: auto;
}
.drawer-test-leave-active {
  transition: transform calc(var(--drawer-swipe-strength) * 200ms) linear;
}
.drawer-test-enter-from,
.drawer-test-leave-to {
  transform: translateY(100%);
}
.drawer-test-area {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 40px;
}
</style>
