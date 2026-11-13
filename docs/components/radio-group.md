---
order: 1
description: An unstyled Vue radio group component that provides shared state to a series of radio buttons.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoRadioGroupHero from '../demos/radio-group/hero/css-modules/index.vue';
</script>

# Radio Group

Provides shared state to a series of radio buttons.

<DemoFrame>
  <DemoRadioGroupHero />
</DemoFrame>

::: code-group

<<< ../demos/radio-group/hero/css-modules/index.vue

<<< ../demos/radio-group/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Name the group with `aria-labelledby`, a `Field.Label` or a `Fieldset.Legend`. Name each radio with a `<label>` element, or with a `Field.Label` in a `Field.Item`. See [Labeling a radio group](#labeling-a-radio-group).

## Anatomy

Import the components and assemble their parts:

<<< ./radio-group/Anatomy.vue

`Radio.Root` renders its element and a hidden `<input type="radio">` after it. The group gives `name` and `form` to each input. A form then submits the value of the checked radio. A group with `required` and no value blocks the submit of the form. A group with `disabled` submits nothing.

Because of the hidden input, `Radio.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

Bind the value with `v-model:value`. The group emits `valueChange` with the new value and `eventDetails`, and then `update:value`. To stop the change, call `eventDetails.cancel()` before the `valueChange` listener returns. The group then emits no `update:value` and keeps its value.

The group exposes `element` and `inputElement` through a template ref. `inputElement` is the hidden input of the checked radio. With no checked radio, it is the first input that is not disabled.

The group has one tab stop. A group with `disabled` has none. In the server HTML, the tab stop is on the checked radio, or on the first radio that is not disabled when the group has no value.

In the server HTML, the group already has the id of its `Field.Label` in `aria-labelledby`, and a radio in a `Field.Item` already has the id of its `Field.Label`. The group and its radios already have the id of a `Field.Description` in `aria-describedby`. A label or a description can come after the part that it names.

## Examples

### Labeling a radio group

Label the group with `aria-labelledby` and a sibling label element:

<<< ./radio-group/GroupLabel.vue{7,8}

An enclosing `<label>` is the simplest labeling pattern for each radio:

<<< ./radio-group/EnclosingLabel.vue{8,11}

To name the group with a `Fieldset.Legend`, render the group in the `#render` slot of `Fieldset.Root`. `RadioGroup` is a generic component, so the type check does not accept it as `as`.

<<< ./radio-group/FieldsetLegend.vue{10-13}

### Rendering as a native button

By default, `Radio.Root` renders a `<span>` element, so a `<label>` can hold it. Render each radio as a native button when a label beside it names it with `for` and `id`.

<<< ./radio-group/SiblingLabel.vue{11}

To put a native button in a `<label>`, use the `#render` slot. The hidden input then stays outside the label, and the HTML stays valid.

<<< ./radio-group/LabelInRenderSlot.vue{10-15}

## API reference

The reference of `Radio.Root` and `Radio.Indicator` is on the [Radio](/components/radio) page.

<ApiReference />
