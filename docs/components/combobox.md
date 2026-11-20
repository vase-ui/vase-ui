---
order: 1
description: An unstyled Vue combobox component that renders an input combined with a list of predefined items to select.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoComboboxAsyncMultiple from '../demos/combobox/async-multiple/css-modules/index.vue';
import DemoComboboxAsyncMultipleTailwind from '../demos/combobox/async-multiple/tailwind/index.vue';
import DemoComboboxAsyncSingle from '../demos/combobox/async-single/css-modules/index.vue';
import DemoComboboxAsyncSingleTailwind from '../demos/combobox/async-single/tailwind/index.vue';
import DemoComboboxCreateItems from '../demos/combobox/create-items/css-modules/index.vue';
import DemoComboboxCreateItemsTailwind from '../demos/combobox/create-items/tailwind/index.vue';
import DemoComboboxGrouped from '../demos/combobox/grouped/css-modules/index.vue';
import DemoComboboxGroupedTailwind from '../demos/combobox/grouped/tailwind/index.vue';
import DemoComboboxHero from '../demos/combobox/hero/css-modules/index.vue';
import DemoComboboxHeroTailwind from '../demos/combobox/hero/tailwind/index.vue';
import DemoComboboxInputInsidePopup from '../demos/combobox/input-inside-popup/css-modules/index.vue';
import DemoComboboxInputInsidePopupTailwind from '../demos/combobox/input-inside-popup/tailwind/index.vue';
import DemoComboboxMultiple from '../demos/combobox/multiple/css-modules/index.vue';
import DemoComboboxMultipleTailwind from '../demos/combobox/multiple/tailwind/index.vue';
import DemoComboboxVirtualized from '../demos/combobox/virtualized/css-modules/index.vue';
import DemoComboboxVirtualizedTailwind from '../demos/combobox/virtualized/tailwind/index.vue';
</script>

# Combobox

An input combined with a list of predefined items to select.

<DemoFrame>
  <DemoComboboxHero />
  <template #tailwind>
    <DemoComboboxHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/hero/css-modules/index.vue

<<< ../demos/combobox/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Combobox is a Select with a filter**: Use Combobox when the value must be one of a set of predefined items. It works like [Select](/components/select), but the user types in an input to filter the items. Prefer Combobox to Select when the list is long enough to need a filter.
- **Avoid for search widgets**: Combobox does not accept free-form text. For a search widget, use [Autocomplete](/components/autocomplete).
- **Avoid when there is no input**: Use [Select](/components/select) when the combobox has no input. Select has the accessibility features of a listbox with no input.
- **Form controls must have an accessible name**: Label the control with a native `<label>`, `<Field.Label>` or `<Combobox.Label>`. `<Combobox.Label>` names the control: the input, or the trigger when the input is in the popup. When no label is visible, give the control an `aria-label`. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./combobox/Anatomy.vue

