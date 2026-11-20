<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';

type Props = Record<string, unknown>;

// A backdrop and a popup in `<Transition appear>`, the popup in a viewport. The backdrop covers the
// view. The leaves have a duration, so a case can press the page while they run. A button of the
// page is under the backdrop. `log` gets the classes of the backdrop and of the popup at the start
// of each leave, and `after-leave` at the end of the leave of the popup.
defineProps({
  root: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <button id="page" style="position: fixed; left: 0; top: 0; width: 100px; height: 40px">
    Page
  </button>
  <Dialog.Root v-bind="root">
    <Dialog.Trigger style="position: fixed; right: 0; top: 0">Trigger</Dialog.Trigger>
    <Dialog.Portal v-bind="portal">
      <Transition name="fade" appear @leave="(el: Element) => log.add(`backdrop ${el.className}`)">
        <Dialog.Backdrop
          data-testid="backdrop"
          style="position: fixed; inset: 0; background: rgb(0 0 0 / 20%)"
        />
      </Transition>
      <Dialog.Viewport data-testid="viewport" style="position: fixed; inset: 0">
        <Transition
          name="pop"
          appear
          @leave="(el: Element) => log.add(`popup ${el.className}`)"
          @after-leave="log.add('after-leave')"
        >
          <Dialog.Popup
            data-testid="popup"
            style="position: absolute; left: 200px; top: 200px"
            v-bind="popup"
          >
            <button>Inside</button>
          </Dialog.Popup>
        </Transition>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
</template>

<style>
.fade-enter-active,
.fade-leave-active,
.pop-enter-active,
.pop-leave-active {
  transition: opacity 300ms;
}
.fade-enter-from,
.fade-leave-to,
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
</style>
