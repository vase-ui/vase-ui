<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';

type Props = Record<string, unknown>;

// A backdrop and a popup in `<Transition appear>` in a portal. The classes of the transitions have
// a duration, so a leave waits for its end. The leave of the backdrop is longer than that of the
// popup.
defineProps({
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <Popover.Root v-bind="root">
    <Popover.Trigger v-bind="trigger">Trigger</Popover.Trigger>
    <Popover.Portal v-bind="portal">
      <Transition name="fade" appear @after-leave="log.add('backdrop-after-leave')">
        <Popover.Backdrop data-testid="backdrop" />
      </Transition>
      <Popover.Positioner data-testid="positioner">
        <Transition
          name="pop"
          appear
          @after-enter="log.add('after-enter')"
          @after-leave="log.add('after-leave')"
        >
          <Popover.Popup data-testid="popup" v-bind="popup">
            <button>Inside</button>
          </Popover.Popup>
        </Transition>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>

<style>
.fade-enter-active,
.pop-enter-active,
.pop-leave-active {
  transition: opacity 100ms;
}
.fade-leave-active {
  transition: opacity 250ms;
}
.fade-enter-from,
.fade-leave-to,
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
</style>
