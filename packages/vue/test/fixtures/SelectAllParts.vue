<script setup lang="ts">
import type { PropType } from 'vue';
import { Select } from '../../src/select';

// An open select with each part. Each part has `data-part` with its name and the class `part`.
// `as` gives a part a tag. With `withSlot`, the parts that have no part inside them render a
// `<section>` in their `element` slot.
const props = defineProps({
  as: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  withSlot: Boolean,
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
  <Select.Root
    :ref="refOf('Root')"
    :as="as('Root')"
    data-part="Root"
    class="part"
    default-open
    :modal="false"
    default-value="a"
  >
    <template v-if="withSlot">
      <Select.Label :ref="refOf('Label')" data-part="Label" class="part">
        <template #element="{ props: elementProps, elementRef }">
          <section v-bind="elementProps" :ref="elementRef">Letter</section>
        </template>
      </Select.Label>
    </template>
    <Select.Label v-else :ref="refOf('Label')" :as="as('Label')" data-part="Label" class="part"
      >Letter</Select.Label
    >
    <Select.Trigger :ref="refOf('Trigger')" :as="as('Trigger')" data-part="Trigger" class="part">
      <template v-if="withSlot">
        <Select.Value :ref="refOf('Value')" data-part="Value" class="part">
          <template #element="{ props: elementProps, elementRef }">
            <section v-bind="elementProps" :ref="elementRef">a</section>
          </template>
        </Select.Value>
        <Select.Icon :ref="refOf('Icon')" data-part="Icon" class="part">
          <template #element="{ props: elementProps, elementRef }">
            <section v-bind="elementProps" :ref="elementRef" />
          </template>
        </Select.Icon>
      </template>
      <template v-else>
        <Select.Value :ref="refOf('Value')" :as="as('Value')" data-part="Value" class="part" />
        <Select.Icon :ref="refOf('Icon')" :as="as('Icon')" data-part="Icon" class="part" />
      </template>
    </Select.Trigger>
    <Select.Portal>
      <Select.Backdrop v-if="withSlot" :ref="refOf('Backdrop')" data-part="Backdrop" class="part">
        <template #element="{ props: elementProps, elementRef }">
          <section v-bind="elementProps" :ref="elementRef" />
        </template>
      </Select.Backdrop>
      <Select.Backdrop
        v-else
        :ref="refOf('Backdrop')"
        :as="as('Backdrop')"
        data-part="Backdrop"
        class="part"
      />
      <Select.Positioner
        :ref="refOf('Positioner')"
        :as="as('Positioner')"
        :align-item-with-trigger="false"
        data-part="Positioner"
        class="part"
      >
        <Select.Popup :ref="refOf('Popup')" :as="as('Popup')" data-part="Popup" class="part">
          <template v-if="withSlot">
            <Select.Arrow :ref="refOf('Arrow')" data-part="Arrow" class="part">
              <template #element="{ props: elementProps, elementRef }">
                <section v-bind="elementProps" :ref="elementRef" />
              </template>
            </Select.Arrow>
            <Select.ScrollUpArrow
              :ref="refOf('ScrollUpArrow')"
              keep-mounted
              data-part="ScrollUpArrow"
              class="part"
            >
              <template #element="{ props: elementProps, elementRef }">
                <section v-bind="elementProps" :ref="elementRef" />
              </template>
            </Select.ScrollUpArrow>
          </template>
          <template v-else>
            <Select.Arrow :ref="refOf('Arrow')" :as="as('Arrow')" data-part="Arrow" class="part" />
            <Select.ScrollUpArrow
              :ref="refOf('ScrollUpArrow')"
              :as="as('ScrollUpArrow')"
              keep-mounted
              data-part="ScrollUpArrow"
              class="part"
            />
          </template>
          <Select.List :ref="refOf('List')" :as="as('List')" data-part="List" class="part">
            <Select.Group :ref="refOf('Group')" :as="as('Group')" data-part="Group" class="part">
              <template v-if="withSlot">
                <Select.GroupLabel :ref="refOf('GroupLabel')" data-part="GroupLabel" class="part">
                  <template #element="{ props: elementProps, elementRef }">
                    <section v-bind="elementProps" :ref="elementRef">Letters</section>
                  </template>
                </Select.GroupLabel>
                <Select.Item :ref="refOf('Item')" value="a" data-part="Item" class="part">
                  <template #element="{ props: elementProps, elementRef }">
                    <section v-bind="elementProps" :ref="elementRef">
                      <Select.ItemText :ref="refOf('ItemText')" data-part="ItemText" class="part">
                        <template #element="{ props: textProps, elementRef: textRef }">
                          <section v-bind="textProps" :ref="textRef">A</section>
                        </template>
                      </Select.ItemText>
                    </section>
                  </template>
                </Select.Item>
              </template>
              <template v-else>
                <Select.GroupLabel
                  :ref="refOf('GroupLabel')"
                  :as="as('GroupLabel')"
                  data-part="GroupLabel"
                  class="part"
                  >Letters</Select.GroupLabel
                >
                <Select.Item
                  :ref="refOf('Item')"
                  :as="as('Item')"
                  value="a"
                  data-part="Item"
                  class="part"
                >
                  <Select.ItemText
                    :ref="refOf('ItemText')"
                    :as="as('ItemText')"
                    data-part="ItemText"
                    class="part"
                    >A</Select.ItemText
                  >
                </Select.Item>
              </template>
            </Select.Group>
          </Select.List>
          <template v-if="withSlot">
            <Select.Separator :ref="refOf('Separator')" data-part="Separator" class="part">
              <template #element="{ props: elementProps, elementRef }">
                <section v-bind="elementProps" :ref="elementRef" />
              </template>
            </Select.Separator>
            <Select.ScrollDownArrow
              :ref="refOf('ScrollDownArrow')"
              keep-mounted
              data-part="ScrollDownArrow"
              class="part"
            >
              <template #element="{ props: elementProps, elementRef }">
                <section v-bind="elementProps" :ref="elementRef" />
              </template>
            </Select.ScrollDownArrow>
          </template>
          <template v-else>
            <Select.Separator
              :ref="refOf('Separator')"
              :as="as('Separator')"
              data-part="Separator"
              class="part"
            />
            <Select.ScrollDownArrow
              :ref="refOf('ScrollDownArrow')"
              :as="as('ScrollDownArrow')"
              keep-mounted
              data-part="ScrollDownArrow"
              class="part"
            />
          </template>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
