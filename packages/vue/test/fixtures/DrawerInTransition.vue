<script setup lang="ts">
import type { PropType } from 'vue';
import { Drawer } from '../../src/drawer';
import UnmountLog from './UnmountLog.vue';

type Props = Record<string, unknown>;
type JsHooks = { enter(done: () => void): void; leave(done: () => void): void };

defineProps({
  root: Object as PropType<Props>,
  payloads: Array as PropType<readonly string[]>,
  portal: Object as PropType<Props>,
  viewport: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  jsHooks: Object as PropType<JsHooks>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <Drawer.Root v-bind="root">
    <template #default="{ payload }">
      <Drawer.Trigger id="a" :payload="payloads?.[0]">A</Drawer.Trigger>
      <Drawer.Trigger id="b" :payload="payloads?.[1]">B</Drawer.Trigger>
      <Drawer.Portal v-bind="portal">
        <Transition
          v-if="backdrop"
          name="fade"
          @leave-cancelled="log.add('backdrop-leave-cancelled')"
          @after-enter="log.add('backdrop-after-enter')"
          @after-leave="log.add('backdrop-after-leave')"
        >
          <Drawer.Backdrop
            data-testid="backdrop"
            style="position: fixed; inset: 0; background: rgb(0 0 0 / 20%)"
            v-bind="backdrop"
          />
        </Transition>
        <Drawer.Viewport data-testid="viewport" style="position: fixed; inset: 0" v-bind="viewport">
          <Transition
            v-if="jsHooks"
            :css="false"
            @before-enter="log.add('before-enter')"
            @enter="(_el: Element, done: () => void) => jsHooks?.enter(done)"
            @after-enter="log.add('after-enter')"
            @leave="(_el: Element, done: () => void) => jsHooks?.leave(done)"
            @after-leave="log.add('after-leave')"
          >
            <Drawer.Popup data-testid="popup" class="sheet" v-bind="popup">
              <button>Inside</button>
              <span v-if="payload !== undefined" data-testid="payload">{{ payload }}</span>
              <UnmountLog :log />
            </Drawer.Popup>
          </Transition>
          <Transition
            v-else
            name="sheet"
            @leave-cancelled="log.add('leave-cancelled')"
            @after-enter="log.add('after-enter')"
            @after-leave="log.add('after-leave')"
          >
            <Drawer.Popup data-testid="popup" class="sheet" v-bind="popup">
              <button>Inside</button>
              <span v-if="payload !== undefined" data-testid="payload">{{ payload }}</span>
              <UnmountLog :log />
            </Drawer.Popup>
          </Transition>
        </Drawer.Viewport>
      </Drawer.Portal>
    </template>
  </Drawer.Root>
</template>

<style>
.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 300px;
  background: white;
}
.fade-enter-active,
.fade-leave-active,
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 300ms;
}
.fade-enter-from,
.fade-leave-to,
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.slow.fade-enter-active,
.slow.fade-leave-active,
.slow.sheet-enter-active,
.slow.sheet-leave-active {
  transition: opacity 3s linear;
}
</style>
