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

## Examples

### Using with other components

Give a part of another component to the `as` prop of a toolbar part. The two parts then share one element. The element joins the keyboard navigation of the toolbar and keeps the behavior of the other part. Use `as` for a part that is not generic and needs no props of its own. The demo at the top of this page does this for `Toggle`.

When the other part needs props or listeners of its own, render it in the `#render` slot. Bind `props` on it. Render a generic part in the `#render` slot too. The type of `as` does not accept a generic component. A popup trigger is a generic part. The demo at the top of this page renders `Select.Trigger` in the slot, and this sample renders `Menu.Trigger`:

<<< ./toolbar/MenuInToolbar.vue{9-13}

- **Popups with a trigger**: render the trigger in the `#render` slot of `<Toolbar.Button>`, as shown above. This works for Alert Dialog, Dialog, Drawer, Menu, Popover and Select. Set `disabled` on `<Toolbar.Button>`, not on the trigger. The button then stays in the keyboard navigation of the toolbar.
- **Tooltip**: render `<Toolbar.Button>` in the `#render` slot of `<Tooltip.Trigger>`.
- **Number Field**: give `NumberField.Input` to the `as` prop of `<Toolbar.Input>`. Put the input inside `<NumberField.Root>` and `<NumberField.Group>`, with the increment and decrement buttons.

See [how props are merged](/handbook/composition#how-props-are-merged) for how the two parts combine.

## API reference

<ApiReference />
