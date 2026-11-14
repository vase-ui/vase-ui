<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Form } from '@vase-ui/vue/form';
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <Form>
    <Field.Root>
      <Fieldset.Root>
        <template #render="{ props }">
          <Slider.Root v-bind="props" :default-value="[25, 75]">
            <Fieldset.Legend>Price range</Fieldset.Legend>
            <Slider.Control>
              <Slider.Track>
                <Slider.Thumb :index="0" aria-label="Minimum price" />
                <Slider.Thumb :index="1" aria-label="Maximum price" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        </template>
      </Fieldset.Root>
    </Field.Root>
  </Form>
</template>
