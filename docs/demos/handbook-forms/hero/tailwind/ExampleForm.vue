<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import * as Autocomplete from '../../components/autocomplete';
import { Button } from '../../components/button';
import { Checkbox } from '../../components/checkbox';
import { CheckboxGroup } from '../../components/checkbox-group';
import * as Combobox from '../../components/combobox';
import * as Field from '../../components/field';
import * as Fieldset from '../../components/fieldset';
import { Input } from '../../components/input';
import { Form } from '../../components/form';
import * as NumberField from '../../components/number-field';
import { Radio } from '../../components/radio';
import { RadioGroup } from '../../components/radio-group';
import * as Select from '../../components/select';
import * as Slider from '../../components/slider';
import { Switch } from '../../components/switch';
import { useToastManager } from '../../components/toast';

const toastManager = useToastManager();

function onSubmit(_event: SubmitEvent, formValues: Record<string, unknown>) {
  toastManager.add({
    title: 'Form submitted',
    description: 'The form contains these values:',
    data: formValues,
  });
}

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CaretUpDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [
    h('path', { d: 'M11 10H5l3 3.5zm0-4H5l3-3.5z' }),
  ]);

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);

const PlusIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      ...ICON_PROPS,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      ...attrs,
    },
    [h('path', { d: 'M1.5 8h13M8 14.5v-13' })],
  );

const MinusIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      ...ICON_PROPS,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      ...attrs,
    },
    [h('path', { d: 'M1.5 8h13' })],
  );

function cartesian(...arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]],
  );
}

const REGIONS = cartesian(['us', 'eu', 'ap'], ['central', 'east', 'west'], ['1', '2', '3']).map(
  (part) => part.join('-'),
);

interface Image {
  url: string;
  name: string;
}

const IMAGES: Image[] = [
  'nginx:1.29-alpine',
  'node:22-slim',
  'postgres:18',
  'redis:8.2.2-alpine',
].map((name) => ({ url: `docker.io/library/${name}`, name }));

const SERVER_TYPES = [
  { label: 'Select server type', value: null },
  ...cartesian(['t', 'm'], ['1', '2'], ['small', 'medium', 'large']).map((part) => {
    const value = part.join('.').replace('.', '');
    return { label: value, value };
  }),
];

const protocols = ['http', 'https', 'ssh'];
</script>

