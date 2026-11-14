---
order: 1
description: An unstyled Vue OTP field component for one-time password and verification code entry.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoOTPFieldAlphanumeric from '../demos/otp-field/alphanumeric/css-modules/index.vue';
import DemoOTPFieldCustomNormalize from '../demos/otp-field/custom-sanitize/css-modules/index.vue';
import DemoOTPFieldGrouped from '../demos/otp-field/grouped/css-modules/index.vue';
import DemoOTPFieldHero from '../demos/otp-field/hero/css-modules/index.vue';
import DemoOTPFieldPassword from '../demos/otp-field/password/css-modules/index.vue';
</script>

# OTP Field

A one-time password input with one slot for each character.

<DemoFrame>
  <DemoOTPFieldHero />
</DemoFrame>

::: code-group

<<< ../demos/otp-field/hero/css-modules/index.vue

<<< ../demos/otp-field/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Give the field a `<label>` element, or put it in a `Field`. See [Labeling an OTP field](#labeling-an-otp-field) and the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./otp-field/Anatomy.vue

`OTPField.Root` renders its element and a hidden `<input>` after it. The hidden input holds the whole code. It has the `name` of the field and the native validation, so a form submits the code one time. The slots have no `name`.

A reset of the form puts an uncontrolled field back to `defaultValue`. A controlled field does not change. In a `Field`, a reset clears the error of the field. The reset starts no validation.

Because of the hidden input, `OTPField.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

## Examples

### Labeling an OTP field

Give `OTPField.Root` an `id`, and give a native `<label>` the same value in `for`. The first input takes the label of the field. Give each other input an `aria-label`, so that assistive technology announces the slot that has the focus.

To announce a supporting text with the field, give the root `aria-describedby`.

<<< ./otp-field/NativeLabel.vue{7,9}

In the server HTML, a native `<label>` names only the first input, through `for`. The group gets the name of the label after the page hydrates, because a server has no DOM. In a `Field`, the server HTML names the group with `Field.Label`. It also names each input that has no `aria-label` of its own.

### Submitting on completion

Set `autoSubmit` to submit the form of the field when each slot has a character. To act on the completion with no submit, listen to `valueComplete`.

### Alphanumeric verification codes

Set `validationType` to `alphanumeric` for recovery, backup or invite codes that mix letters and numbers.

<DemoFrame>
  <DemoOTPFieldAlphanumeric />
</DemoFrame>

::: code-group

<<< ../demos/otp-field/alphanumeric/css-modules/index.vue

<<< ../demos/otp-field/alphanumeric/css-modules/index.module.css

:::

### Grouped layouts

Put sets of inputs in your own layout elements. Add `OTPField.Separator` to show the code in smaller groups, such as `123-456`.

<DemoFrame>
  <DemoOTPFieldGrouped />
</DemoFrame>

::: code-group

<<< ../demos/otp-field/grouped/css-modules/index.vue

<<< ../demos/otp-field/grouped/css-modules/index.module.css

:::

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
</DemoFrame>

::: code-group

<<< ../demos/otp-field/password/css-modules/index.vue

<<< ../demos/otp-field/password/css-modules/index.module.css

:::

## API reference

<ApiReference />
