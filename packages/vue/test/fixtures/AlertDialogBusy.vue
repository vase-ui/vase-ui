<script setup lang="ts">
import type { PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Button } from '../../src/button';
import ButtonFocusableAfterMount from './ButtonFocusableAfterMount.vue';

// A busy alert dialog. Its Cancel is a `ButtonFocusableAfterMount`, and its Remove button is
// disabled and focusable from its first render.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  portal: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <AlertDialog.Root v-bind="root">
    <AlertDialog.Trigger data-testid="trigger">Remove the file</AlertDialog.Trigger>
    <AlertDialog.Portal v-bind="portal">
      <AlertDialog.Popup data-testid="popup">
        <AlertDialog.Title>Remove the file?</AlertDialog.Title>
        <AlertDialog.Close>
          <template #element="{ props, elementRef }">
            <ButtonFocusableAfterMount v-bind="props" :ref="elementRef" data-testid="cancel">
              Cancel
            </ButtonFocusableAfterMount>
          </template>
        </AlertDialog.Close>
        <Button data-testid="remove" disabled focusable-when-disabled>Remove</Button>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
