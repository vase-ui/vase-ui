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

- **Form controls must have an accessible name**: Give the field a `<label>` element, or put it in a `Field`. See [Labeling an OTP field](#labeling-an-otp-field) and the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./otp-field/Anatomy.vue

`OTPField.Root` renders its element and a hidden `<input>` after it. The hidden input holds the whole code. It has the `name` of the field and the native validation, so a form submits the code one time. The slots have no `name`.

A reset of the form puts an uncontrolled field back to `defaultValue`. A controlled field does not change. In a `Field`, a reset clears the error of the field. The reset starts no validation.

Because of the hidden input, `OTPField.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

Characters that a visitor types, or that the browser fills, before the page hydrates stay in the slots when the field accepts them. After the hydration, the root emits `valueChange` and `update:modelValue` with them. A complete code emits `valueComplete`, and with `autoSubmit` the root submits the form. When the visitor left a slot before the page hydrated, the slot then also gets `change`, `blur` and `focusout`. After a move in the history of the browser or a reload of the page, the slots take no characters from before the hydration. The root thus does not complete or submit a code that the browser restored.

The hidden input takes a code that a program or the browser writes into it before the page hydrates, as an autofill. The root then emits `valueChange` and `valueComplete`, and with `autoSubmit` it submits the form. The focus does not move for that code. After a move in the history or a reload, the hidden input takes no code from before the hydration. When the browser restores the form state of the page, the root writes its own value back to the hidden input and the slots.

## Examples

### Labeling an OTP field

Give `OTPField.Root` an `id`, and give a native `<label>` the same value in `for`. The first input takes the label of the field. Give each other input an `aria-label`, so that assistive technology announces the slot that has the focus.

To announce a supporting text with the field, give the root `aria-describedby`.

<<< ./otp-field/NativeLabel.vue{7,9}

A native `<label>` names only the first input, through `for`, and the group has no name from it. In a `Field`, `Field.Label` names the group and each input that has no `aria-label` of its own, also in the server HTML.

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

Use `normalizeValue` to change the accepted characters before the state changes, for example to make a code uppercase. It runs after the filter of `validationType`, and that filter then applies to its result again. Set `validationType` to `none` when the normalizer is the full validation rule.

Use `inputMode` to give the keyboard a hint for a custom rule. Listen to `valueInvalid` to know when the field refuses characters.

<DemoFrame>
  <DemoOTPFieldCustomNormalize />
</DemoFrame>

::: code-group

<<< ../demos/otp-field/custom-sanitize/css-modules/index.vue

<<< ../demos/otp-field/custom-sanitize/useInvalidFeedback.ts

<<< ../demos/otp-field/custom-sanitize/css-modules/index.module.css

:::

### Masked entry

Set `mask` to hide the code while the user types it.

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
