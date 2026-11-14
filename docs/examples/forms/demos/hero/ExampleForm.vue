<script setup lang="ts">
import { Button } from '@vase-ui/vue/button';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Form } from '@vase-ui/vue/form';
import { NumberField } from '@vase-ui/vue/number-field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Slider } from '@vase-ui/vue/slider';
import { Switch } from '@vase-ui/vue/switch';
import { Toast } from '@vase-ui/vue/toast';
import buttonStyles from '../../../../demos/button/hero/css-modules/index.module.css';
import checkboxGroupStyles from '../../../../demos/checkbox-group/hero/css-modules/index.module.css';
import fieldStyles from '../../../../demos/field/hero/css-modules/index.module.css';
import numberFieldStyles from '../../../../demos/number-field/hero/css-modules/index.module.css';
import radioGroupStyles from '../../../../demos/radio-group/hero/css-modules/index.module.css';
import sliderStyles from '../../../../demos/slider/range-slider/css-modules/index.module.css';
import switchStyles from '../../../../demos/switch/hero/css-modules/index.module.css';

const toastManager = Toast.useToastManager();

const protocols = ['http', 'https', 'ssh'];

function onFormSubmit(formValues: Record<string, unknown>) {
  toastManager.add({
    title: 'Form submitted',
    description: 'The form contains these values:',
    data: formValues,
  });
}
</script>

<template>
  <Form aria-label="Launch new cloud server" :class="$style.Form" @form-submit="onFormSubmit">
    <Field.Root name="serverName" :class="fieldStyles.Field">
      <Field.Label :class="fieldStyles.Label">Server name</Field.Label>
      <Field.Control
        default-value=""
        placeholder="e.g. api-server-01"
        required
        :minlength="3"
        pattern=".*[A-Za-z].*"
        :class="fieldStyles.Input"
      />
      <Field.Description :class="fieldStyles.Description">
        Must be 3 or more characters long
      </Field.Description>
      <Field.Error :class="fieldStyles.Error" />
    </Field.Root>

    <Field.Root name="numOfInstances" :class="fieldStyles.Field">
      <NumberField.Root :min="1" :max="64" required :class="numberFieldStyles.Field">
        <Field.Label :class="fieldStyles.Label">Number of instances</Field.Label>
        <NumberField.Group :class="numberFieldStyles.Group">
          <NumberField.Decrement :class="numberFieldStyles.Decrement">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-linecap="square"
              stroke-linejoin="round"
              style="display: block"
            >
              <path d="M1.5 8h13" />
            </svg>
          </NumberField.Decrement>
          <NumberField.Input :class="numberFieldStyles.Input" />
          <NumberField.Increment :class="numberFieldStyles.Increment">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-linecap="square"
              stroke-linejoin="round"
              style="display: block"
            >
              <path d="M1.5 8h13M8 14.5v-13" />
            </svg>
          </NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
      <Field.Error :class="fieldStyles.Error" />
    </Field.Root>

    <Field.Root name="scalingThreshold" :class="fieldStyles.Field">
      <Fieldset.Root>
        <template #render="{ props }">
          <Slider.Root
            v-bind="props"
            :default-value="[0.2, 0.8]"
            thumb-alignment="edge"
            :min="0"
            :max="1"
            :step="0.01"
            :format="{ style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
            :class="$style.Slider"
          >
            <Fieldset.Legend :class="fieldStyles.Label">Scaling threshold</Fieldset.Legend>
            <Slider.Value :class="$style.SliderValue" />
            <Slider.Control :class="[sliderStyles.Control, $style.SliderControl]">
              <Slider.Track :class="sliderStyles.Track">
                <Slider.Indicator :class="sliderStyles.Indicator" />
                <Slider.Thumb
                  :index="0"
                  aria-label="Minimum threshold"
                  :class="sliderStyles.Thumb"
                />
                <Slider.Thumb
                  :index="1"
                  aria-label="Maximum threshold"
                  :class="sliderStyles.Thumb"
                />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        </template>
      </Fieldset.Root>
    </Field.Root>

    <Field.Root name="storageType" :class="fieldStyles.Field">
      <Fieldset.Root>
        <template #render="{ props }">
          <RadioGroup v-bind="props" default-value="ssd" :class="$style.Row">
            <Fieldset.Legend :class="fieldStyles.Label">Storage type</Fieldset.Legend>
            <Field.Item>
              <Field.Label :class="radioGroupStyles.Item">
                <Radio.Root value="ssd" :class="radioGroupStyles.Radio">
                  <Radio.Indicator :class="radioGroupStyles.Indicator" />
                </Radio.Root>
                SSD
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label :class="radioGroupStyles.Item">
                <Radio.Root value="hdd" :class="radioGroupStyles.Radio">
                  <Radio.Indicator :class="radioGroupStyles.Indicator" />
                </Radio.Root>
                HDD
              </Field.Label>
            </Field.Item>
          </RadioGroup>
        </template>
      </Fieldset.Root>
    </Field.Root>

    <Field.Root name="restartOnFailure" :class="fieldStyles.Field">
      <Field.Label :class="switchStyles.Label">
        Restart on failure
        <Switch.Root default-checked :class="switchStyles.Switch">
          <Switch.Thumb :class="switchStyles.Thumb" />
        </Switch.Root>
      </Field.Label>
    </Field.Root>

    <Field.Root name="allowedNetworkProtocols" :class="fieldStyles.Field">
      <Fieldset.Root>
        <template #render="{ props }">
          <CheckboxGroup
            v-bind="props"
            :default-value="[]"
            :class="checkboxGroupStyles.CheckboxGroup"
          >
            <Fieldset.Legend :class="fieldStyles.Label">Allowed network protocols</Fieldset.Legend>
            <div :class="$style.Protocols">
              <Field.Item v-for="protocol in protocols" :key="protocol">
                <Field.Label :class="[checkboxGroupStyles.Item, $style.Uppercase]">
                  <Checkbox.Root :value="protocol" :class="checkboxGroupStyles.Checkbox">
                    <Checkbox.Indicator :class="checkboxGroupStyles.Indicator">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        style="display: block"
                      >
                        <path d="m2.5 8.5 4 4 7-9" />
                      </svg>
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  {{ protocol }}
                </Field.Label>
              </Field.Item>
            </div>
          </CheckboxGroup>
        </template>
      </Fieldset.Root>
    </Field.Root>

    <Button type="submit" :class="buttonStyles.Button">Launch server</Button>
  </Form>
</template>

<style module>
.Form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-sizing: border-box;
  width: 100%;
  max-width: 16rem;
}

@media (min-width: 640px) {
  .Form {
    max-width: 20rem;
  }
}

.Slider {
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 0.5rem;
  width: 100%;
}

.SliderValue {
  grid-column-start: 2;
  font-size: 0.875rem;
  text-align: end;
}

.SliderControl {
  grid-column: span 2;
  width: 100%;
}

.Row {
  display: flex;
  align-items: start;
  gap: 1rem;
  width: 100%;
}

.Protocols {
  display: flex;
  gap: 1rem;
}

.Uppercase {
  text-transform: uppercase;
}
</style>
