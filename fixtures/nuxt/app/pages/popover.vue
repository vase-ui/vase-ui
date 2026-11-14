<script setup lang="ts">
// No entry point exports a part of Popover yet, so the page imports them by their path.
import * as Popover from '../../../../packages/vue/src/popover/index.parts';

// The page makes the handle in `setup`, so a request does not share it with another request.
const handle = Popover.createHandle<string>();
</script>

<template>
  <main>
    <Popover.Root>
      <Popover.Trigger data-testid="closed">Closed</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="closed-popup">Closed popup</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <Popover.Root default-open default-trigger-id="open-trigger">
      <Popover.Trigger id="open-trigger" data-testid="open">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="open-popup">
            <Popover.Title>Open title</Popover.Title>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <Popover.Trigger id="detached-trigger" :handle="handle" data-testid="detached">
      Detached
    </Popover.Trigger>
    <Popover.Root :handle="handle">
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="detached-popup">Detached popup</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </main>
</template>
