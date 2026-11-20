---
order: 1
description: An unstyled Vue toolbar component that groups a set of buttons and controls.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoToolbarHero from '../demos/toolbar/hero/css-modules/index.vue';
import DemoToolbarHeroTailwind from '../demos/toolbar/hero/tailwind/index.vue';
</script>

# Toolbar

A container that groups a set of buttons and controls.

<DemoFrame>
  <DemoToolbarHero />
  <template #tailwind>
    <DemoToolbarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toolbar/hero/css-modules/index.vue

<<< ../demos/toolbar/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toolbar/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

To make a toolbar accessible and helpful, follow these guidelines:

- **Use inputs sparingly**: In an input, the left and right arrow keys move the text cursor. In a horizontal toolbar, the same keys move the focus between the controls. Put at most one input in a horizontal toolbar. Make it the last element of the toolbar.

## Anatomy

Import the component and assemble its parts:

<<< ./toolbar/Anatomy.vue

`Toolbar.Root` renders a `<div role="toolbar">` with `aria-orientation`. `Toolbar.Button`, `Toolbar.Input` and `Toolbar.Link` are its items, also inside a `Toolbar.Group`. `Toolbar.Button` renders a `<button type="button">`, `Toolbar.Input` renders the [Input](/components/input) part, and `Toolbar.Link` renders an `<a>`. Give `v-model` to `Toolbar.Input` for its text. `Toolbar.Separator` renders a [Separator](/components/separator) across the toolbar.

The toolbar is one tab stop: the item that had the focus last, or else the first item. Do not give a `tabindex` to a part, because the toolbar then has more than one tab stop. Before the page hydrates, each item is a tab stop of its own.

| Key                      | Action                                                                    |
| ------------------------ | ------------------------------------------------------------------------- |
| ArrowRight and ArrowLeft | In a horizontal toolbar, move the focus to the next or the previous item. |
| ArrowDown and ArrowUp    | In a vertical toolbar, move the focus to the next or the previous item.   |
| Tab and Shift+Tab        | Move the focus out of the toolbar, or into it at its tab stop.            |
| Enter and Space          | Operate the item that has the focus.                                      |

With right-to-left text, ArrowLeft moves to the next item of a horizontal toolbar. The arrow keys go from the last item to the first, unless `loopFocus` is `false`. The two keys of the toolbar never reach the item, so a menu trigger in a vertical toolbar does not open at ArrowDown. The keys of the other axis stay with the item.

A text input keeps ArrowLeft and ArrowRight while its caret can move. The toolbar selects the text of an input when a key moves the focus to it. A textarea also keeps ArrowUp and ArrowDown while its caret can move.

To take an item out of the toolbar, remove it with `v-if`. The arrow keys pass an item that CSS hides, but a hidden item can still be the tab stop.

### Disabled items

A disabled button or input keeps the focus, and the arrow keys still reach it. It has `aria-disabled="true"` and no `disabled`. A disabled input is also read-only. The toolbar stops a click, a press and each key on a disabled item, so no listener of the item gets them. Tab, Escape, F1 to F12 and the keys with Ctrl, Alt or Meta pass. Hover and focus events also pass, so a tooltip can say why the item is disabled.

With `focusableWhenDisabled` set to `false`, a disabled item has `disabled`, and the arrow keys pass it. A disabled toolbar or group disables each button and input in it. A link is never disabled.

## Styling

| Selector                        | State                                                 |
| ------------------------------- | ----------------------------------------------------- |
| `[aria-orientation='vertical']` | On `Toolbar.Root`: the toolbar is vertical.           |
| `[data-orientation='vertical']` | On a group, a button, an input or a link.             |
| `[data-disabled]`               | On `Toolbar.Root` or `Toolbar.Group`: it is disabled. |
| `[aria-disabled='true']`        | A disabled item that keeps the focus.                 |
| `:disabled`                     | A disabled item with `focusableWhenDisabled` `false`. |
| `:focus-visible`                | The item has the focus from the keyboard.             |

## Examples

### Using with other components

Render a part of another component in the `element` slot of a toolbar part. Bind `props` and `elementRef` to it. The part then joins the keyboard navigation of the toolbar and keeps its own behavior. The demo at the top of this page does this for `Toggle` and `Select.Trigger`, and this sample does it for `Menu.Trigger`:

<<< ./toolbar/MenuInToolbar.vue{8-10}

- **Popups with a trigger**: render the trigger in the slot of `<Toolbar.Button>`. This works for Alert Dialog, Dialog, Drawer, Menu, Popover and Select. Set `disabled` on `<Toolbar.Button>`, not on the trigger. The trigger then keeps the focus and opens nothing.
- **Tooltips**: render `<Toolbar.Button>` in the `element` slot of `<Tooltip.Trigger>`. Set `disabled` on `<Toolbar.Button>`. The button then keeps the focus, and its tooltip still opens at a hover.
- **Toggle**: render a `Toggle` in the slot of `<Toolbar.Button>`. Each toggle of a `ToggleGroup` in the toolbar is an item with no wrapper.
- **Inputs**: render a `Switch`, a `Checkbox`, a `Radio` or a `NumberField.Input` in the slot of `<Toolbar.Input>`. `Toolbar.Input` then renders no `Input` and owns no text, so give `v-model` to the part in the slot.

See [how props are merged](/handbook/composition#how-props-are-merged) for how the two parts combine.

## API reference

<ApiReference />
