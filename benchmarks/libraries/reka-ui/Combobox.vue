<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxCancel,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  Label,
} from 'reka-ui';
import { useId } from 'vue';
import { options } from '../../harness/options.ts';

// The props of ComboboxInput omit `id`, so the template gives it in an object of attributes.
// The Reka UI docs tell you to set `position="popper"` on a ComboboxContent in a ComboboxPortal.
const id = useId();
</script>

<template>
  <ComboboxRoot>
    <Label :for="id">Label</Label>
    <ComboboxAnchor>
      <ComboboxInput v-bind="{ id }" data-bench="input" />
      <ComboboxTrigger data-bench="trigger">Open</ComboboxTrigger>
      <ComboboxCancel>Clear</ComboboxCancel>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent position="popper" data-bench="popup">
        <ComboboxViewport>
          <ComboboxEmpty>No results</ComboboxEmpty>
          <ComboboxItem v-for="option in options" :key="option" :value="option">
            {{ option }}
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
