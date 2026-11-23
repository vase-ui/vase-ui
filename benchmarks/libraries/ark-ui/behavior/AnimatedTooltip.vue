<script setup lang="ts">
import { Tooltip } from '@ark-ui/vue/tooltip';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Tooltip.Root :open-delay="0" :close-delay="0">
      <Tooltip.Trigger data-bench="trigger">Open</Tooltip.Trigger>
      <Teleport to="body">
        <Tooltip.Positioner>
          <Tooltip.Content data-bench="popup">
            <Tooltip.Arrow>
              <Tooltip.ArrowTip />
            </Tooltip.Arrow>
            Tooltip
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Teleport>
    </Tooltip.Root>
  </div>
</template>

<style>
[data-scope='tooltip'][data-part='content'] {
  transform-origin: var(--transform-origin);
}

[data-scope='tooltip'][data-part='content'][data-state='open'] {
  animation: bench-enter var(--bench-duration) linear;
}

[data-scope='tooltip'][data-part='content'][data-state='closed'] {
  animation: bench-exit var(--bench-duration) linear;
}
</style>
