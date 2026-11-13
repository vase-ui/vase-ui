<script setup lang="ts">
import { Popover } from '../index';

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
  </Popover.Root>
</template>
