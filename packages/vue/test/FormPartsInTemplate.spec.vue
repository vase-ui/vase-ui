<!-- @strictTemplates true -->
<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Form } from '@vase-ui/vue/form';
import { Input } from '@vase-ui/vue/input';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Switch } from '@vase-ui/vue/switch';
</script>

<!-- A form part takes the native attributes of its element in a template. -->
<template>
  <Form action="/order" method="post" />
  <Fieldset.Root name="shipping" form="order" />
  <Fieldset.Legend title="Shipping" />
  <Field.Root title="Name" />
  <Field.Label title="Name" />
  <Field.Description title="Name" />
  <Field.Error title="Name" />
  <Field.Item title="Name" />
  <Input placeholder="Name" autocomplete="name" form="order" aria-label="Name" />
  <Checkbox form="order" aria-label="Gift" aria-labelledby="id" />
  <Switch value="yes" form="order" aria-label="Wi-Fi" aria-labelledby="id" />
  <Radio value="s" form="order" aria-label="Small" aria-labelledby="id" />
  <RadioGroup aria-label="Size" aria-labelledby="id" />
  <CheckboxGroup aria-label="Toppings" aria-labelledby="id" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Checkbox :aria-label="5" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Switch :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Radio value="s" :aria-labelledby="5" />
  <!-- @vue-expect-error `placeholder` is a string -->
  <Input :placeholder="5" />
</template>
