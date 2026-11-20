<script setup lang="ts">
import { shallowRef, type PropType } from 'vue';
import { Popover } from '../../src/popover';
import { Toolbar } from '../../src/toolbar';

// A popover whose trigger is an item of a toolbar. With `portalInToolbar`, the portal puts the
// popup in the element of the toolbar.
defineProps({
  content: { type: String as PropType<'button' | 'input'>, default: 'button' },
  defaultOpen: Boolean,
  portalInToolbar: Boolean,
});

const container = shallowRef<HTMLElement | null>(null);

function setContainer(element: unknown) {
  container.value = element as HTMLElement | null;
}
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Button>First</Toolbar.Button>
    <Popover.Root :default-open="defaultOpen">
      <Toolbar.Button>
        <template #element="{ props, elementRef }">
          <Popover.Trigger v-bind="props" :ref="elementRef">Open</Popover.Trigger>
        </template>
      </Toolbar.Button>
      <Popover.Portal :to="portalInToolbar ? container : undefined">
        <Popover.Positioner>
          <Popover.Popup data-testid="popup">
            <input v-if="content === 'input'" value="ab" aria-label="Text" />
            <button v-else type="button">Inside</button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <Toolbar.Button>Last</Toolbar.Button>
    <div :ref="setContainer" />
  </Toolbar.Root>
</template>
