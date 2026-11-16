<script setup lang="ts">
import * as DatePicker from '../../../date-picker/index.parts';
import PickerFocusTargetButton from './PickerFocusTargetButton.test.vue';

// The popup stays mounted, so a part can mount while the popup is closed. The plain button is the
// first tabbable element: the focus goes there when no target gives an element.
withDefaults(defineProps<{ hasFirst?: boolean; firstGives?: boolean; ask?: () => void }>(), {
  hasFirst: true,
  firstGives: true,
  ask: undefined,
});
</script>

<template>
  <DatePicker.Root>
    <DatePicker.Trigger data-testid="trigger">Open</DatePicker.Trigger>
    <DatePicker.Portal keep-mounted>
      <DatePicker.Positioner>
        <DatePicker.Popup aria-label="Choose date">
          <button type="button" data-testid="plain">Plain</button>
          <PickerFocusTargetButton
            v-if="hasFirst"
            :gives="firstGives"
            :ask="ask"
            data-testid="first"
          >
            First
          </PickerFocusTargetButton>
          <PickerFocusTargetButton data-testid="second">Second</PickerFocusTargetButton>
        </DatePicker.Popup>
      </DatePicker.Positioner>
    </DatePicker.Portal>
  </DatePicker.Root>
</template>
