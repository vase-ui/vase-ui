<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger class="trigger">Notifications</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner :side-offset="8">
        <Popover.Popup class="popup">
          <Popover.Arrow class="arrow" />
          <Popover.Title class="title">Notifications</Popover.Title>
          <Popover.Description class="description">You are all caught up.</Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>

<style scoped>
.trigger {
  height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid currentColor;
  background-color: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.875rem;
}

.trigger[aria-expanded='true'] {
  background-color: color-mix(in srgb, currentColor 10%, transparent);
}

.trigger:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.popup {
  --background: white;
  width: 15rem;
  padding: 0.75rem;
  border: 1px solid;
  background-color: var(--background);
  color: black;

  @media (prefers-color-scheme: dark) {
    --background: black;
    color: white;
  }
}

.arrow {
  width: 12px;
  height: 6px;
  overflow: clip;

  &[data-side='top'] {
    bottom: -6px;
    rotate: 180deg;
  }

  &[data-side='bottom'] {
    top: -6px;
  }

  &[data-side='left'] {
    right: -9px;
    rotate: 90deg;
  }

  &[data-side='right'] {
    left: -9px;
    rotate: -90deg;
  }

  &::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    box-sizing: border-box;
    width: 8.5px;
    height: 8.5px;
    border: 1px solid;
    background-color: var(--background);
    transform: translate(-50%, 50%) rotate(45deg);
  }
}

.title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
}

.description {
  margin: 0;
  font-size: 0.875rem;
}
</style>
