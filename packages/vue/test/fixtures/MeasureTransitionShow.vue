<script setup lang="ts">
import { provide, type PropType } from 'vue';
import MeasureShownPopup from './MeasureShownPopup.vue';

// A `<Teleport>` that renders while the scene is rendered, as a portal does, with a `<Transition>`
// of the developer around a part that hides its root element with `v-show`. Each hook writes its
// name in the log. With `css` false, the `enter` and `leave` hooks end after 50 ms.
const props = defineProps({
  scene: {
    type: Object as PropType<{ open: boolean; rendered: boolean }>,
    required: true,
  },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
  appear: Boolean,
  css: { type: Boolean, default: true },
  /** Reads the layout in the `leave-cancelled` and `before-enter` hooks. */
  readsLayout: Boolean,
});
provide('scene', props.scene);

// Vue waits for `done` of a hook that declares it, also with CSS.
const hooks = {
  css: {
    enter: () => props.log.add('enter'),
    leave: () => props.log.add('leave'),
  },
  js: {
    enter(_: Element, done: () => void) {
      props.log.add('enter');
      setTimeout(done, 50);
    },
    leave(_: Element, done: () => void) {
      props.log.add('leave');
      setTimeout(done, 50);
    },
  },
};

function logWithWidth(hook: string, element: Element) {
  props.log.add(hook);
  if (props.readsLayout) props.log.add(`width ${(element as HTMLElement).offsetWidth}`);
}
</script>

<template>
  <Teleport v-if="scene.rendered" to="body">
    <Transition
      name="show"
      :appear
      :css
      @before-enter="(element: Element) => logWithWidth('before-enter', element)"
      @enter="hooks[css ? 'css' : 'js'].enter"
      @after-enter="log.add('after-enter')"
      @before-leave="log.add('before-leave')"
      @leave="hooks[css ? 'css' : 'js'].leave"
      @after-leave="log.add('after-leave')"
      @leave-cancelled="(element: Element) => logWithWidth('leave-cancelled', element)"
    >
      <MeasureShownPopup />
    </Transition>
  </Teleport>
</template>

<style>
.show-enter-active,
.show-leave-active {
  transition: opacity 500ms linear;
}
.show-enter-from,
.show-leave-to {
  opacity: 0;
}
</style>
