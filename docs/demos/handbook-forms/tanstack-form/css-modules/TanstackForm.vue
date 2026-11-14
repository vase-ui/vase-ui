<script setup lang="ts">
import { revalidateLogic, useForm } from '@tanstack/vue-form';
import type { DeepKeys, ValidationError } from '@tanstack/vue-form';
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Button } from '@vase-ui/vue/button';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { NumberField } from '@vase-ui/vue/number-field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
import { Switch } from '@vase-ui/vue/switch';
import { Toast } from '@vase-ui/vue/toast';
import layout from '../../../../examples/forms/layout.module.css';
import autocompleteStyles from '../../../autocomplete/hero/css-modules/index.module.css';
import buttonStyles from '../../../button/hero/css-modules/index.module.css';
import checkboxGroupStyles from '../../../checkbox-group/hero/css-modules/index.module.css';
import comboboxStyles from '../../../combobox/hero/css-modules/index.module.css';
import fieldStyles from '../../../field/hero/css-modules/index.module.css';
import numberFieldStyles from '../../../number-field/hero/css-modules/index.module.css';
import radioGroupStyles from '../../../radio-group/hero/css-modules/index.module.css';
import selectStyles from '../../../select/hero/css-modules/index.module.css';
import sliderStyles from '../../../slider/range-slider/css-modules/index.module.css';
import switchStyles from '../../../switch/hero/css-modules/index.module.css';

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

const toastManager = Toast.useToastManager();

const form = useForm({
  defaultValues,
  onSubmit: ({ value: formValues }) => {
    toastManager.add({
      title: 'Form submitted',
      description: 'The form contains these values:',
      data: formValues,
    });
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

const CaretDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [h('path', { d: 'M12 6H4l4 4.5z' })]);

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);

const XIcon: FunctionalComponent = (_, { attrs }) =>
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
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );

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
</script>

