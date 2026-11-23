<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';
import { PreviewCard } from '../../src/preview-card';
import { Tooltip } from '../../src/tooltip';

// A trigger with the `id` "trigger" at the bottom of the view, outside the root of `family`, which
// it reaches through `handle`. The view has no room under the trigger, so the popup goes above it.
// With a viewport in the popup, the positioner has its place in `top`, `left`, `right` and `bottom`,
// with a transition. The popup enters from the side that it is on, and fades in with a CSS
// animation.
// The popup of a preview card mounts at each open, so its `<Transition>` has `appear`. With
// `keepMounted`, the popup of the popover fades in with a transition when it loses `hidden`.
defineProps({
  family: {
    type: String as PropType<'Popover' | 'Menu' | 'Tooltip' | 'PreviewCard'>,
    required: true,
  },
  handle: { type: Object as PropType<any>, required: true },
  keepMounted: Boolean,
});
</script>

<template>
  <template v-if="family === 'Popover'">
    <Popover.Trigger id="trigger" :handle class="first-place-trigger">Trigger</Popover.Trigger>
    <Popover.Root :handle>
      <Popover.Portal :keep-mounted>
        <Popover.Positioner data-testid="positioner" class="first-place-positioner">
          <Transition name="first-place">
            <Popover.Popup
              data-testid="popup"
              class="first-place-popup"
              :class="{ 'first-place-kept': keepMounted }"
            >
              <Popover.Viewport>Popup</Popover.Viewport>
            </Popover.Popup>
          </Transition>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </template>
  <template v-else-if="family === 'Menu'">
    <Menu.Trigger id="trigger" :handle class="first-place-trigger">Trigger</Menu.Trigger>
    <Menu.Root :handle>
      <Menu.Portal>
        <Menu.Positioner data-testid="positioner" class="first-place-positioner">
          <Transition name="first-place">
            <Menu.Popup data-testid="popup" class="first-place-popup">
              <Menu.Viewport><Menu.Item>Item</Menu.Item></Menu.Viewport>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </template>
  <template v-else-if="family === 'Tooltip'">
    <Tooltip.Trigger id="trigger" :handle class="first-place-trigger">Trigger</Tooltip.Trigger>
    <Tooltip.Root :handle>
      <Tooltip.Portal>
        <Tooltip.Positioner data-testid="positioner" side="bottom" class="first-place-positioner">
          <Transition name="first-place">
            <Tooltip.Popup data-testid="popup" class="first-place-popup">
              <Tooltip.Viewport>Popup</Tooltip.Viewport>
            </Tooltip.Popup>
          </Transition>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </template>
  <template v-else>
    <PreviewCard.Trigger id="trigger" :handle href="#card" class="first-place-trigger">
      Trigger
    </PreviewCard.Trigger>
    <PreviewCard.Root :handle>
      <PreviewCard.Portal>
        <PreviewCard.Positioner data-testid="positioner" class="first-place-positioner">
          <Transition name="first-place" appear>
            <PreviewCard.Popup data-testid="popup" class="first-place-popup">
              <PreviewCard.Viewport>Popup</PreviewCard.Viewport>
            </PreviewCard.Popup>
          </Transition>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  </template>
</template>

<style>
.first-place-trigger {
  position: fixed;
  left: 100px;
  bottom: 10px;
}
.first-place-positioner {
  transition-property: top, left, right, bottom;
  transition-duration: 1s;
  transition-timing-function: linear;
}
.first-place-popup {
  width: 100px;
  height: 100px;
}
.first-place-kept {
  transition: opacity 1s linear;
}
.first-place-kept[hidden] {
  display: block;
  opacity: 0;
}
.first-place-enter-active {
  transition: transform 1s linear;
  animation: first-place-fade 1s linear;
}
@keyframes first-place-fade {
  from {
    opacity: 0;
  }
}
.first-place-enter-from[data-side='bottom'] {
  transform: translateY(-50px);
}
.first-place-enter-from[data-side='top'] {
  transform: translateY(50px);
}
</style>
