<script setup lang="ts">
// No entry point of the package exports Select yet, so the page imports its source. The field comes
// from the source too: a part of the built package and a part of the source do not share a context.
import * as Field from '../../../../packages/vue/src/field/index.parts';
import * as Select from '../../../../packages/vue/src/select/index.parts';

const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
const TAGS = ['a', 'b', 'c'];
</script>

<template>
  <main>
    <form data-testid="form">
      <Select.Root id="font" name="font" :items="FONTS" default-value="serif">
        <Select.Trigger data-testid="font-trigger">
          <Select.Value data-testid="font-value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="font-popup">
              <Select.Item v-for="(label, value) in FONTS" :key="value" :value="value">
                <Select.ItemText>{{ label }}</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Field.Root name="size">
        <Select.Root>
          <Select.Trigger data-testid="size-trigger">
            <Select.Value placeholder="Size" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="small">Small</Select.Item>
                <Select.Item value="large">Large</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Field.Label data-testid="size-label">Size</Field.Label>
      </Field.Root>
      <Select.Root name="tags" multiple :default-value="['b']">
        <Select.Trigger data-testid="tags-trigger">
          <Select.Value data-testid="tags-value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item v-for="tag in TAGS" :key="tag" :value="tag">{{ tag }}</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </form>
  </main>
</template>
