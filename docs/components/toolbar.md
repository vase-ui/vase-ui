---
order: 1
description: An unstyled Vue toolbar component that groups a set of buttons and controls.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoToolbarHero from '../demos/toolbar/hero/css-modules/index.vue';
</script>

# Toolbar

A container that groups a set of buttons and controls.

<DemoFrame>
  <DemoToolbarHero />
</DemoFrame>

::: code-group

<<< ../demos/toolbar/hero/css-modules/index.vue

<<< ../demos/toolbar/hero/css-modules/index.module.css

:::

## Usage guidelines

To make a toolbar accessible and helpful, follow these guidelines:

- **Use inputs sparingly**: In an input, the left and right arrow keys move the text cursor. In a horizontal toolbar, the same keys move the focus between the controls. Put at most one input in a horizontal toolbar. Make it the last element of the toolbar.

## Anatomy

Import the component and assemble its parts:

<<< ./toolbar/Anatomy.vue

Text that a visitor types, or that the browser fills, before the page hydrates stays in `Toolbar.Input`. After the hydration, an `input` listener of `Toolbar.Input` runs with that text. When the visitor left the input before the page hydrated, the input then also gets `change`, `blur` and `focusout`.

## Examples

### Using with other components

Give a part of another component to the `as` prop of a toolbar part. The two parts then share one element. The element joins the keyboard navigation of the toolbar and keeps the behavior of the other part. The demo at the top of this page does this for `Toggle` and `Select.Trigger`, and this sample does it for `Menu.Trigger`:

<<< ./toolbar/MenuInToolbar.vue{9}

When the other part needs props or listeners of its own, render it in the `#render` slot. Bind `props` on it.

- **Popups with a trigger**: give the trigger to the `as` prop of `<Toolbar.Button>`, as shown above. This works for Alert Dialog, Dialog, Drawer, Menu, Popover and Select. Set `disabled` on `<Toolbar.Button>`, not on the trigger. The button then stays in the keyboard navigation of the toolbar.
- **Tooltip**: give `Toolbar.Button` to the `as` prop of `<Tooltip.Trigger>`. To disable the button, render `<Toolbar.Button disabled>` in the `#render` slot of `<Tooltip.Trigger>`. With the `disabled` prop of `<Tooltip.Trigger>`, the trigger does not open the tooltip, and the button stays enabled.
- **Number Field**: give `NumberField.Input` to the `as` prop of `<Toolbar.Input>`. Put the input inside `<NumberField.Root>` and `<NumberField.Group>`, with the increment and decrement buttons.

See [how props are merged](/handbook/composition#how-props-are-merged) for how the two parts combine.

## API reference

<ApiReference />
