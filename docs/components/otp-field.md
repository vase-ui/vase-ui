---
order: 1
description: An unstyled Vue OTP field component for one-time password and verification code entry.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoOTPFieldAlphanumeric from '../demos/otp-field/alphanumeric/css-modules/index.vue';
import DemoOTPFieldAlphanumericTailwind from '../demos/otp-field/alphanumeric/tailwind/index.vue';
import DemoOTPFieldCustomNormalize from '../demos/otp-field/custom-sanitize/css-modules/index.vue';
import DemoOTPFieldGrouped from '../demos/otp-field/grouped/css-modules/index.vue';
import DemoOTPFieldGroupedTailwind from '../demos/otp-field/grouped/tailwind/index.vue';
import DemoOTPFieldHero from '../demos/otp-field/hero/css-modules/index.vue';
import DemoOTPFieldHeroTailwind from '../demos/otp-field/hero/tailwind/index.vue';
import DemoOTPFieldPassword from '../demos/otp-field/password/css-modules/index.vue';
import DemoOTPFieldPasswordTailwind from '../demos/otp-field/password/tailwind/index.vue';
</script>

# OTP Field

A one-time password input with one slot for each character.

<DemoFrame>
  <DemoOTPFieldHero />
  <template #tailwind>
    <DemoOTPFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/otp-field/hero/css-modules/index.vue

<<< ../demos/otp-field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/otp-field/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the field a `<label>` element and name the group with it, or put the field in a `Field`. See [Labeling an OTP field](#labeling-an-otp-field) and the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./otp-field/Anatomy.vue

`OTPField.Root` renders a `<div>` with the role `group`. Its last child is a hidden `<input>` that holds the whole code. The hidden input has the `name` of the field and the native validation, so a form submits the code one time. An incomplete code fails the validation. The slots have no `name`.

The `as` prop of the root renders another element or a component in place of the `<div>`, with the hidden input in it. The `element` slot of the root renders your element, and the root then renders the hidden input after your element.

A reset of the form puts the field back to its first value: `defaultValue`, or the model of the mount. The root emits `update:modelValue`, so `v-model` follows. In a `Field`, a reset clears the error of the field. The reset starts no validation.

## Examples

### Labeling an OTP field

Give `OTPField.Root` an `id`, and give a native `<label>` the same value in `for`. The label then names the first input. Give the label an `id`, and give the root `aria-labelledby` with it, so the label names the group too. Give each other input an `aria-label`, so that assistive technology announces the slot that has the focus.

To announce a supporting text with the field, give the root `aria-describedby`.

<<< ./otp-field/NativeLabel.vue{7,9,11}

In a `Field`, `Field.Label` names the group and each input that has no `aria-label` of its own, also in the server HTML.

### Submitting on completion

Set `autoSubmit` to submit the form of the field when each slot has a character. To act on the completion with no submit, listen to `valueComplete`.

Enter in a slot submits the form, as Enter in one text input does. A listener that prevents the `keydown` of Enter stops the submit.

### Alphanumeric verification codes

Set `validationType` to `alphanumeric` for recovery, backup or invite codes that mix letters and numbers.

<DemoFrame>
  <DemoOTPFieldAlphanumeric />
  <template #tailwind>
    <DemoOTPFieldAlphanumericTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/otp-field/alphanumeric/css-modules/index.vue

<<< ../demos/otp-field/alphanumeric/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/otp-field/alphanumeric/tailwind/index.vue

:::

</DemoSource>

### Grouped layouts

Put sets of inputs in your own layout elements. Add `OTPField.Separator` to show the code in smaller groups, such as `123-456`.

<DemoFrame>
  <DemoOTPFieldGrouped />
  <template #tailwind>
    <DemoOTPFieldGroupedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/otp-field/grouped/css-modules/index.vue

<<< ../demos/otp-field/grouped/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/otp-field/grouped/tailwind/index.vue

:::

</DemoSource>

### Custom normalization

Use `normalizeValue` to change the accepted characters before the state changes, for example to make a code uppercase. It runs after the filter of `validationType`, and that filter then applies to its result again. Set `validationType` to `none` when the normalizer is the full validation rule.

Use `inputmode` to give the keyboard a hint for a custom rule. Listen to `valueInvalid` to know when the field refuses characters.

<DemoFrame>
  <DemoOTPFieldCustomNormalize />
</DemoFrame>

::: code-group

<<< ../demos/otp-field/custom-sanitize/css-modules/index.vue

<<< ../demos/otp-field/custom-sanitize/useInvalidFeedback.ts

<<< ../demos/otp-field/custom-sanitize/css-modules/index.module.css

:::

### Masked entry

Give each `OTPField.Input` the attribute `type="password"` to hide the code while the user types it.

<DemoFrame>
  <DemoOTPFieldPassword />
  <template #tailwind>
    <DemoOTPFieldPasswordTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/otp-field/password/css-modules/index.vue

<<< ../demos/otp-field/password/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/otp-field/password/tailwind/index.vue

:::

</DemoSource>

## Styling

Select the states of the group with `[data-complete]`, `[data-filled]`, `[data-disabled]`, `[data-readonly]`, `[data-required]`, `[data-valid]`, `[data-invalid]`, `[data-touched]` and `[data-dirty]`. Select a field that has the focus with `:focus-within`.

Select the states of an input with these selectors:

| Selector                | State                               |
| ----------------------- | ----------------------------------- |
| `:focus`                | The input has the focus.            |
| `[data-filled]`         | The input has a character.          |
| `[data-complete]`       | Each input has a character.         |
| `:disabled`             | The field is disabled.              |
| `:read-only`            | The field is read-only or disabled. |
| `:required`             | The field is required.              |
| `[aria-invalid='true']` | The field is invalid.               |

The hidden input is the last child of the group, and it is an `<input>` too. Give the last slot a class of its own, and do not select it with `:last-child` or `:last-of-type`.

## API reference

<ApiReference />
