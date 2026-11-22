<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Combobox } from '../../src/combobox';

type Props = Record<string, unknown>;

// A combobox of fruits. The input is in a group with a clear button and a trigger, or the trigger
// is the control and the input is in a group in the popup. A text input stands before the root,
// and a button at the bottom right of the view after it.
defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<unknown[]>, default: () => FRUITS },
  /** The trigger is the control, and the input is in the popup. */
  inputInPopup: Boolean,
  /** A trigger beside the input. */
  trigger: Boolean,
  /** A trigger before the group of the input. */
  triggerFirst: Boolean,
  /** A clear button with these props: in the group of the input, else after the trigger. */
  clear: Object as PropType<Props>,
  /** The clear button of `clear` is in the popup, after its input. */
  clearInPopup: Boolean,
  label: Boolean,
  input: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  list: Object as PropType<Props>,
  empty: Boolean,
  status: Boolean,
  /** A button in the popup. */
  button: Boolean,
  /** A separator after the list, with these props. */
  separator: Object as PropType<Props>,
  /** `scene.popup` set to `false` unmounts the popup, and `scene.trigger` the trigger of `trigger`. */
  scene: { type: Object as PropType<{ popup?: boolean; trigger?: boolean }>, default: () => ({}) },
  /** The items render the label of an object, as `{ value, label }`. */
  labels: Boolean,
  /** The items are groups `{ name, items }`. */
  grouped: Boolean,
  /** Props of each item, by its name. */
  itemProps: Object as PropType<Record<string, Props>>,
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });
</script>

<script lang="ts">
export const FRUITS = [
  'Apple',
  'Apricot',
  'Banana',
  'Cherry',
  'Grape',
  'Lemon',
  'Mango',
  'Orange',
  'Peach',
  'Pear',
];
</script>

<template>
  <input id="before" aria-label="Before" />
  <Combobox.Root ref="rootPart" :items="items" v-bind="root">
    <Combobox.Label v-if="label" data-testid="label">Fruit</Combobox.Label>
    <Combobox.Trigger v-if="triggerFirst" data-testid="trigger">Open</Combobox.Trigger>
    <Combobox.Trigger v-if="inputInPopup" data-testid="trigger">
      <Combobox.Value placeholder="Pick a fruit" />
    </Combobox.Trigger>
    <Combobox.InputGroup v-else data-testid="group">
      <Combobox.Input data-testid="input" v-bind="input" />
      <Combobox.Clear v-if="clear" data-testid="clear" v-bind="clear" />
      <Combobox.Trigger v-if="trigger && scene.trigger !== false" data-testid="trigger">
        Open
      </Combobox.Trigger>
    </Combobox.InputGroup>
    <Combobox.Clear
      v-if="inputInPopup && clear && !clearInPopup"
      data-testid="clear"
      v-bind="clear"
    />
    <Combobox.Portal v-bind="portal">
      <Combobox.Positioner data-testid="positioner" v-bind="positioner">
        <Combobox.Popup v-if="scene.popup !== false" data-testid="popup" v-bind="popup">
          <Combobox.InputGroup v-if="inputInPopup" data-testid="popup-group">
            <Combobox.Input data-testid="input" v-bind="input" />
          </Combobox.InputGroup>
          <Combobox.Clear
            v-if="inputInPopup && clear && clearInPopup"
            data-testid="clear"
            v-bind="clear"
          />
          <Combobox.Status v-if="status" data-testid="status">Ten fruits.</Combobox.Status>
          <Combobox.Empty v-if="empty" data-testid="empty">No fruit.</Combobox.Empty>
          <Combobox.List data-testid="list" v-bind="list">
            <template #item="{ item: group }">
              <Combobox.Group v-if="grouped" :data-testid="`group-${(group as any).name}`">
                <Combobox.GroupLabel>{{ (group as any).name }}</Combobox.GroupLabel>
                <Combobox.Item
                  v-for="item in (group as any).items"
                  :key="item"
                  :value="item"
                  :data-testid="`item-${item}`"
                  v-bind="itemProps?.[item]"
                >
                  {{ item }}
                </Combobox.Item>
              </Combobox.Group>
              <Combobox.Item
                v-else
                :value="group"
                :data-testid="`item-${labels ? (group as any).label : group}`"
                v-bind="itemProps?.[labels ? (group as any).label : (group as string)]"
              >
                {{ labels ? (group as any).label : group }}
              </Combobox.Item>
            </template>
          </Combobox.List>
          <Combobox.Separator v-if="separator" data-testid="separator" v-bind="separator" />
          <button v-if="button" data-testid="popup-button">In the popup</button>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