<template>
  <form
    aria-label="Launch new cloud server"
    novalidate
    :class="layout.Form"
    @submit.prevent="form.handleSubmit()"
  >
    <form.Field v-slot="{ field }" name="serverName">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
        :class="fieldStyles.Field"
      >
        <Field.Label :class="fieldStyles.Label">Server name</Field.Label>
        <Field.Control
          :value="field.state.value"
          placeholder="e.g. api-server-01"
          :class="fieldStyles.Input"
          @value-change="field.handleChange"
          @blur="field.handleBlur"
        />
        <Field.Description :class="fieldStyles.Description">
          Must be 3 or more characters long
        </Field.Description>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <Combobox.Root
          :items="REGIONS"
          :value="field.state.value"
          @value-change="field.handleChange"
        >
          <div :class="comboboxStyles.Label">
            <Field.Label>Region</Field.Label>
            <Combobox.InputGroup :class="comboboxStyles.InputGroup">
              <Combobox.Input
                placeholder="e.g. eu-central-1"
                :class="comboboxStyles.Input"
                @blur="field.handleBlur"
              />
              <div :class="comboboxStyles.ActionButtons">
                <Combobox.Clear :class="comboboxStyles.Clear" aria-label="Clear selection">
                  <XIcon />
                </Combobox.Clear>
                <Combobox.Trigger :class="comboboxStyles.Trigger" aria-label="Open popup">
                  <CaretDownIcon />
                </Combobox.Trigger>
              </div>
            </Combobox.InputGroup>
          </div>
          <Combobox.Portal>
            <Combobox.Positioner :class="comboboxStyles.Positioner" :side-offset="4">
              <Combobox.Popup :class="comboboxStyles.Popup">
                <Combobox.Empty>
                  <div :class="comboboxStyles.Empty">No matches</div>
                </Combobox.Empty>
                <Combobox.List :class="comboboxStyles.List">
                  <template #item="{ item }">
                    <Combobox.Item :value="item" :class="comboboxStyles.Item">
                      <Combobox.ItemIndicator :class="comboboxStyles.ItemIndicator">
                        <CheckIcon />
                      </Combobox.ItemIndicator>
                      <span :class="comboboxStyles.ItemText">{{ item }}</span>
                    </Combobox.Item>
                  </template>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <Autocomplete.Root
          :items="IMAGES"
          mode="both"
          :value="field.state.value"
          :item-to-string-value="(itemValue: Image) => itemValue.url"
          @value-change="field.handleChange"
        >
          <Field.Label :class="fieldStyles.Label">Container image</Field.Label>
          <Autocomplete.Input
            placeholder="e.g. docker.io/library/node:latest"
            :class="autocompleteStyles.Input"
            @blur="field.handleBlur"
          />
          <Field.Description :class="fieldStyles.Description">
            Enter a registry URL with optional tags
          </Field.Description>
          <Autocomplete.Portal>
            <Autocomplete.Positioner
              :class="[autocompleteStyles.Positioner, layout.ImagePositioner]"
              :side-offset="4"
            >
              <Autocomplete.Popup :class="autocompleteStyles.Popup">
                <Autocomplete.List :class="autocompleteStyles.List">
                  <template #item="{ item }">
                    <Autocomplete.Item
                      :value="item"
                      :class="[autocompleteStyles.Item, layout.ImageItem]"
                    >
                      <span>{{ item.name }}</span>
                      <span :class="layout.ImageUrl">{{ item.url }}</span>
                    </Autocomplete.Item>
                  </template>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <Select.Root
          :items="SERVER_TYPES"
          :value="field.state.value"
          @value-change="field.handleChange"
        >
          <div :class="selectStyles.Field">
            <Select.Label :class="selectStyles.Label">Server type</Select.Label>
            <Select.Trigger
              :class="[selectStyles.Select, layout.SelectTrigger]"
              @blur="field.handleBlur"
            >
              <Select.Value :class="selectStyles.Value" />
              <Select.Icon>
                <CaretUpDownIcon />
              </Select.Icon>
            </Select.Trigger>
          </div>
          <Select.Portal>
            <Select.Positioner :class="selectStyles.Positioner" :side-offset="4">
              <Select.Popup :class="selectStyles.Popup">
                <Select.ScrollUpArrow :class="selectStyles.ScrollArrow" />
                <Select.List :class="selectStyles.List">
                  <Select.Item
                    v-for="{ label, value } in SERVER_TYPES"
                    :key="label"
                    :value="value"
                    :class="selectStyles.Item"
                  >
                    <Select.ItemIndicator :class="selectStyles.ItemIndicator">
                      <CheckIcon />
                    </Select.ItemIndicator>
                    <Select.ItemText :class="selectStyles.ItemText">{{ label }}</Select.ItemText>
                  </Select.Item>
                </Select.List>
                <Select.ScrollDownArrow :class="selectStyles.ScrollArrow" />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <NumberField.Root
          :value="field.state.value"
          :min="1"
          :max="64"
          :class="numberFieldStyles.Field"
          @value-change="field.handleChange"
        >
          <Field.Label :class="fieldStyles.Label">Number of instances</Field.Label>
          <NumberField.Group :class="numberFieldStyles.Group">
            <NumberField.Decrement :class="numberFieldStyles.Decrement">
              <MinusIcon />
            </NumberField.Decrement>
            <NumberField.Input :class="numberFieldStyles.Input" @blur="field.handleBlur" />
            <NumberField.Increment :class="numberFieldStyles.Increment">
              <PlusIcon />
            </NumberField.Increment>
          </NumberField.Group>
        </NumberField.Root>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <Fieldset.Root>
          <template #render="{ props }">
            <Slider.Root
              v-bind="props"
              :value="field.state.value"
              thumb-alignment="edge"
              :min="0"
              :max="1"
              :step="0.01"
              :format="{ style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
              :class="layout.Slider"
              @value-change="field.handleChange"
              @value-committed="field.handleChange"
            >
              <Fieldset.Legend :class="fieldStyles.Label">Scaling threshold</Fieldset.Legend>
              <Slider.Value :class="layout.SliderValue" />
              <Slider.Control :class="[sliderStyles.Control, layout.SliderControl]">
                <Slider.Track :class="sliderStyles.Track">
                  <Slider.Indicator :class="sliderStyles.Indicator" />
                  <Slider.Thumb
                    :index="0"
                    aria-label="Minimum threshold"
                    :class="sliderStyles.Thumb"
                    @focusout="field.handleBlur"
                  />
                  <Slider.Thumb
                    :index="1"
                    aria-label="Maximum threshold"
                    :class="sliderStyles.Thumb"
                    @focusout="field.handleBlur"
                  />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          </template>
        </Fieldset.Root>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <Fieldset.Root>
          <template #render="{ props }">
            <RadioGroup
              v-bind="props"
              :value="field.state.value"
              :class="layout.Row"
              @value-change="field.handleChange"
            >
              <Fieldset.Legend :class="fieldStyles.Label">Storage type</Fieldset.Legend>
              <Field.Item v-for="storageType in storageTypes" :key="storageType">
                <Field.Label :class="[radioGroupStyles.Item, layout.Uppercase]">
                  <Radio.Root
                    :value="storageType"
                    :class="radioGroupStyles.Radio"
                    @blur="field.handleBlur"
                  >
                    <Radio.Indicator :class="radioGroupStyles.Indicator" />
                  </Radio.Root>
                  {{ storageType }}
                </Field.Label>
              </Field.Item>
            </RadioGroup>
          </template>
        </Fieldset.Root>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <Field.Label :class="switchStyles.Label">
          Restart on failure
          <Switch.Root
            :checked="field.state.value"
            :class="switchStyles.Switch"
            @checked-change="field.handleChange"
            @blur="field.handleBlur"
          >
            <Switch.Thumb :class="switchStyles.Thumb" />
          </Switch.Root>
        </Field.Label>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
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
        :class="fieldStyles.Field"
      >
        <Fieldset.Root>
          <template #render="{ props }">
            <CheckboxGroup
              v-bind="props"
              :value="field.state.value"
              :class="checkboxGroupStyles.CheckboxGroup"
              @value-change="field.handleChange"
            >
              <Fieldset.Legend :class="fieldStyles.Label"
                >Allowed network protocols</Fieldset.Legend
              >
              <div :class="layout.Protocols">
                <Field.Item v-for="protocol in protocols" :key="protocol">
                  <Field.Label :class="[checkboxGroupStyles.Item, layout.Uppercase]">
                    <Checkbox.Root
                      :value="protocol"
                      :class="checkboxGroupStyles.Checkbox"
                      @blur="field.handleBlur"
                    >
                      <Checkbox.Indicator :class="checkboxGroupStyles.Indicator">
                        <CheckIcon />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    {{ protocol }}
                  </Field.Label>
                </Field.Item>
              </div>
            </CheckboxGroup>
          </template>
        </Fieldset.Root>
        <Field.Error :match="!field.state.meta.isValid" :class="fieldStyles.Error">
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>

    <Button type="submit" :class="buttonStyles.Button">Launch server</Button>
  </form>
</template>
