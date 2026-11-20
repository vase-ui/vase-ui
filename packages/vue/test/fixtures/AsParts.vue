<script setup lang="ts">
import { provide, type Component, type PropType } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  RouterLink,
  routeLocationKey,
  routerKey,
} from 'vue-router';
import { Avatar } from '../../src/avatar';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Field } from '../../src/field';
import { Fieldset } from '../../src/fieldset';
import { Meter } from '../../src/meter';
import { Progress } from '../../src/progress';
import { RadioGroup } from '../../src/radio-group';
import { ScrollArea } from '../../src/scroll-area';
import { Separator } from '../../src/separator';
import { Tabs } from '../../src/tabs';
import ExposedInner from './ExposedInner.vue';
import LateElement from './LateElement.vue';
import VaporTargetWithElement from './VaporTargetWithElement.vue';

// Each part has `data-part` with its name. `as` gives a part a tag or the name of a component of
// `components`, and `attributes` gives it attributes. The parts `slot-wins` have `as` and an
// `element` slot.
const props = defineProps({
  as: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  attributes: {
    type: Object as PropType<Record<string, Record<string, unknown>>>,
    default: () => ({}),
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { render: () => null } }],
});
provide(routerKey, router);
provide(routeLocationKey, router.currentRoute.value);

const components: Record<string, Component> = {
  RouterLink,
  ExposedInner,
  LateElement,
  Vapor: VaporTargetWithElement,
};
const parts: Record<string, { element: Element | null }> = {};
const setters = new Map<string, (part: unknown) => void>();
defineExpose({ parts });

function is(name: string) {
  const given = props.as[name];
  return (given === undefined ? undefined : (components[given] ?? given)) as
    keyof HTMLElementTagNameMap | undefined;
}

function attrs(name: string) {
  return {
    'data-part': name,
    ...(props.as[name] === 'RouterLink' && { to: '/' }),
    ...props.attributes[name],
  };
}

function setter(name: string) {
  let set = setters.get(name);
  if (!set) {
    set = (part) => {
      parts[name] = part as { element: Element | null };
    };
    setters.set(name, set);
  }
  return set;
}
</script>

