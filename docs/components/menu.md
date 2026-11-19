---
order: 1
description: An unstyled Vue menu component that shows a list of actions in a dropdown, with keyboard navigation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoMenuArrow from '../demos/menu/arrow/css-modules/index.vue';
import DemoMenuArrowTailwind from '../demos/menu/arrow/tailwind/index.vue';
import DemoMenuCheckboxItems from '../demos/menu/checkbox-items/css-modules/index.vue';
import DemoMenuCheckboxItemsTailwind from '../demos/menu/checkbox-items/tailwind/index.vue';
import DemoMenuDetachedTriggersControlled from '../demos/menu/detached-triggers-controlled/css-modules/index.vue';
import DemoMenuDetachedTriggersControlledTailwind from '../demos/menu/detached-triggers-controlled/tailwind/index.vue';
import DemoMenuDetachedTriggersFull from '../demos/menu/detached-triggers-full/css-modules/index.vue';
import DemoMenuDetachedTriggersFullTailwind from '../demos/menu/detached-triggers-full/tailwind/index.vue';
import DemoMenuDetachedTriggersSimple from '../demos/menu/detached-triggers-simple/css-modules/index.vue';
import DemoMenuDetachedTriggersSimpleTailwind from '../demos/menu/detached-triggers-simple/tailwind/index.vue';
import DemoMenuFilter from '../demos/menu/filter/css-modules/index.vue';
import DemoMenuFilterTailwind from '../demos/menu/filter/tailwind/index.vue';
import DemoMenuGroupLabels from '../demos/menu/group-labels/css-modules/index.vue';
import DemoMenuGroupLabelsTailwind from '../demos/menu/group-labels/tailwind/index.vue';
import DemoMenuHero from '../demos/menu/hero/css-modules/index.vue';
import DemoMenuHeroTailwind from '../demos/menu/hero/tailwind/index.vue';
import DemoMenuOpenOnHover from '../demos/menu/open-on-hover/css-modules/index.vue';
import DemoMenuOpenOnHoverTailwind from '../demos/menu/open-on-hover/tailwind/index.vue';
import DemoMenuRadioItems from '../demos/menu/radio-items/css-modules/index.vue';
import DemoMenuRadioItemsTailwind from '../demos/menu/radio-items/tailwind/index.vue';
import DemoMenuSubmenu from '../demos/menu/submenu/css-modules/index.vue';
import DemoMenuSubmenuTailwind from '../demos/menu/submenu/tailwind/index.vue';
</script>

# Menu

A list of actions in a dropdown, with keyboard navigation.

<DemoFrame>
  <DemoMenuHero />
  <template #tailwind>
    <DemoMenuHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/hero/css-modules/index.vue

<<< ../demos/menu/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./menu/Anatomy.vue

## Examples

### Open on hover

To open the menu when the pointer is on the trigger, set the `openOnHover` prop of `<Menu.Trigger>`.

