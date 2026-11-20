---
order: 1
description: An unstyled Vue OTP field component for one-time password and verification code entry.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

## Examples

### Labeling an OTP field

A native `<label>` names the first input when its `for` is the `id` of `OTPField.Root`. To name the group too, give the label an `id` and the root `aria-labelledby`. Give each other input an `aria-label`, so that a screen reader announces the slot that has the focus. To announce a description with the field, give the root `aria-describedby`.

<<< ./otp-field/NativeLabel.vue{7,9,11}

In a `Field`, `Field.Label` names the group and each input that has no `aria-label` of its own.

### Submitting on completion

Set `autoSubmit` to submit the form of the field when each slot has a character. To act on the completion with no submit, listen to `valueComplete`.

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

Use `normalizeValue` to change the accepted characters before the code changes, for example to make a code uppercase. It runs after the filter of `validationType`, and that filter then runs on its result again. Set `validationType` to `none` when `normalizeValue` is the full rule.

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

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
