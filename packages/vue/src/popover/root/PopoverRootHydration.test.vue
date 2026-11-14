<script setup lang="ts">
import * as Popover from '../index.parts';

const props = withDefaults(
  defineProps<{
    handle?: Popover.Handle<unknown> | undefined;
    defaultOpen?: boolean | undefined;
    defaultTriggerId?: string | undefined;
    // Adds a trigger with the id `detached` before the root. It uses the handle of the root.
    detached?: boolean | undefined;
  }>(),
  { handle: undefined, defaultOpen: false, defaultTriggerId: undefined, detached: false },
);

// A render with no `handle` prop makes its own handle, as an app does in `setup`.
const handle = props.handle ?? Popover.createHandle<unknown>();
</script>

<template>
  <Popover.Trigger v-if="detached" id="detached" :handle="handle">Detached</Popover.Trigger>
  <Popover.Root
    :handle="detached ? handle : undefined"
    :default-open="defaultOpen"
    :default-trigger-id="defaultTriggerId"
  >
    <Popover.Trigger id="inside">Inside</Popover.Trigger>
    <Popover.Portal>
      <Popover.Backdrop />
      <Popover.Positioner>
        <Popover.Popup data-testid="popup">
          <Popover.Arrow />
          <Popover.Title>Title</Popover.Title>
          <Popover.Description>Description</Popover.Description>
          <Popover.Close>Close</Popover.Close>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
