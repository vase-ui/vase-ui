---
order: 1
description: An unstyled Vue number field component with increment and decrement buttons, and a scrub area.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoNumberFieldHero from '../demos/number-field/hero/css-modules/index.vue';
import DemoNumberFieldHeroTailwind from '../demos/number-field/hero/tailwind/index.vue';
</script>

# Number Field

A numeric input element with increment and decrement buttons, and a scrub area.

<DemoFrame>
  <DemoNumberFieldHero />
  <template #tailwind>
    <DemoNumberFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/number-field/hero/css-modules/index.vue

<<< ../demos/number-field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/number-field/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the input a `<label>` element, or put the number field in a `Field`. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./number-field/Anatomy.vue

`NumberField.Root` renders its element and a hidden `<input type="number">` after it. A form submits the number of that input, not the text of `NumberField.Input`. A reset of the form puts an uncontrolled number field back to `defaultValue`, or to no value when it has none. A controlled number field does not change. In a `Field`, a reset clears the error of the field. The reset starts no validation.

Because of the hidden input, `NumberField.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

Bind the value with `v-model:value`. The root emits `valueChange` with the new value and `eventDetails`, and then `update:value`. To stop the change, call `eventDetails.cancel()` before the `valueChange` listener returns. The root then emits no `update:value` and keeps its value.

With no `locale` prop, the server HTML has the text in the format of `en-US`. When the root is mounted, the text changes to the format of the locale of the browser. Give the root a `locale` prop to get the same text on the server and in the browser.

Text that a visitor types, or that the browser fills, before the page hydrates stays in `NumberField.Input` when the field accepts its characters. After the hydration, the root emits `valueChange` and `update:value` with the number of that text. When the visitor left the input before the page hydrated, the input then also gets `change`, `blur` and `focusout`, and the root emits `valueCommitted`.

The root also takes a number that a program or the browser writes into its hidden input before the page hydrates. It takes a number that the browser restores after a move back in the history or a reload too. It then emits `valueChange` and `update:value` one time. A `valueChange` listener can thus run after a move back with no action of the visitor.

`NumberField.ScrubAreaCursor` renders its element only while the user scrubs. It does not render for a touch, in a WebKit browser such as Safari, or after `requestPointerLock()` throws or rejects.

The part renders its element in a `Teleport`, in the `<body>` of the document of the scrub area. When the scrub area is in a shadow root, such as the root of a Vue custom element, the element is in that root. The styles of the root then apply to it. A rule of `<style scoped>`, `v-show` and a custom directive on the part do not reach the element. `:deep()` does not reach it either. Write the element in the `#render` slot of the part, or use a CSS module or a `style` binding.

The cursor has `position: fixed`. Its containing block is the viewport, or else the nearest ancestor that has a transform, a filter or containment. At each move of the cursor, the scrub area reads the place and the scale of that block, and it puts the cursor at the pointer. It does not correct a rotation or a skew of the block. If the block or an ancestor of the block clips its content, that element also clips the cursor.

## API reference

<ApiReference />
