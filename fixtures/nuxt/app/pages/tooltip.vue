<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

const handle = Tooltip.createHandle();
</script>

<template>
  <main>
    <Tooltip.Root>
      <Tooltip.Trigger data-testid="closed">closed</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="closed-popup">closed popup</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
    <!-- Tooltips with no provider share one delay group. The group closes an open tooltip when
    another one opens, so each open tooltip has a provider of its own. -->
    <Tooltip.Provider>
      <Tooltip.Root default-open default-trigger-id="open-trigger">
        <Tooltip.Trigger id="open-trigger" data-testid="open">open</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="open-popup">open popup</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger data-testid="kept">kept</Tooltip.Trigger>
      <Tooltip.Portal keep-mounted>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="kept-popup">kept popup</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
    <Tooltip.Provider>
      <Tooltip.Trigger id="detached-trigger" :handle="handle" data-testid="detached">
        detached
      </Tooltip.Trigger>
      <Tooltip.Root :handle="handle" default-open default-trigger-id="detached-trigger">
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="detached-popup">detached popup</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  </main>
</template>
