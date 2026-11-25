<script setup lang="ts">
import type { PropType } from 'vue';
import { NavigationMenu } from '../../src/navigation-menu';
import UnmountLog from './UnmountLog.vue';

type Props = Record<string, unknown>;
type JsHooks = { enter(done: () => void): void; leave(done: () => void): void };

defineProps({
  root: Object as PropType<Props>,
  triggers: Object as PropType<Record<string, Props>>,
  contents: Object as PropType<Record<string, Props>>,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  jsHooks: Object as PropType<JsHooks>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <NavigationMenu.Root v-bind="root">
    <NavigationMenu.List style="display: flex; gap: 160px; margin: 0; padding: 0; list-style: none">
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger id="trigger-one" data-testid="trigger-one" v-bind="triggers?.one">
          One
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          data-testid="content-one"
          style="width: 200px; height: 100px"
          v-bind="contents?.one"
        >
          <NavigationMenu.Link href="#one-a" data-testid="link-one-a">One A</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item value="two">
        <NavigationMenu.Trigger id="trigger-two" data-testid="trigger-two" v-bind="triggers?.two">
          Two
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          data-testid="content-two"
          style="width: 300px; height: 150px"
          v-bind="contents?.two"
        >
          <NavigationMenu.Link href="#two-a" data-testid="link-two-a">Two A</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item>
        <NavigationMenu.Link href="#blog" data-testid="link-blog">Blog</NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal v-bind="portal">
      <Transition v-if="backdrop" name="nav-fade" @after-leave="log.add('backdrop-after-leave')">
        <NavigationMenu.Backdrop data-testid="backdrop" v-bind="backdrop" />
      </Transition>
      <NavigationMenu.Positioner data-testid="positioner" v-bind="positioner">
        <Transition
          v-if="jsHooks"
          :css="false"
          @before-enter="log.add('before-enter')"
          @enter="(_el: Element, done: () => void) => jsHooks?.enter(done)"
          @after-enter="log.add('after-enter')"
          @leave="(_el: Element, done: () => void) => jsHooks?.leave(done)"
          @after-leave="log.add('after-leave')"
        >
          <NavigationMenu.Popup data-testid="popup" v-bind="popup">
            <NavigationMenu.Viewport data-testid="viewport" />
            <UnmountLog :log />
          </NavigationMenu.Popup>
        </Transition>
        <Transition
          v-else
          name="nav-leave"
          @after-enter="log.add('after-enter')"
          @after-leave="log.add('after-leave')"
        >
          <NavigationMenu.Popup data-testid="popup" v-bind="popup">
            <NavigationMenu.Viewport data-testid="viewport" />
            <UnmountLog :log />
          </NavigationMenu.Popup>
        </Transition>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>

<style>
.nav-fade-enter-from,
.nav-fade-leave-to,
.nav-leave-enter-from,
.nav-leave-leave-to {
  opacity: 0;
}
.nav-leave-leave-active {
  transition: opacity 400ms linear;
}
.slow.nav-fade-enter-active,
.slow.nav-fade-leave-active,
.slow.nav-leave-enter-active,
.slow.nav-leave-leave-active {
  transition: opacity 3s linear;
}
.nav-sized {
  width: var(--popup-width, auto);
  height: var(--popup-height, auto);
  overflow: hidden;
  transition:
    width 80ms,
    height 80ms;
}
.nav-sized.slow.nav-leave-enter-active {
  transition:
    width 80ms,
    height 80ms,
    opacity 800ms linear;
}
</style>