<template>
  <Form aria-label="Launch new cloud server" @submit="onSubmit">
    <Field.Root name="serverName">
      <Field.Label>Server name</Field.Label>
      <Input
        default-value=""
        placeholder="e.g. api-server-01"
        required
        :minlength="3"
        pattern=".*[A-Za-z].*"
      />
      <Field.Description>Must be 3 or more characters long</Field.Description>
      <Field.Error />
    </Field.Root>

    <Field.Root name="region">
      <Combobox.Root :items="REGIONS" required>
        <div class="relative text-sm leading-5 font-bold text-neutral-950 dark:text-white">
          <Field.Label class="mb-1 block">Region</Field.Label>
          <Combobox.InputGroup>
            <Combobox.Input placeholder="e.g. eu-central-1" />
            <div
              class="absolute right-0 bottom-0 inline-flex h-full items-center justify-center text-neutral-500 dark:text-neutral-400"
            >
              <Combobox.Clear />
              <Combobox.Trigger>
                <Combobox.CaretDownIcon />
              </Combobox.Trigger>
            </div>
          </Combobox.InputGroup>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Empty>No matches</Combobox.Empty>
              <Combobox.List>
                <template #item="{ item }">
                  <Combobox.Item :value="item">
                    <Combobox.ItemIndicator>
                      <CheckIcon />
                    </Combobox.ItemIndicator>
                    <span class="col-start-2">{{ item }}</span>
                  </Combobox.Item>
                </template>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <Field.Error />
    </Field.Root>

    <Field.Root name="containerImage">
      <Autocomplete.Root
        :items="IMAGES"
        mode="both"
        :item-to-string-value="(itemValue: Image) => itemValue.url"
        required
      >
        <Field.Label>Container image</Field.Label>
        <Autocomplete.Input placeholder="e.g. docker.io/library/node:latest" />
        <Field.Description>Enter a registry URL with optional tags</Field.Description>
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <template #item="{ item }">
                  <Autocomplete.Item :value="item">
                    <span>{{ item.name }}</span>
                    <span class="font-mono whitespace-nowrap text-xs opacity-80">
                      {{ item.url }}
                    </span>
                  </Autocomplete.Item>
                </template>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
      <Field.Error />
    </Field.Root>

    <Field.Root name="serverType">
      <Select.Root :items="SERVER_TYPES" required>
        <div class="w-fit space-y-1">
          <Select.Label>Server type</Select.Label>
          <Select.Trigger class="w-48">
            <Select.Value />
            <Select.Icon>
              <CaretUpDownIcon />
            </Select.Icon>
          </Select.Trigger>
        </div>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.ScrollUpArrow />
              <Select.List>
                <Select.Item v-for="{ label, value } in SERVER_TYPES" :key="label" :value="value">
                  <Select.ItemIndicator>
                    <CheckIcon />
                  </Select.ItemIndicator>
                  <Select.ItemText>{{ label }}</Select.ItemText>
                </Select.Item>
              </Select.List>
              <Select.ScrollDownArrow />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Field.Error />
    </Field.Root>

    <Field.Root name="numOfInstances">
      <NumberField.Root :min="1" :max="64" required>
        <Field.Label>Number of instances</Field.Label>
        <NumberField.Group>
          <NumberField.Decrement>
            <MinusIcon />
          </NumberField.Decrement>
          <NumberField.Input />
          <NumberField.Increment>
            <PlusIcon />
          </NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
      <Field.Error />
    </Field.Root>

    <Field.Root name="scalingThreshold">
      <Fieldset.Root>
        <template #element="{ props, elementRef }">
          <Slider.Root
            v-bind="props"
            :ref="elementRef"
            :default-value="[0.2, 0.8]"
            thumb-alignment="edge"
            :min="0"
            :max="1"
            :step="0.01"
            :format="{ style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
            class="w-full gap-y-2"
          >
            <Fieldset.Legend>Scaling threshold</Fieldset.Legend>
            <Slider.Value class="col-start-2 text-end" />
            <Slider.Control>
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb :index="0" aria-label="Minimum threshold" />
                <Slider.Thumb :index="1" aria-label="Maximum threshold" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        </template>
      </Fieldset.Root>
    </Field.Root>

    <Field.Root name="storageType">
      <Fieldset.Root>
        <template #element="{ props, elementRef }">
          <RadioGroup v-bind="props" :ref="elementRef" class="gap-4" default-value="ssd">
            <Fieldset.Legend class="-mt-px">Storage type</Fieldset.Legend>
            <Field.Item>
              <Field.Label>
                <Radio value="ssd" />
                SSD
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label>
                <Radio value="hdd" />
                HDD
              </Field.Label>
            </Field.Item>
          </RadioGroup>
        </template>
      </Fieldset.Root>
    </Field.Root>

    <Field.Root name="restartOnFailure">
      <Field.Label class="gap-2">
        Restart on failure
        <span class="relative flex shrink-0"
          ><Switch default-checked /><span
            class="pointer-events-none absolute top-[0.1875rem] left-[0.1875rem] size-3.5 bg-neutral-950 transition-[translate,background-color] duration-150 ease-[ease] peer-checked:translate-x-4 peer-checked:bg-white dark:bg-white dark:peer-checked:bg-neutral-950"
        /></span>
      </Field.Label>
    </Field.Root>

    <Field.Root name="allowedNetworkProtocols">
      <Fieldset.Root>
        <template #element="{ props, elementRef }">
          <CheckboxGroup v-bind="props" :ref="elementRef" :default-value="[]">
            <Fieldset.Legend class="mb-2">Allowed network protocols</Fieldset.Legend>
            <div class="flex gap-4">
              <Field.Item v-for="protocol in protocols" :key="protocol">
                <Field.Label class="uppercase">
                  <span class="relative flex shrink-0"
                    ><Checkbox :value="protocol" /><CheckIcon
                      class="pointer-events-none absolute inset-0 hidden text-white peer-checked:block dark:text-neutral-950"
                  /></span>
                  {{ protocol }}
                </Field.Label>
              </Field.Item>
            </div>
          </CheckboxGroup>
        </template>
      </Fieldset.Root>
    </Field.Root>

    <Button type="submit" class="mt-3">Launch server</Button>
  </Form>
</template>
