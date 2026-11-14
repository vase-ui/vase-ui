---
order: 1
description: An unstyled Vue number field component with increment and decrement buttons, and a scrub area.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoNumberFieldHero from '../demos/number-field/hero/css-modules/index.vue';
</script>

# Number Field

A numeric input element with increment and decrement buttons, and a scrub area.

<DemoFrame>
  <DemoNumberFieldHero />
</DemoFrame>

::: code-group

<<< ../demos/number-field/hero/css-modules/index.vue

<<< ../demos/number-field/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Give the input a `<label>` element, or put the number field in a `Field`.

## Anatomy

Import the component and assemble its parts:

<<< ./number-field/Anatomy.vue

`NumberField.Root` renders its element and a hidden `<input type="number">` after it. A form submits the number of that input, not the text of `NumberField.Input`. A reset of the form puts an uncontrolled number field back to `defaultValue`, or to no value when it has none. A controlled number field does not change. In a `Field`, a reset clears the error of the field. The reset starts no validation.

Because of the hidden input, `NumberField.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

Bind the value with `v-model:value`. The root emits `valueChange` with the new value and `eventDetails`, and then `update:value`. To stop the change, call `eventDetails.cancel()` before the `valueChange` listener returns. The root then emits no `update:value` and keeps its value.

With no `locale` prop, the server HTML has the text in the format of `en-US`. When the root is mounted, the text changes to the format of the locale of the browser. Give the root a `locale` prop to get the same text on the server and in the browser.

`NumberField.ScrubAreaCursor` renders its element in `<body>`, and only while the user scrubs. It does not render for a touch, in a WebKit browser such as Safari, or after `requestPointerLock()` throws or rejects.

## API reference

<ApiReference />
