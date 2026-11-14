<script setup lang="ts">
import { Autocomplete } from '@vase-ui/vue/autocomplete';
</script>

<template>
  <Autocomplete.Root>
    <Autocomplete.InputGroup>
      <Autocomplete.Input />
      <Autocomplete.Trigger />
      <Autocomplete.Icon />
      <Autocomplete.Clear />
      <Autocomplete.Value />
    </Autocomplete.InputGroup>

    <Autocomplete.Portal>
      <Autocomplete.Backdrop />
      <Autocomplete.Positioner>
        <Autocomplete.Popup>
          <Autocomplete.Arrow />

          <Autocomplete.Status />
          <Autocomplete.Empty />

          <Autocomplete.List>
            <Autocomplete.Row>
              <Autocomplete.Item />
            </Autocomplete.Row>

            <Autocomplete.Separator />

            <Autocomplete.Group>
              <Autocomplete.GroupLabel />
            </Autocomplete.Group>

            <Autocomplete.Collection />
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