`Combobox.Root` renders a `<div>`. The inputs of its form are its last children (see [Forms](#forms)).

Bind the value with `v-model`, the text of the input with `v-model:inputValue` and the open state with `v-model:open`. The root emits `valueChange`, `inputValueChange` and `openChange` with the new value and `eventDetails`, and then `update:modelValue`, `update:inputValue` and `update:open`. To stop a change, call `eventDetails.cancel()` before the listener returns. The root then emits no `update:` event. Without `multiple`, a pick of the selected item emits no `valueChange` and no `update:modelValue`. For the text that the input has, the root emits no `inputValueChange` and no `update:inputValue`. A press of `Combobox.Clear`, or Escape in a closed input, emits no `valueChange` and no `update:modelValue` when the combobox has no value.

An item shows its selected state in its default slot: `<Combobox.Item v-slot="{ state }">` gives `state.selected`. A style can read `[aria-selected="true"]` on the item.

## Item values

Each `<Combobox.Item>` takes a `value` prop that identifies it. Pass the item being rendered. To render each filtered item, give `<Combobox.List>` the `item` slot. The slot gets `{ item, index }`:

<<< ./combobox/ItemObjects.vue{19}

That item is the selected value. The `modelValue` and `defaultValue` props take it, and `valueChange` gives it. To store IDs instead, see [Value selection with IDs](#value-selection-with-ids).

## Animation

The popup and the backdrop are in the DOM only while the combobox is open. Put each of them in a `<Transition appear>`, and animate them with the classes of `<Transition>`. The portal renders its content at the open, so `<Transition>` needs `appear` to run the enter of the first open.

With `keepMounted` on `Combobox.Portal`, the closed popup and backdrop stay in the DOM with `hidden` and `inert`. Vue then runs no transition, so animate them with CSS on `[hidden]`. The list and the text of an input in the popup stay as they were at the close until the next open.

`Combobox.Clear` is in the DOM only while the combobox has a value. Put it in a `<Transition>` to animate it. With `keepMounted`, it stays with `hidden`.

## Styling

Select the states of the parts with these selectors:

| Selector                                                          | On                                                           | State                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `[aria-expanded="true"]`                                          | input, trigger                                               | The popup is open.                                                  |
| `[data-popup-open]`                                               | input group, clear                                           | The popup is open.                                                  |
| `[data-popup-side]`                                               | input, input group, trigger                                  | The side of the open popup.                                         |
| `[data-list-empty]`                                               | input, input group, trigger                                  | The list has no item to show.                                       |
| `[data-placeholder]`                                              | input group, trigger                                         | The combobox has no value.                                          |
| `:read-only`, `[data-readonly]`                                   | input; input group, trigger                                  | The combobox is read-only.                                          |
| `[aria-required="true"]`, `[data-required]`                       | input; trigger                                               | The combobox needs a value.                                         |
| `:disabled`, `[data-disabled]`                                    | input, trigger, clear, chip remove; input group, label, chip | The part is disabled.                                               |
| `[aria-invalid="true"]`, `[data-invalid]`                         | the control; the other parts in a field                      | The field is invalid.                                               |
| `[data-touched]`, `[data-dirty]`, `[data-valid]`, `[data-filled]` | the parts in a field                                         | The state of the field.                                             |
| `[data-highlighted]`                                              | item                                                         | The item has the highlight.                                         |
| `[aria-selected="true"]`                                          | item                                                         | The item is selected.                                               |
| `[aria-disabled="true"]`                                          | item                                                         | The item is disabled.                                               |
| `[data-side]`, `[data-align]`                                     | positioner, popup, arrow                                     | The side of the anchor and the alignment of the popup.              |
| `[data-anchor-hidden]`                                            | positioner, popup                                            | The anchor is out of view.                                          |
| `[data-empty]`                                                    | positioner, popup, list                                      | The list has no item to show.                                       |
| `[data-uncentered]`                                               | arrow                                                        | The arrow cannot point at the center of the anchor.                 |
| `[data-orientation]`                                              | separator                                                    | `horizontal` or `vertical`.                                         |
| `[hidden]`                                                        | popup, backdrop, clear                                       | The part stays in the DOM with `keepMounted`, and it does not show. |

The positioner has the CSS variables `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height` and `--transform-origin`, as the positioner of [Popover](/components/popover#styling).

## Forms

`Combobox.Root` renders the inputs of its form after its parts. With a `name`, it submits its value in an `<input type="hidden">`. With `multiple`, it submits one input for each selected item. A disabled combobox submits nothing.

A visually hidden text input with no name has the constraint validation of `required`. It also takes an autofill of the browser, and selects the item whose value or label is the text. The input has no name, so give `autocomplete` to the root for an autofill, such as `autocomplete="country-name"`.

A native reset of the form puts back `defaultValue` and `defaultInputValue`. The root then emits `update:modelValue` and `update:inputValue`, and no change event.

## Typeahead and autofill

A typed character on a closed trigger that is the control selects the next item whose label starts with the typed text. The typeahead and an autofill read the labels of `items`, or of the items of a popup that stays in the DOM (`keepMounted` on `Combobox.Portal`). The popup is not in the DOM before its first open. So with neither, they find no item.

## Examples

### Typed component

`Combobox.Root` is a generic component with the type arguments `Value`, `Multiple` and `Item`. `Multiple` defaults to `false`, and `Item` defaults to `Value`.

To fix the types, give the part its type arguments in an instantiation expression. Use the result as a component:

<<< ./combobox/TypedComponent.vue{10,23}

A `createItems()` collection has items that differ from its selection values. The root needs the third type argument, `Item`, to accept such a collection. Without it, the type check refuses the collection.

A wrapper that declares `defineProps<ComboboxRootProps<Value, Multiple, Item>>()` and forwards the props with `v-bind` does not work. Vue gives an absent Boolean prop the value `false`. The wrapper then passes `false` for each Boolean prop that its consumer omits, such as `open`, and the combobox stays closed.

### Value selection with IDs

When your app stores IDs and not item objects, use `Combobox.createItems` with `getValue` and `getLabel`. They derive the selection value and the display label of each item.

With static data, create the collection at module scope. The parameters of the two functions get their types from `users`. Give the derived ID to the `value` prop of `<Combobox.Item>`, not the item being rendered:

<<< ./combobox/ItemIds.vue{19}

The props and the events of the selection use the derived IDs, and the list still gets the original items. The filter and the typeahead use the derived label.

When the data loads or changes at run time, make the collection in a `computed`. The collection then changes only with its data:

<<< ./combobox/DynamicItems.vue

<DemoFrame>
  <DemoComboboxCreateItems />
  <template #tailwind>
    <DemoComboboxCreateItemsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/create-items/css-modules/index.vue

<<< ../demos/combobox/create-items/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/create-items/tailwind/index.vue

:::

</DemoSource>

As a rule of thumb, use primitive items for simple lists. Use object values when the selected record is useful application state. Use `createItems()` when the selection needs a stable primitive ID and the list still uses object records.

Stable IDs keep the match of the items when a data library replaces the row objects at a refetch. With object values, use `isItemEqualToValue` to compare their IDs.

When a server filters the results, `items` is the list of records that the app knows. `filteredItems` is the window of results that the popup shows. Give `filteredItems` the source items, not the derived values. Keep the flat or grouped structure of `items`:

<<< ./combobox/FilteredWindow.vue{23}

Put the record of the selected user in `knownUsers`. Its label then stays available while the record is not in `searchResults`. Or give `itemToStringLabel`, when the selected value alone gives the label.

### Multiple select

Add the `multiple` prop to `<Combobox.Root>` to let the user select more than one item. The value is then an array. Render each selected item as a `<Combobox.Chip>` in `<Combobox.Chips>`. The user can remove a chip.

<DemoFrame>
  <DemoComboboxMultiple />
  <template #tailwind>
    <DemoComboboxMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/multiple/css-modules/index.vue

<<< ../demos/combobox/multiple/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/multiple/tailwind/index.vue

:::

</DemoSource>

To let screen readers announce how to reach and remove the chips, give `aria-description` to `<Combobox.Chip>` and `<Combobox.Input>`. Also give `aria-label` to `<Combobox.Chips>` and `<Combobox.ChipRemove>`. Vase UI does not ship these strings. Translate them with the rest of your interface.

To limit the visible chips, slice the selected values that `<Combobox.Value>` gives to its slot:

<<< ./combobox/LimitedChips.vue{15,22-24}

#### Keeping the filter after selection

In `multiple` mode, a selection clears the filter that the user typed. When the input is outside the popup, that selection also closes the popup. To let the user pick more than one result of a query, cancel the change request that does this.

The request to cancel depends on where the input is. When the input is outside the popup, cancel the close request in `openChange`. That request has the reason `item-press`:

<<< ./combobox/KeepFilterOutside.vue{5-7}

When the input is inside the popup, cancel the request that clears the input in `inputValueChange`. That request has `eventDetails.isItemPress`:

<<< ./combobox/KeepFilterInside.vue{5-7}

The typed filter still resets when the popup closes.

### Input inside popup

`<Combobox.Input>` can be inside `<Combobox.Popup>`. The combobox is then a select popup with a search field.

<DemoFrame>
  <DemoComboboxInputInsidePopup />
  <template #tailwind>
    <DemoComboboxInputInsidePopupTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/input-inside-popup/css-modules/index.vue

<<< ../demos/combobox/input-inside-popup/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/input-inside-popup/tailwind/index.vue

:::

</DemoSource>

In this pattern, use `<Combobox.Label>` to give the trigger a visible label:

<<< ./combobox/Label.vue{7}

`<Combobox.Label>` renders a `<div>`. With the input inside the popup, a click on the label focuses the trigger and does not open the popup.

With the input outside the popup, use a native `<label>` or `<Field.Label>` for the input. In a `<Field.Root>`, a click on `<Combobox.Label>` then focuses the input, and not the trigger.

### Grouped

Use `<Combobox.Group>` and `<Combobox.GroupLabel>` to add headings that group related items in the popup.

The `items` prop describes the groups as an array of objects. Each object has an `items` array with the items of its group. Another property, such as `value`, can give the text of the heading:

<<< ./combobox/Grouped.vue{6,12,16}

<DemoFrame>
  <DemoComboboxGrouped />
  <template #tailwind>
    <DemoComboboxGroupedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/grouped/css-modules/index.vue

<<< ../demos/combobox/grouped/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/grouped/tailwind/index.vue

:::

</DemoSource>

### Async search (single)

Load the items from a remote source when the input changes. The app does not need to load all items first. Keep the selected item in the `items` list, so that it stays available while new results arrive.

<DemoFrame>
  <DemoComboboxAsyncSingle />
  <template #tailwind>
    <DemoComboboxAsyncSingleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/async-single/css-modules/index.vue

<<< ../demos/combobox/async-single/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/async-single/tailwind/index.vue

:::

</DemoSource>

### Async search (multiple)

Load the items from a remote source when the input changes, and allow more than one selected item. The app does not need to load all items first. The selected items stay in the list while new matches arrive.

<DemoFrame>
  <DemoComboboxAsyncMultiple />
  <template #tailwind>
    <DemoComboboxAsyncMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/async-multiple/css-modules/index.vue

<<< ../demos/combobox/async-multiple/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/async-multiple/tailwind/index.vue

:::

</DemoSource>

### Virtualized

Use a virtualization library, such as `@tanstack/vue-virtual`, to handle a large data set.

<DemoFrame>
  <DemoComboboxVirtualized />
  <template #tailwind>
    <DemoComboboxVirtualizedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/virtualized/css-modules/index.vue

<<< ../demos/combobox/virtualized/css-modules/VirtualizedList.vue

<<< ../demos/combobox/virtualized/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/virtualized/tailwind/index.vue

<<< ../demos/combobox/virtualized/tailwind/VirtualizedList.vue

:::

</DemoSource>

#### Memoizing items

A child component that takes the item as a prop is a simpler alternative to virtualization for a short list. Vue renders a child component again only when its props, its slots or the reactive values that its render reads change, so unchanged items skip re-rendering. This speeds up typing. It does not speed up opening, because the popup still mounts each item. For a long list, use virtualization.

::: code-group

<<< ./combobox/FruitItem.vue

<<< ./combobox/MemoizedItems.vue{20}

:::

## Portal target

Set `to` on `Combobox.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## useFilter

Matches items against a query using `Intl.Collator` for robust string matching. Use it when you filter the items yourself. Call it in `setup`. To make the filter follow a value that changes, give it a ref or a getter for its options.

With no `locale`, the filter uses the locale of the nearest `LocaleProvider`, else `en-US`. The server and the client then give the same list.

<ApiReference name="Combobox.useFilter" :heading-level="3" />

## useFilteredItems

Returns the items that the filter of `Combobox.Root` keeps. Call it inside `Combobox.Root`. It returns a `ComputedRef`: read `.value` in a script, and treat the list as read-only.

<ApiReference name="Combobox.useFilteredItems" :heading-level="3" />

## createItems

Normalizes items into a collection for the `items` prop of `Combobox.Root`. It derives the selection value and the label of each item before the list renders them.

<ApiReference name="Combobox.createItems" :heading-level="3" />
