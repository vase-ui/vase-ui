<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Field } from '../../src/field';
import { Fieldset } from '../../src/fieldset';

type Props = Record<string, unknown>;

// A combobox of fruits in a native form, in a `Field` with an error when `field` is given, and in a
// disabled `Fieldset.Root` with `disabledFieldset`. With `inputInPopup`, the trigger is the control.
defineProps({
  root: Object as PropType<Props>,
  field: Object as PropType<Props>,
  disabledFieldset: Boolean,
  inputInPopup: Boolean,
  onSubmit: Function as PropType<(event: Event) => void>,
});
const FRUITS = ['Apple', 'Banana', 'Cherry'];
</script>

<template>
  <form data-testid="form" @submit="onSubmit?.($event)">
    <Fieldset.Root :disabled="disabledFieldset">
      <component :is="field ? Field.Root : 'div'" v-bind="field">
        <Combobox.Root :items="FRUITS" v-bind="root">
          <Combobox.Trigger v-if="inputInPopup" data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Input v-else data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup">
                <Combobox.Input v-if="inputInPopup" data-testid="input" />
                <Combobox.List>
                  <template #item="{ item }">
                    <Combobox.Item :value="item" :data-testid="`item-${item}`">
                      {{ item }}
                    </Combobox.Item>
                  </template>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        <Field.Error v-if="field" data-testid="error" />
      </component>
    </Fieldset.Root>
    <button data-testid="submit">Submit</button>
    <button type="reset" data-testid="reset">Reset</button>
  </form>
  <button id="outside">Outside</button>
</template>