In a [menubar](/components/menubar), the pointer on a trigger opens its menu while another menu of the menubar is open. Give a [`Menu.Trigger` wrapper](/handbook/composition#wrap-a-part) the `openOnHover` default `undefined` to keep this behavior.

The `delay` prop gives the time in milliseconds to wait before the menu opens on hover.

<DemoFrame>
  <DemoMenuOpenOnHover />
  <template #tailwind>
    <DemoMenuOpenOnHoverTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/open-on-hover/css-modules/index.vue

<<< ../demos/menu/open-on-hover/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/open-on-hover/tailwind/index.vue

:::

</DemoSource>

### Checkbox items

Use `<Menu.CheckboxItem>` for an item that turns a setting on or off. Bind its state with `v-model`.

<DemoFrame>
  <DemoMenuCheckboxItems />
  <template #tailwind>
    <DemoMenuCheckboxItemsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/checkbox-items/css-modules/index.vue

<<< ../demos/menu/checkbox-items/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/checkbox-items/tailwind/index.vue

:::

</DemoSource>

### Radio items

Use `<Menu.RadioGroup>` and `<Menu.RadioItem>` for items that work like radio buttons. Bind the selected value with `v-model` on the group.

<DemoFrame>
  <DemoMenuRadioItems />
  <template #tailwind>
    <DemoMenuRadioItemsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/radio-items/css-modules/index.vue

<<< ../demos/menu/radio-items/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/radio-items/tailwind/index.vue

:::

</DemoSource>

### Close on click

Use the `closeOnClick` prop to set whether a click on an item closes the menu. `<Menu.Item>` closes the menu by default. `<Menu.CheckboxItem>`, `<Menu.RadioItem>` and `<Menu.LinkItem>` keep it open by default.

<<< ./menu/CloseOnClick.vue{12,15}

### Group labels

Use `<Menu.GroupLabel>` to add a label to a `<Menu.Group>` or a `<Menu.RadioGroup>`. The group gets its `aria-labelledby` from the label.

<DemoFrame>
  <DemoMenuGroupLabels />
  <template #tailwind>
    <DemoMenuGroupLabelsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/group-labels/css-modules/index.vue

<<< ../demos/menu/group-labels/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/group-labels/tailwind/index.vue

:::

</DemoSource>

### Nested menu

To make a submenu, put a `<Menu.SubmenuRoot>` in the parent menu. Use `<Menu.SubmenuTrigger>` for the item that opens the nested menu.

<<< ./menu/Submenu.vue{13-22}

<DemoFrame>
  <DemoMenuSubmenu />
  <template #tailwind>
    <DemoMenuSubmenuTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/submenu/css-modules/index.vue

<<< ../demos/menu/submenu/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/submenu/tailwind/index.vue

:::

</DemoSource>

### Navigate to another page

Use `<Menu.LinkItem>` to make a link.

<<< ./menu/LinkItem.vue{11}

### Detached triggers

A trigger can be inside or outside `<Menu.Root>`. For a simple interaction, put `<Menu.Trigger>` inside `<Menu.Root>`, as the demo at the top of this page does.

If the menu cannot be next to its trigger, use a detached trigger. Put `<Menu.Trigger>` outside `<Menu.Root>`, and connect the two with a handle from `Menu.createHandle()`. Only a menu at the top level can have a detached trigger. A submenu has its trigger in its `<Menu.SubmenuRoot>`.

The methods of the handle, `open()` and `close()`, need a mounted `<Menu.Root>` with the same handle. The handle ignores a call while no root uses it: before a root mounts, and after it unmounts. A development build shows a warning for that call. Each root that mounts starts with a new state. It does not replay an earlier call, and it does not keep the open state of an earlier root.

<<< ./menu/DetachedTriggers.vue{4,8,10}

<DemoFrame>
  <DemoMenuDetachedTriggersSimple />
  <template #tailwind>
    <DemoMenuDetachedTriggersSimpleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/detached-triggers-simple/css-modules/index.vue

<<< ../demos/menu/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/detached-triggers-simple/tailwind/index.vue

:::

</DemoSource>

### Multiple triggers

One menu can have more than one trigger. Give the same `handle` to more than one detached trigger, or put more than one `<Menu.Trigger>` in one `<Menu.Root>`.

<<< ./menu/MultipleTriggers.vue

<<< ./menu/MultipleDetachedTriggers.vue

The menu can show a different content for each trigger. Give a `payload` to each `<Menu.Trigger>`. The default slot of `<Menu.Root>` gets the `payload` of the active trigger.

The type argument of `createHandle()` gives the payload its type:

<<< ./menu/DetachedTriggersPayload.vue{9,13,15,17,22}

### Controlled mode with multiple triggers

To control the open state, use `v-model:open` on `<Menu.Root>`, or the `open` prop with the `openChange` event. With more than one trigger, control the active trigger with the `triggerId` prop of `<Menu.Root>` and the `id` prop of each `<Menu.Trigger>`.

The root has no event for a change of the trigger. The `openChange` event gives a second argument, `eventDetails`. Its `trigger` is the trigger element that started the change.

<DemoFrame>
  <DemoMenuDetachedTriggersControlled />
  <template #tailwind>
    <DemoMenuDetachedTriggersControlledTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/detached-triggers-controlled/css-modules/index.vue

<<< ../demos/menu/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/detached-triggers-controlled/tailwind/index.vue

:::

</DemoSource>

### Arrow

Use `<Menu.Arrow>` in the popup to connect the menu to its trigger.

<DemoFrame>
  <DemoMenuArrow />
  <template #tailwind>
    <DemoMenuArrowTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/arrow/css-modules/index.vue

<<< ../demos/menu/arrow/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/arrow/tailwind/index.vue

:::

</DemoSource>

### Animating the Menu

A menu can animate its position, its size and its content when it moves from one trigger to another.

#### Position and size

To animate the position, add CSS transitions for `left`, `right`, `top` and `bottom` to the Positioner part. To animate the size, add transitions for `width` and `height` to the Popup part.

#### Content

A menu can animate its content when each trigger has a different content.

Put the content in `<Menu.Viewport>`. Its `div` has the `data-activation-direction` attribute, which gives the position of the new trigger relative to the old trigger. The value has at most two tokens, one for each axis: `left` or `right`, and `up` or `down`, for example `right down`. Match one token with the `~=` attribute selector, such as `[data-activation-direction~='right']`.

In `<Menu.Viewport>`, a `div` holds each content. Use their attributes to style the animations:

- `data-current`: the content that shows when no transition runs, or the new content in a transition.
- `data-previous`: the old content in a transition.

Use `Menu.Viewport` only when one popup has more than one trigger, the content changes with the trigger, and the change is animated. With a viewport, set `width: var(--positioner-width)` and `height: var(--positioner-height)` on the Positioner. Its box then keeps the measured size during the transition. Without these styles, the size of the content can change the size of the popup in each frame, or move the popup to another side.

<DemoFrame>
  <DemoMenuDetachedTriggersFull />
  <template #tailwind>
    <DemoMenuDetachedTriggersFullTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/detached-triggers-full/css-modules/index.vue

<<< ../demos/menu/_index.module.css

<<< ../demos/menu/detached-triggers-full/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/detached-triggers-full/tailwind/index.vue

:::

</DemoSource>

### Filtering [Preview]

Wrap `<Menu.Root>` in `<Menu.FilterProvider>`, add `<Menu.Input>` to the popup, and put the items in `<Menu.List>`.

<<< ./menu/Filter.vue

Label the input with `aria-label`, `aria-labelledby` or a visible `<label>`. Type to narrow the actions, then use the arrow keys to move through the items that match.

<DemoFrame>
  <DemoMenuFilter />
  <template #tailwind>
    <DemoMenuFilterTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menu/filter/css-modules/index.vue

<<< ../demos/menu/filter/css-modules/FilterableSubmenu.vue

<<< ../demos/menu/filter/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menu/filter/tailwind/index.vue

<<< ../demos/menu/filter/tailwind/FilterableSubmenu.vue

<<< ../demos/menu/filter/tailwind/classes.ts

:::

</DemoSource>

#### Matching items

An item matches its text by default. Use `label` to change that text.

<<< ./menu/Label.vue{14}

A group with no matching items gets the `hidden` attribute and stays mounted. If your styles set `display` on a group, add a `[hidden]` rule, so that the group still hides.

```css
.Group {
  display: flex;
}

.Group[hidden] {
  display: none;
}
```

`<Menu.Empty>` shows when no item matches.

By default, an item matches when its text contains the query. The match ignores case, accents and punctuation. Use `filter` to set your own rule. It gets the text of each item and the trimmed query, and it keeps the item when it returns `true`. `Menu.useFilter` gives the same locale-aware comparisons.

<<< ./menu/CustomMatching.vue{4,8}

For external filtering, set `filter` to `null` and render the results yourself. Leave out the groups that have no result.

<<< ./menu/ExternalFiltering.vue{7-9,13,21}

#### Controlling the query

Control the query with `v-model` on `<Menu.FilterProvider>`, or with its `modelValue` prop and its `valueChange` event. The query resets to an empty string when the menu closes. The `valueChange` event reports that change with the reason `'popup-close'`. Call `eventDetails.cancel()` to keep the query.

#### Highlighting

Set `autoHighlight` to highlight the first match while the query is not empty. Set it to `"always"` to highlight the first match when the query is empty too. The highlighted item has the `data-highlighted` attribute, and the `itemHighlighted` event of `<Menu.Root>` reports each change.

#### Focus and keyboard

When a click or the keyboard opens the menu, the input gets the focus. A hover, a touch or a pen does not move the focus to the input, so the on-screen keyboard stays hidden. The arrow keys move the highlight while the input keeps the focus. <kbd>Tab</kbd> closes the menu, and <kbd>Shift</kbd>+<kbd>Tab</kbd> returns the focus to the trigger. The popup is a `dialog` that holds the `searchbox` input and the `menu` list.

#### Submenus

Wrap each searchable `<Menu.SubmenuRoot>` in its own `<Menu.FilterProvider>`. A submenu with no provider stays unfiltered.

#### Filtering with detached triggers

Give the same handle from `Menu.createHandle()` to the root and to its detached trigger:

<<< ./menu/DetachedFilter.vue{4,8,11}

## Portal target

Set `to` on `Menu.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## useFilter

`Menu.useFilter` returns the functions `contains`, `startsWith` and `endsWith`. They compare a text with a query in the locale of the user. Use them when you filter the items yourself.

<ApiReference name="Menu.useFilter" :heading-level="3" />

## createHandle

Creates a handle that connects a `<Menu.Root>` with detached `<Menu.Trigger>` parts. The type argument of the function is the type of the payload.

<ApiReference name="Menu.createHandle" :heading-level="3" />

### Handle

`Menu.createHandle()` returns a `Menu.Handle`. Give it to the `handle` prop of the root and of each trigger outside the root.

<ApiReference name="Menu.Handle" :heading-level="4" />

While a root is mounted, `open()` throws when the handle has no trigger with that `id`.
