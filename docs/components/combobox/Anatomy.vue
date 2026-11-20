<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';
</script>

<template>
  <Combobox.Root>
    <Combobox.Label />

    <Combobox.InputGroup>
      <Combobox.Input />
      <Combobox.Trigger />
      <Combobox.Icon />
      <Combobox.Clear />
      <Combobox.Value />

      <Combobox.Chips>
        <Combobox.Chip>
          <Combobox.ChipRemove />
        </Combobox.Chip>
      </Combobox.Chips>
    </Combobox.InputGroup>

    <Combobox.Portal>
      <Combobox.Backdrop />
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.Arrow />

          <Combobox.Status />
          <Combobox.Empty />

          <Combobox.List>
            <Combobox.Row>
              <Combobox.Item v-slot="{ state }">
                <span v-if="state.selected">✓</span>
              </Combobox.Item>
            </Combobox.Row>

            <Combobox.Separator />

            <Combobox.Group>
              <Combobox.GroupLabel />
            </Combobox.Group>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
