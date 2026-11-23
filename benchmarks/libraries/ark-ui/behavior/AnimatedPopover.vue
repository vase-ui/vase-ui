<script setup lang="ts">
import { Popover } from '@ark-ui/vue/popover';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Popover.Root>
      <Popover.Trigger data-bench="trigger">Open</Popover.Trigger>
      <Teleport to="body">
        <Popover.Positioner>
          <Popover.Content data-bench="popup">
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Title>Title</Popover.Title>
            <Popover.Description>Description</Popover.Description>
          </Popover.Content>
        </Popover.Positioner>
      </Teleport>
    </Popover.Root>
  </div>
</template>

<style>
[data-scope='popover'][data-part='content'] {
  transform-origin: var(--transform-origin);
}

[data-scope='popover'][data-part='content'][data-state='open'] {
  animation: bench-enter var(--bench-duration) linear;
}

[data-scope='popover'][data-part='content'][data-state='closed'] {
  animation: bench-exit var(--bench-duration) linear;
}
</style>
