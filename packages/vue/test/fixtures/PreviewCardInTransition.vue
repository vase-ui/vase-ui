<script setup lang="ts">
import type { PropType } from 'vue';
import { PreviewCard } from '../../src/preview-card';
import UnmountLog from './UnmountLog.vue';

type Props = Record<string, unknown>;
type JsHooks = { enter(done: () => void): void; leave(done: () => void): void };

// Two links and a popup in a `<Transition>` in a portal, with an optional backdrop. The leave of
// the popup takes 300 ms. A popup and a backdrop with the class `slow` enter and leave in 3 s with
// a linear opacity. With `keepMounted` on the portal, Vue runs no transition, and an animation of
// `[hidden]` that fills forwards hides the kept popup in 300 ms. With `jsHooks`, the `<Transition>`
// runs JavaScript hooks with `:css="false"`. A child of the popup writes `child unmounted` at its
// unmount.
defineProps({
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  payloads: Array as PropType<readonly string[]>,
  portal: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  jsHooks: Object as PropType<JsHooks>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <PreviewCard.Root v-bind="root">
    <template #default="{ payload }">
      <PreviewCard.Trigger id="a" href="#a" :payload="payloads?.[0]" v-bind="trigger">
        A
      </PreviewCard.Trigger>
      <PreviewCard.Trigger
        id="b"
        href="#b"
        :payload="payloads?.[1]"
        v-bind="trigger"
        style="margin-left: 200px"
      >
        B
      </PreviewCard.Trigger>
      <PreviewCard.Portal v-bind="portal">
        <Transition v-if="backdrop" name="fade" @after-leave="log.add('backdrop-after-leave')">
          <PreviewCard.Backdrop data-testid="backdrop" v-bind="backdrop" />
        </Transition>
        <PreviewCard.Positioner data-testid="positioner">
          <Transition
            v-if="jsHooks"
            :css="false"
            @before-enter="log.add('before-enter')"
            @enter="(_el: Element, done: () => void) => jsHooks?.enter(done)"
            @after-enter="log.add('after-enter')"
            @leave="(_el: Element, done: () => void) => jsHooks?.leave(done)"
            @after-leave="log.add('after-leave')"
          >
            <PreviewCard.Popup data-testid="popup" class="card" v-bind="popup">
              Card
              <span v-if="payload !== undefined" data-testid="payload">{{ payload }}</span>
              <UnmountLog :log />
            </PreviewCard.Popup>
          </Transition>
          <Transition
            v-else
            name="card"
            @after-enter="log.add('after-enter')"
            @after-leave="log.add('after-leave')"
          >
            <PreviewCard.Popup data-testid="popup" class="card" v-bind="popup">
              Card
              <span v-if="payload !== undefined" data-testid="payload">{{ payload }}</span>
              <UnmountLog :log />
            </PreviewCard.Popup>
          </Transition>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </template>
  </PreviewCard.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>

<style>
.fade-enter-from,
.fade-leave-to,
.card-enter-from,
.card-leave-to {
  opacity: 0;
}
.card-leave-active {
  transition: opacity 300ms;
}
.slow.fade-enter-active,
.slow.fade-leave-active,
.slow.card-enter-active,
.slow.card-leave-active {
  transition: opacity 3s linear;
}
.card[hidden] {
  display: block;
  animation: card-hide 300ms forwards;
}
@keyframes card-hide {
  to {
    opacity: 0;
  }
}
</style>
