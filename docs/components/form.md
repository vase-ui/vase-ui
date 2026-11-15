---
order: 1
description: An unstyled Vue form component with consolidated error handling.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

A native form element with consolidated error handling.

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

Form works together with [Field](/components/field). Import the components and place them together:

<<< ./form/Anatomy.vue

`Form` emits `submit` after its validation, and only when each field is valid. The listener gets the native `SubmitEvent`.

`Form` exposes `validate()`. Call it through a template ref to validate each field, or give it the name of one field.

## Examples

### Submit to a server

To submit the form to a server, call `event.preventDefault()` in a `submit` listener. Then send the `FormData` of the form. Give the errors of the response to the `errors` prop.

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

Use `@form-submit` in place of the native `submit` listener to get the form values as a JavaScript object. This is useful when you must change the values before the request, or when you use a third-party API.

<<< ./form/FormSubmit.vue

Give the first parameter of the listener the type of the form values. With no type, that parameter is `any`.

When you use `@form-submit`, `Form` calls `preventDefault()` on the native submit event.

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
