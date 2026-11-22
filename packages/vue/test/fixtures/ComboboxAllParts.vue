<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// An open multiple combobox with each part. Each part has `data-part` with its name and the class
// `part`. `as` gives a part a tag. With `withSlot`, the parts that have no part inside them render a
// `<section>` (an `<input>` for the input) in their `element` slot.
const props = defineProps({
  as: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  withSlot: Boolean,
  /** The `to` of the portal. */
  to: String,
});

const parts: Record<string, { element: Element | null } | null> = {};
const setters = new Map<string, (part: unknown) => void>();
function refOf(name: string) {
  let setter = setters.get(name);
  if (!setter) {
    setter = (part) => {
      parts[name] = part as { element: Element | null } | null;
    };
    setters.set(name, setter);
  }
  return setter;
}
const as = (name: string) => props.as[name] as keyof HTMLElementTagNameMap | undefined;
defineExpose({ parts });
</script>

<template>
  <Combobox.Root
    :ref="refOf('Root')"
    :as="as('Root')"
    data-part="Root"
    class="part"
    :items="['a', 'b']"
    multiple
    default-open
    :default-value="['a']"
  >
    <template v-if="withSlot">
      <Combobox.Label :ref="refOf('Label')" data-part="Label" class="part">
        <template #element="{ props: elementProps, elementRef }">
          <section v-bind="elementProps" :ref="elementRef">Letter</section>
        </template>
      </Combobox.Label>
      <Combobox.InputGroup :ref="refOf('InputGroup')" data-part="InputGroup" class="part">
        <Combobox.Chips :ref="refOf('Chips')" data-part="Chips" class="part">
          <Combobox.Chip :ref="refOf('Chip')" data-part="Chip" class="part">
            <template #element="{ props: elementProps, elementRef }">
              <section v-bind="elementProps" :ref="elementRef">
                a
                <Combobox.ChipRemove :ref="refOf('ChipRemove')" data-part="ChipRemove" class="part">
                  <template #element="{ props: removeProps, elementRef: removeRef }">
                    <section v-bind="removeProps" :ref="removeRef">x</section>
                  </template>
                </Combobox.ChipRemove>
              </section>
            </template>
          </Combobox.Chip>
          <Combobox.Input :ref="refOf('Input')" data-part="Input" class="part">
            <template #element="{ props: elementProps, elementRef }">
              <input v-bind="elementProps" :ref="elementRef" />
            </template>
          </Combobox.Input>
        </Combobox.Chips>
        <Combobox.Clear :ref="refOf('Clear')" data-part="Clear" class="part">
          <template #element="{ props: elementProps, elementRef }">
            <section v-bind="elementProps" :ref="elementRef">x</section>
          </template>
        </Combobox.Clear>
        <Combobox.Trigger :ref="refOf('Trigger')" data-part="Trigger" class="part">
          <template #element="{ props: elementProps, elementRef }">
            <section v-bind="elementProps" :ref="elementRef">v</section>
          </template>
        </Combobox.Trigger>
      </Combobox.InputGroup>
    </template>
    <template v-else>
      <Combobox.Label :ref="refOf('Label')" :as="as('Label')" data-part="Label" class="part">
        Letter
      </Combobox.Label>
      <Combobox.InputGroup
        :ref="refOf('InputGroup')"
        :as="as('InputGroup')"
        data-part="InputGroup"
        class="part"
      >
        <Combobox.Chips :ref="refOf('Chips')" :as="as('Chips')" data-part="Chips" class="part">
          <Combobox.Chip :ref="refOf('Chip')" :as="as('Chip')" data-part="Chip" class="part">
            a
            <Combobox.ChipRemove
              :ref="refOf('ChipRemove')"
              :as="as('ChipRemove')"
              data-part="ChipRemove"
              class="part"
            />
          </Combobox.Chip>
          <Combobox.Input :ref="refOf('Input')" data-part="Input" class="part" />
        </Combobox.Chips>
        <Combobox.Clear :ref="refOf('Clear')" :as="as('Clear')" data-part="Clear" class="part" />
        <Combobox.Trigger
          :ref="refOf('Trigger')"
          :as="as('Trigger')"
          data-part="Trigger"
          class="part"
        />
      </Combobox.InputGroup>
    </template>
    <Combobox.Portal :to="to">
      <template v-if="withSlot">
        <Combobox.Backdrop :ref="refOf('Backdrop')" data-part="Backdrop" class="part">
          <template #element="{ props: elementProps, elementRef }">
            <section v-bind="elementProps" :ref="elementRef" />
          </template>
        </Combobox.Backdrop>
      </template>
      <Combobox.Backdrop
        v-else
        :ref="refOf('Backdrop')"
        :as="as('Backdrop')"
        data-part="Backdrop"
        class="part"
      />
      <Combobox.Positioner
        :ref="refOf('Positioner')"
        :as="as('Positioner')"
        data-part="Positioner"
        class="part"
      >
        <Combobox.Popup :ref="refOf('Popup')" :as="as('Popup')" data-part="Popup" class="part">
          <template v-if="withSlot">
            <Combobox.Arrow :ref="refOf('Arrow')" data-part="Arrow" class="part">
              <template #element="{ props: elementProps, elementRef }">
                <section v-bind="elementProps" :ref="elementRef" />
              </template>
            </Combobox.Arrow>
            <Combobox.Status :ref="refOf('Status')" data-part="Status" class="part">
              <template #element="{ props: elementProps, elementRef }">
                <section v-bind="elementProps" :ref="elementRef">Two letters.</section>
              </template>
            </Combobox.Status>
            <Combobox.Empty :ref="refOf('Empty')" data-part="Empty" class="part">
              <template #element="{ props: elementProps, elementRef }">
                <section v-bind="elementProps" :ref="elementRef" />
              </template>
            </Combobox.Empty>
          </template>
          <template v-else>
            <Combobox.Arrow
              :ref="refOf('Arrow')"
              :as="as('Arrow')"
              data-part="Arrow"
              class="part"
            />
            <Combobox.Status
              :ref="refOf('Status')"
              :as="as('Status')"
              data-part="Status"
              class="part"
            >
              Two letters.
            </Combobox.Status>
            <Combobox.Empty :ref="refOf('Empty')" :as="as('Empty')" data-part="Empty" class="part">
              No letter.
            </Combobox.Empty>
          </template>
          <Combobox.List :ref="refOf('List')" :as="as('List')" data-part="List" class="part">
            <Combobox.Group :ref="refOf('Group')" :as="as('Group')" data-part="Group" class="part">
              <template v-if="withSlot">
                <Combobox.GroupLabel :ref="refOf('GroupLabel')" data-part="GroupLabel" class="part">
                  <template #element="{ props: elementProps, elementRef }">
                    <section v-bind="elementProps" :ref="elementRef">Letters</section>
                  </template>
                </Combobox.GroupLabel>
                <Combobox.Item :ref="refOf('Item')" value="a" data-part="Item" class="part">
                  <template #element="{ props: elementProps, elementRef }">
                    <section v-bind="elementProps" :ref="elementRef">a</section>
                  </template>
                </Combobox.Item>
              </template>
              <template v-else>
                <Combobox.GroupLabel
                  :ref="refOf('GroupLabel')"
                  :as="as('GroupLabel')"
                  data-part="GroupLabel"
                  class="part"
                >
                  Letters
                </Combobox.GroupLabel>
                <Combobox.Item
                  :ref="refOf('Item')"
                  :as="as('Item')"
                  value="a"
                  data-part="Item"
                  class="part"
                >
                  a
                </Combobox.Item>
              </template>
            </Combobox.Group>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <div id="portal-target" />
</template>
