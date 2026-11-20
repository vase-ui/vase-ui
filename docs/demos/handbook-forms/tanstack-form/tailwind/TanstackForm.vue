<script setup lang="ts">
import { revalidateLogic, useForm } from '@tanstack/vue-form';
import type { DeepKeys, ValidationError } from '@tanstack/vue-form';
import { h, useTemplateRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import * as Autocomplete from '../../components/autocomplete';
import { Button } from '../../components/button';
import { Checkbox } from '../../components/checkbox';
import { CheckboxGroup } from '../../components/checkbox-group';
import * as Combobox from '../../components/combobox';
import * as Field from '../../components/field';
import * as Fieldset from '../../components/fieldset';
import { Input } from '../../components/input';
import * as NumberField from '../../components/number-field';
import { Radio } from '../../components/radio';
import { RadioGroup } from '../../components/radio-group';
import * as Select from '../../components/select';
import * as Slider from '../../components/slider';
import { Switch } from '../../components/switch';
import { useToastManager } from '../../components/toast';

interface FormValues {
  serverName: string;
  region: string | null;
  containerImage: string;
  serverType: string | null;
  numOfInstances: number | null;
  scalingThreshold: number[];
  storageType: 'ssd' | 'hdd';
  restartOnFailure: boolean;
  allowedNetworkProtocols: string[];
}

const defaultValues: FormValues = {
  serverName: '',
  region: null,
  containerImage: '',
  serverType: null,
  numOfInstances: null,
  scalingThreshold: [0.2, 0.8],
  storageType: 'ssd',
  restartOnFailure: true,
  allowedNetworkProtocols: [],
};

const requiredFields: (keyof FormValues)[] = [
  'serverName',
  'region',
  'containerImage',
  'serverType',
  'numOfInstances',
];

const toastManager = useToastManager();

const formElement = useTemplateRef('formElement');

const form = useForm({
  defaultValues,
  onSubmit: ({ value: formValues }) => {
    toastManager.add({
      title: 'Form submitted',
      description: 'The form contains these values:',
      data: formValues,
    });
  },
  onSubmitInvalid: () => {
    formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  },
  validationLogic: revalidateLogic({
    mode: 'submit',
    modeAfterSubmission: 'change',
  }),
  validators: {
    onDynamic: ({ value: formValues }) => {
      const errors: Partial<Record<DeepKeys<FormValues>, ValidationError>> = {};

      for (const requiredField of requiredFields) {
        if (!formValues[requiredField]) {
          errors[requiredField] = 'This is a required field.';
        }
      }

      if (formValues.serverName && formValues.serverName.length < 3) {
        errors.serverName = 'At least 3 characters.';
      }

      return Object.keys(errors).length === 0 ? undefined : { form: errors, fields: errors };
    },
  },
});

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

const storageTypes = ['ssd', 'hdd'];

const protocols = ['http', 'https', 'ssh'];

const SERVER_TYPES = [
  { label: 'Select server type', value: null },
  ...cartesian(['t', 'm'], ['1', '2'], ['small', 'medium', 'large']).map((part) => {
    const value = part.join('.').replace('.', '');
    return { label: value, value };
  }),
];

// The input of a slider thumb has the focus, and `blur` does not bubble. The thumbs thus listen
// to `focusout`.

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <form
    ref="formElement"
    aria-label="Launch new cloud server with TanStack Form"
    novalidate
    class="flex w-full max-w-3xs flex-col gap-5 sm:max-w-[20rem]"
    @submit.prevent="form.handleSubmit()"
  >
    <form.Field v-slot="{ field }" name="serverName">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Field.Label>Server name</Field.Label>
        <Input
          :model-value="field.state.value"
          placeholder="e.g. api-server-01"
          @value-change="field.handleChange"
          @blur="field.handleBlur"
        />
        <Field.Description>Must be 3 or more characters long</Field.Description>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="region">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Combobox.Root
          :items="REGIONS"
          :model-value="field.state.value"
          @value-change="field.handleChange"
        >
          <div class="relative text-sm leading-5 font-bold text-neutral-950 dark:text-white">
            <Field.Label class="mb-1 block">Region</Field.Label>
            <Combobox.InputGroup>
              <Combobox.Input placeholder="e.g. eu-central-1" @blur="field.handleBlur" />
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
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="containerImage">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Autocomplete.Root
          :items="IMAGES"
          mode="both"
          :model-value="field.state.value"
          :item-to-string-value="(itemValue: Image) => itemValue.url"
          @value-change="field.handleChange"
        >
          <Field.Label>Container image</Field.Label>
          <Autocomplete.Input
            placeholder="e.g. docker.io/library/node:latest"
            @blur="field.handleBlur"
          />
          <Field.Description>Enter a registry URL with optional tags</Field.Description>
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <template #item="{ item }">
                    <Autocomplete.Item :value="item">
                      <span>{{ item.name }}</span>
                      <span class="font-mono whitespace-nowrap text-xs opacity-80">{{
                        item.url
                      }}</span>
                    </Autocomplete.Item>
                  </template>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="serverType">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Select.Root
          :items="SERVER_TYPES"
          :model-value="field.state.value"
          @value-change="field.handleChange"
        >
          <div class="w-fit space-y-1">
            <Select.Label>Server type</Select.Label>
            <Select.Trigger class="w-48" @blur="field.handleBlur">
              <Select.Value />
              <Select.Icon>
                <CaretUpDownIcon />
              </Select.Icon>
            </Select.Trigger>
          </div>
          <Select.Portal>
            <Select.Positioner>
              <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
                <Select.Popup>
                  <Select.ScrollUpArrow />
                  <Select.List>
                    <Select.Item
                      v-for="{ label, value } in SERVER_TYPES"
                      :key="label"
                      :value="value"
                      v-slot="{ state }"
                    >
                      <span v-if="state.selected" class="col-start-1">
                        <CheckIcon />
                      </span>
                      <Select.ItemText>{{ label }}</Select.ItemText>
                    </Select.Item>
                  </Select.List>
                  <Select.ScrollDownArrow />
                </Select.Popup>
              </Transition>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="numOfInstances">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <NumberField.Root
          :model-value="field.state.value"
          :min="1"
          :max="64"
          @value-change="field.handleChange"
        >
          <Field.Label>Number of instances</Field.Label>
          <NumberField.Group>
            <NumberField.Decrement aria-label="Decrease">
              <MinusIcon />
            </NumberField.Decrement>
            <NumberField.Input @blur="field.handleBlur" />
            <NumberField.Increment aria-label="Increase">
              <PlusIcon />
            </NumberField.Increment>
          </NumberField.Group>
        </NumberField.Root>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="scalingThreshold">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Fieldset.Root>
          <template #element="{ props, elementRef }">
            <Slider.Root
              v-bind="props"
              :ref="elementRef"
              :model-value="field.state.value"
              thumb-alignment="edge"
              :min="0"
              :max="1"
              :step="0.01"
              :format="{ style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
              class="w-full gap-y-2"
              @value-change="field.handleChange"
              @value-committed="field.handleChange"
            >
              <Fieldset.Legend>Scaling threshold</Fieldset.Legend>
              <Slider.Value class="col-start-2 text-end" />
              <Slider.Control>
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb
                    :index="0"
                    aria-label="Minimum threshold"
                    @focusout="field.handleBlur"
                  />
                  <Slider.Thumb
                    :index="1"
                    aria-label="Maximum threshold"
                    @focusout="field.handleBlur"
                  />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          </template>
        </Fieldset.Root>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="storageType">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Fieldset.Root>
          <template #element="{ props, elementRef }">
            <RadioGroup
              v-bind="props"
              :ref="elementRef"
              :model-value="field.state.value"
              class="gap-4"
              @value-change="field.handleChange"
            >
              <Fieldset.Legend class="-mt-px">Storage type</Fieldset.Legend>
              <Field.Item v-for="storageType in storageTypes" :key="storageType">
                <Field.Label class="uppercase">
                  <Radio :value="storageType" />
                  {{ storageType }}
                </Field.Label>
              </Field.Item>
            </RadioGroup>
          </template>
        </Fieldset.Root>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="restartOnFailure">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Field.Label class="gap-2">
          Restart on failure
          <span class="relative flex shrink-0"
            ><Switch
              :model-value="field.state.value"
              @checked-change="field.handleChange"
              @blur="field.handleBlur" /><span
              class="pointer-events-none absolute top-[0.1875rem] left-[0.1875rem] size-3.5 bg-neutral-950 transition-[translate,background-color] duration-150 ease-[ease] peer-checked:translate-x-4 peer-checked:bg-white dark:bg-white dark:peer-checked:bg-neutral-950"
          /></span>
        </Field.Label>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <form.Field v-slot="{ field }" name="allowedNetworkProtocols">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Fieldset.Root>
          <template #element="{ props, elementRef }">
            <CheckboxGroup
              v-bind="props"
              :ref="elementRef"
              :model-value="field.state.value"
              @value-change="field.handleChange"
            >
              <Fieldset.Legend class="mb-2">Allowed network protocols</Fieldset.Legend>
              <div class="flex gap-4">
                <Field.Item v-for="protocol in protocols" :key="protocol">
                  <Field.Label class="uppercase">
                    <span class="relative flex shrink-0"
                      ><Checkbox :value="protocol" @blur="field.handleBlur" /><CheckIcon
                        class="pointer-events-none absolute inset-0 hidden text-white peer-checked:block dark:text-neutral-950"
                    /></span>
                    {{ protocol }}
                  </Field.Label>
                </Field.Item>
              </div>
            </CheckboxGroup>
          </template>
        </Fieldset.Root>
        <Field.Error>
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <Button type="submit" class="mt-3">Launch server</Button>
  </form>
</template>