<template>
  <Avatar.Root :as="is('Avatar.Root')" v-bind="attrs('Avatar.Root')" :ref="setter('Avatar.Root')">
    <Avatar.Fallback
      :as="is('Avatar.Fallback')"
      v-bind="attrs('Avatar.Fallback')"
      :ref="setter('Avatar.Fallback')"
      >JD</Avatar.Fallback
    >
  </Avatar.Root>
  <CheckboxGroup
    :as="is('CheckboxGroup')"
    v-bind="attrs('CheckboxGroup')"
    :ref="setter('CheckboxGroup')"
    aria-label="Toppings"
  />
  <RadioGroup
    :as="is('RadioGroup')"
    v-bind="attrs('RadioGroup')"
    :ref="setter('RadioGroup')"
    aria-label="Size"
  />
  <Field.Root
    :as="is('Field.Root')"
    v-bind="attrs('Field.Root')"
    :ref="setter('Field.Root')"
    invalid
  >
    <Field.Description
      :as="is('Field.Description')"
      v-bind="attrs('Field.Description')"
      :ref="setter('Field.Description')"
      >Description</Field.Description
    >
    <Field.Error :as="is('Field.Error')" v-bind="attrs('Field.Error')" :ref="setter('Field.Error')"
      >Error</Field.Error
    >
    <Field.Item :as="is('Field.Item')" v-bind="attrs('Field.Item')" :ref="setter('Field.Item')"
      >Item</Field.Item
    >
  </Field.Root>
  <Fieldset.Root>
    <Fieldset.Legend
      :as="is('Fieldset.Legend')"
      v-bind="attrs('Fieldset.Legend')"
      :ref="setter('Fieldset.Legend')"
      >Legend</Fieldset.Legend
    >
  </Fieldset.Root>
  <Meter.Root
    :as="is('Meter.Root')"
    v-bind="attrs('Meter.Root')"
    :ref="setter('Meter.Root')"
    :value="40"
  >
    <Meter.Label :as="is('Meter.Label')" v-bind="attrs('Meter.Label')" :ref="setter('Meter.Label')"
      >Battery</Meter.Label
    >
    <Meter.Value
      :as="is('Meter.Value')"
      v-bind="attrs('Meter.Value')"
      :ref="setter('Meter.Value')"
    />
    <Meter.Track :as="is('Meter.Track')" v-bind="attrs('Meter.Track')" :ref="setter('Meter.Track')">
      <Meter.Indicator
        :as="is('Meter.Indicator')"
        v-bind="attrs('Meter.Indicator')"
        :ref="setter('Meter.Indicator')"
      />
    </Meter.Track>
  </Meter.Root>
  <Progress.Root
    :as="is('Progress.Root')"
    v-bind="attrs('Progress.Root')"
    :ref="setter('Progress.Root')"
    :value="40"
  >
    <Progress.Label
      :as="is('Progress.Label')"
      v-bind="attrs('Progress.Label')"
      :ref="setter('Progress.Label')"
      >Upload</Progress.Label
    >
    <Progress.Value
      :as="is('Progress.Value')"
      v-bind="attrs('Progress.Value')"
      :ref="setter('Progress.Value')"
    />
    <Progress.Track
      :as="is('Progress.Track')"
      v-bind="attrs('Progress.Track')"
      :ref="setter('Progress.Track')"
    >
      <Progress.Indicator
        :as="is('Progress.Indicator')"
        v-bind="attrs('Progress.Indicator')"
        :ref="setter('Progress.Indicator')"
      />
    </Progress.Track>
  </Progress.Root>
  <ScrollArea.Root
    :as="is('ScrollArea.Root')"
    v-bind="attrs('ScrollArea.Root')"
    :ref="setter('ScrollArea.Root')"
    style="position: relative; width: 100px; height: 100px"
  >
    <ScrollArea.Viewport
      :as="is('ScrollArea.Viewport')"
      v-bind="attrs('ScrollArea.Viewport')"
      :ref="setter('ScrollArea.Viewport')"
      style="width: 100%; height: 100%"
    >
      <ScrollArea.Content
        :as="is('ScrollArea.Content')"
        v-bind="attrs('ScrollArea.Content')"
        :ref="setter('ScrollArea.Content')"
      >
        <div style="width: 1000px; height: 1000px" />
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar
      :as="is('ScrollArea.Scrollbar')"
      v-bind="attrs('ScrollArea.Scrollbar')"
      :ref="setter('ScrollArea.Scrollbar')"
      keep-mounted
    >
      <ScrollArea.Thumb
        :as="is('ScrollArea.Thumb')"
        v-bind="attrs('ScrollArea.Thumb')"
        :ref="setter('ScrollArea.Thumb')"
      />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner
      :as="is('ScrollArea.Corner')"
      v-bind="attrs('ScrollArea.Corner')"
      :ref="setter('ScrollArea.Corner')"
    />
  </ScrollArea.Root>
  <Separator :as="is('Separator')" v-bind="attrs('Separator')" :ref="setter('Separator')" />
  <Separator as="section" data-part="slot-wins">
    <template #element="{ props: elementProps, elementRef }">
      <span v-bind="elementProps" :ref="elementRef" />
    </template>
  </Separator>
  <Tabs.Root
    :as="is('Tabs.Root')"
    v-bind="attrs('Tabs.Root')"
    :ref="setter('Tabs.Root')"
    default-value="a"
  >
    <Tabs.List :as="is('Tabs.List')" v-bind="attrs('Tabs.List')" :ref="setter('Tabs.List')">
      <Tabs.Tab :as="is('Tabs.Tab')" v-bind="attrs('Tabs.Tab')" :ref="setter('Tabs.Tab')" value="a"
        >A</Tabs.Tab
      >
      <Tabs.Tab as="div" data-part="slot-wins" value="b">
        <template #element="{ props: elementProps, elementRef }">
          <button v-bind="elementProps" :ref="elementRef">B</button>
        </template>
      </Tabs.Tab>
      <Tabs.Indicator
        :as="is('Tabs.Indicator')"
        v-bind="attrs('Tabs.Indicator')"
        :ref="setter('Tabs.Indicator')"
      />
    </Tabs.List>
    <Tabs.Panel
      :as="is('Tabs.Panel')"
      v-bind="attrs('Tabs.Panel')"
      :ref="setter('Tabs.Panel')"
      value="a"
      >Panel</Tabs.Panel
    >
  </Tabs.Root>
</template>
