<script setup lang="ts">
import { provide, type Component, type PropType } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  RouterLink,
  routeLocationKey,
  routerKey,
} from 'vue-router';
import { Accordion } from '../../src/accordion';
import { Avatar } from '../../src/avatar';
import { Button } from '../../src/button';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Collapsible } from '../../src/collapsible';
import { Field } from '../../src/field';
import { Fieldset } from '../../src/fieldset';
import { Meter } from '../../src/meter';
import { NumberField } from '../../src/number-field';
import { OTPField } from '../../src/otp-field';
import { Progress } from '../../src/progress';
import { RadioGroup } from '../../src/radio-group';
import { Resizable } from '../../src/resizable';
import { ScrollArea } from '../../src/scroll-area';
import { Separator } from '../../src/separator';
import { Slider } from '../../src/slider';
import { Tabs } from '../../src/tabs';
import { Toggle } from '../../src/toggle';
import { ToggleGroup } from '../../src/toggle-group';
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
  <Button :as="is('Button')" v-bind="attrs('Button')" :ref="setter('Button')">Save</Button>
  <Button as="div" data-part="slot-wins">
    <template #element="{ props: elementProps, elementRef }">
      <button v-bind="elementProps" :ref="elementRef">Send</button>
    </template>
  </Button>
  <Collapsible.Root
    :as="is('Collapsible.Root')"
    v-bind="attrs('Collapsible.Root')"
    :ref="setter('Collapsible.Root')"
    default-open
  >
    <Collapsible.Trigger
      :as="is('Collapsible.Trigger')"
      v-bind="attrs('Collapsible.Trigger')"
      :ref="setter('Collapsible.Trigger')"
      >Details</Collapsible.Trigger
    >
    <Collapsible.Panel
      :as="is('Collapsible.Panel')"
      v-bind="attrs('Collapsible.Panel')"
      :ref="setter('Collapsible.Panel')"
      >Panel</Collapsible.Panel
    >
  </Collapsible.Root>
  <Accordion.Root
    :as="is('Accordion.Root')"
    v-bind="attrs('Accordion.Root')"
    :ref="setter('Accordion.Root')"
    :default-value="['a']"
  >
    <Accordion.Item
      :as="is('Accordion.Item')"
      v-bind="attrs('Accordion.Item')"
      :ref="setter('Accordion.Item')"
      value="a"
    >
      <Accordion.Header
        :as="is('Accordion.Header')"
        v-bind="attrs('Accordion.Header')"
        :ref="setter('Accordion.Header')"
      >
        <Accordion.Trigger
          :as="is('Accordion.Trigger')"
          v-bind="attrs('Accordion.Trigger')"
          :ref="setter('Accordion.Trigger')"
          >Item</Accordion.Trigger
        >
      </Accordion.Header>
      <Accordion.Panel
        :as="is('Accordion.Panel')"
        v-bind="attrs('Accordion.Panel')"
        :ref="setter('Accordion.Panel')"
        >Panel</Accordion.Panel
      >
    </Accordion.Item>
  </Accordion.Root>
  <Toggle :as="is('Toggle')" v-bind="attrs('Toggle')" :ref="setter('Toggle')">Bold</Toggle>
  <ToggleGroup
    :as="is('ToggleGroup')"
    v-bind="attrs('ToggleGroup')"
    :ref="setter('ToggleGroup')"
    aria-label="Format"
  />
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
  <Slider.Root
    :as="is('Slider.Root')"
    v-bind="attrs('Slider.Root')"
    :ref="setter('Slider.Root')"
    :default-value="40"
  >
    <Slider.Control
      :as="is('Slider.Control')"
      v-bind="attrs('Slider.Control')"
      :ref="setter('Slider.Control')"
      style="width: 100px"
    >
      <Slider.Track
        :as="is('Slider.Track')"
        v-bind="attrs('Slider.Track')"
        :ref="setter('Slider.Track')"
      >
        <Slider.Indicator
          :as="is('Slider.Indicator')"
          v-bind="attrs('Slider.Indicator')"
          :ref="setter('Slider.Indicator')"
        />
        <Slider.Thumb
          :as="is('Slider.Thumb')"
          v-bind="attrs('Slider.Thumb')"
          :ref="setter('Slider.Thumb')"
          aria-label="Volume"
        />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
  <Slider.Root :default-value="10">
    <Slider.Control as="section" data-part="slot-wins">
      <template #element="{ props: elementProps, elementRef }">
        <span v-bind="elementProps" :ref="elementRef"><Slider.Thumb aria-label="Balance" /></span>
      </template>
    </Slider.Control>
  </Slider.Root>
  <Resizable.Root
    :as="is('Resizable.Root')"
    v-bind="attrs('Resizable.Root')"
    :ref="setter('Resizable.Root')"
    style="width: 200px; height: 40px"
  >
    <Resizable.Panel
      id="first"
      :as="is('Resizable.Panel')"
      v-bind="attrs('Resizable.Panel')"
      :ref="setter('Resizable.Panel')"
      >One</Resizable.Panel
    >
    <Resizable.Handle
      :as="is('Resizable.Handle')"
      v-bind="attrs('Resizable.Handle')"
      :ref="setter('Resizable.Handle')"
      aria-label="Resize"
    />
    <Resizable.Panel id="second">Two</Resizable.Panel>
  </Resizable.Root>
  <Resizable.Root as="section" data-part="slot-wins">
    <template #element="{ props: elementProps, elementRef }">
      <span v-bind="elementProps" :ref="elementRef" />
    </template>
  </Resizable.Root>
  <OTPField.Root
    :as="is('OTPField.Root')"
    v-bind="attrs('OTPField.Root')"
    :ref="setter('OTPField.Root')"
    :length="2"
    aria-label="Code"
  >
    <OTPField.Input />
    <OTPField.Input />
  </OTPField.Root>
  <OTPField.Root as="section" data-part="slot-wins" :length="1" aria-label="Pin">
    <template #element="{ props: elementProps, elementRef }">
      <span v-bind="elementProps" :ref="elementRef"><OTPField.Input /></span>
    </template>
  </OTPField.Root>
  <NumberField.Root
    :as="is('NumberField.Root')"
    v-bind="attrs('NumberField.Root')"
    :ref="setter('NumberField.Root')"
    :default-value="5"
  >
    <NumberField.ScrubArea
      :as="is('NumberField.ScrubArea')"
      v-bind="attrs('NumberField.ScrubArea')"
      :ref="setter('NumberField.ScrubArea')"
      >Amount</NumberField.ScrubArea
    >
    <NumberField.Group
      :as="is('NumberField.Group')"
      v-bind="attrs('NumberField.Group')"
      :ref="setter('NumberField.Group')"
    >
      <NumberField.Decrement
        :as="is('NumberField.Decrement')"
        v-bind="attrs('NumberField.Decrement')"
        :ref="setter('NumberField.Decrement')"
        aria-label="Less"
      />
      <NumberField.Input aria-label="Amount" />
      <NumberField.Increment
        :as="is('NumberField.Increment')"
        v-bind="attrs('NumberField.Increment')"
        :ref="setter('NumberField.Increment')"
        aria-label="More"
      />
    </NumberField.Group>
  </NumberField.Root>
  <NumberField.Root>
    <NumberField.Group as="section" data-part="slot-wins">
      <template #element="{ props: elementProps, elementRef }">
        <span v-bind="elementProps" :ref="elementRef"
          ><NumberField.Input aria-label="Count"
        /></span>
      </template>
    </NumberField.Group>
  </NumberField.Root>
</template>
