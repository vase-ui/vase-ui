<script setup lang="ts">
import { Dialog } from '../../src/dialog';
import { NumberField } from '../../src/number-field';

// A dialog that is not modal, open at the mount, with a number field and its scrub area.
</script>

<template>
  <Dialog.Root default-open :modal="false">
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup" style="position: fixed; left: 200px; top: 100px">
        <NumberField.Root :default-value="100">
          <NumberField.ScrubArea data-testid="scrub">Amount</NumberField.ScrubArea>
          <NumberField.Input aria-label="Amount" />
        </NumberField.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
