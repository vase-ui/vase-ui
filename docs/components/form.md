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

`Form` renders a `<form>` with `novalidate`. A submit validates each field of the form. A submit that a field blocks is prevented, and the first invalid control gets the focus. A submit that passes emits `submit` with the native `SubmitEvent` and the values of the form. While `Form` has a `submit` listener, it prevents the native submit, so the page stays. Give `@submit` a function, because `Form` can miss a listener that you add or remove after the mount. To keep the native submit to the `action` URL, give `Form` no `submit` listener.

`errors` makes a field invalid by its `name`. Bind it with `v-model:errors`: an edit of a field asks to remove its key. After a submit that passed, the first change of `errors` moves the focus to the first invalid control.

The template ref of `Form` has `validate(name?)`. It validates each field, or the field of one name, and returns `true` when they are valid.

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

The second argument of `submit` has the value of each named field of the form whose control is enabled. Each value has the type that the control gives: a string for `Input`, a boolean for `Checkbox` and `Switch`, and the value of a `RadioGroup` or of a `CheckboxGroup`.

<<< ./form/FormSubmit.vue

Give the second parameter of the listener the type of the form values. With no type, that parameter is `any`.

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
