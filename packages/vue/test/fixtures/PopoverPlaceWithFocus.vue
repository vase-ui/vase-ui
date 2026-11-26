<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';
import PopupContentOnMounted from './PopupContentOnMounted.vue';
import type { PopupContentReading } from './popupContent';

// Three placement checks for an unplaced positioner:
// - `relative`: a disabled portal in a positioned ancestor places on the first frame.
// - `scrolled`: a focus in `onMounted` on a scrolled page does not scroll the page to the top.
// - `content-sized`: a popup whose height comes only from its content flips on the first frame.
defineProps({
  mode: { type: String as PropType<'relative' | 'scrolled' | 'content-sized'>, required: true },
  handle: Object as PropType<ReturnType<typeof Popover.createHandle>>,
  log: Object as PropType<{ add(entry: PopupContentReading): void }>,
});
</script>

<template>
  <div
    v-if="mode === 'relative'"
    style="position: relative; margin: 200px 0 0 150px; width: 400px; height: 300px"
  >
    <Popover.Root :handle>
      <Popover.Trigger id="trigger" :handle data-testid="trigger" style="margin: 40px 0 0 30px">
        Open
      </Popover.Trigger>
      <Popover.Portal disabled>
        <Popover.Positioner data-testid="positioner" side="bottom" align="start">
          <Popover.Popup data-testid="popup" style="width: 120px; height: 60px">
            <PopupContentOnMounted v-if="log" :log />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </div>
  <div v-else-if="mode === 'scrolled'">
    <div style="height: 2000px" />
    <Popover.Root :handle>
      <Popover.Trigger id="trigger" :handle data-testid="trigger">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner data-testid="positioner" side="bottom" align="start">
          <Popover.Popup data-testid="popup" style="width: 120px; height: 60px">
            <PopupContentOnMounted v-if="log" :log />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <div style="height: 1000px" />
  </div>
  <div v-else>
    <Popover.Trigger
      id="trigger"
      :handle
      data-testid="trigger"
      style="position: fixed; left: 100px; bottom: 10px"
    >
      Open
    </Popover.Trigger>
    <Popover.Root :handle>
      <Popover.Portal>
        <Popover.Positioner
          data-testid="positioner"
          side="bottom"
          style="transition-property: top, left, right, bottom; transition-duration: 1s"
        >
          <Popover.Popup data-testid="popup">
            <div style="width: 120px; height: 120px">Tall content</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </div>
</template>
