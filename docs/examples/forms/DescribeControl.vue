<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <Form>
    <Field.Root>
      <Select.Root>
        <Select.Label>Time zone</Select.Label>
        <Select.Trigger />
      </Select.Root>
      <Field.Description>Used for notifications and reminders</Field.Description>
    </Field.Root>

    <Field.Root>
      <Slider.Root :default-value="50">
        <Slider.Label>Zoom level</Slider.Label>
        <Field.Description>Adjust the size of the user interface</Field.Description>
        <Slider.Control>
          <Slider.Track>
            <Slider.Thumb />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </Field.Root>
  </Form>
</template>
