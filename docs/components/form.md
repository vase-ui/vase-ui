---
order: 1
description: An unstyled Vue form component that validates its fields and gives each field its errors.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoFormFormAction from '../demos/form/form-action/css-modules/index.vue';
import DemoFormFormActionTailwind from '../demos/form/form-action/tailwind/index.vue';
import DemoFormHero from '../demos/form/hero/css-modules/index.vue';
import DemoFormHeroTailwind from '../demos/form/hero/tailwind/index.vue';
import DemoFormZod from '../demos/form/zod/css-modules/index.vue';
import DemoFormZodTailwind from '../demos/form/zod/tailwind/index.vue';
</script>

# Form

A native form element that validates its fields and gives each field its errors.

<DemoFrame>
  <DemoFormHero />
  <template #tailwind>
    <DemoFormHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/form/hero/css-modules/index.vue

<<< ../demos/form/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/form/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the components and assemble their parts:

<<< ./form/Anatomy.vue

## Examples

### Submit to a server

To submit the form to a server, send the `FormData` of the form in a `submit` listener. Give the errors of the response to `v-model:errors`.

The demo keeps the response in one state object. It disables the button while the request runs.

<DemoFrame>
  <DemoFormFormAction />
  <template #tailwind>
    <DemoFormFormActionTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/form/form-action/css-modules/index.vue

<<< ../demos/form/form-action/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/form/form-action/tailwind/index.vue

:::

</DemoSource>

### Submit form values as a JavaScript object

The second argument of `submit` has the values of the form in an object, by the `name` of each field that is not disabled. Use it to change the values before you send them, or to send them to an API. Each value has the type that its control gives. `Input` gives a string, `Checkbox` and `Switch` give a boolean, and `RadioGroup` and `CheckboxGroup` give their value.

<<< ./form/FormSubmit.vue

Give the second parameter of the listener the type of the values. With no type, that parameter is `any`.

### Using with Zod

When you parse the schema with `schema.safeParse()`, use `z.flattenError(result.error).fieldErrors` to map the errors to the `name` of each field.

<DemoFrame>
  <DemoFormZod />
  <template #tailwind>
    <DemoFormZodTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/form/zod/css-modules/index.vue

<<< ../demos/form/zod/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/form/zod/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
