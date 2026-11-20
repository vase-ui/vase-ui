<script setup lang="ts">
import { Dialog } from '../../src/dialog';
import { Select } from '../../src/select';
</script>

<!-- An open modal dialog with a disabled portal, and an open select in its popup. -->
<template>
  <Dialog.Root default-open>
    <Dialog.Portal disabled>
      <Dialog.Popup data-testid="popup">
        <Select.Root default-open>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner :align-item-with-trigger="false">
              <Select.Popup data-testid="select-popup">
                <Select.Item value="a" data-testid="option">A</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
