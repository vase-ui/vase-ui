---
order: 1
description: An unstyled Vue autocomplete component that renders an input with a list of filtered options.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoAutocompleteAsync from '../demos/autocomplete/async/css-modules/index.vue';
import DemoAutocompleteAsyncTailwind from '../demos/autocomplete/async/tailwind/index.vue';
import DemoAutocompleteAutoHighlight from '../demos/autocomplete/auto-highlight/css-modules/index.vue';
import DemoAutocompleteAutoHighlightTailwind from '../demos/autocomplete/auto-highlight/tailwind/index.vue';
import DemoAutocompleteFuzzyMatching from '../demos/autocomplete/fuzzy-matching/css-modules/index.vue';
import DemoAutocompleteFuzzyMatchingTailwind from '../demos/autocomplete/fuzzy-matching/tailwind/index.vue';
import DemoAutocompleteGrouped from '../demos/autocomplete/grouped/css-modules/index.vue';
import DemoAutocompleteGroupedTailwind from '../demos/autocomplete/grouped/tailwind/index.vue';
import DemoAutocompleteHero from '../demos/autocomplete/hero/css-modules/index.vue';
import DemoAutocompleteHeroTailwind from '../demos/autocomplete/hero/tailwind/index.vue';
import DemoAutocompleteInline from '../demos/autocomplete/inline/css-modules/index.vue';
import DemoAutocompleteInlineTailwind from '../demos/autocomplete/inline/tailwind/index.vue';
import DemoAutocompleteLimit from '../demos/autocomplete/limit/css-modules/index.vue';
import DemoAutocompleteLimitTailwind from '../demos/autocomplete/limit/tailwind/index.vue';
import DemoAutocompleteVirtualized from '../demos/autocomplete/virtualized/css-modules/index.vue';
import DemoAutocompleteVirtualizedTailwind from '../demos/autocomplete/virtualized/tailwind/index.vue';
</script>

# Autocomplete

An input that suggests options as you type.

<DemoFrame>
  <DemoAutocompleteHero />
  <template #tailwind>
    <DemoAutocompleteHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/hero/css-modules/index.vue

<<< ../demos/autocomplete/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Avoid when selection state is needed**: Use [Combobox](/components/combobox) in place of Autocomplete if the selection should be remembered and the input value cannot be custom. Unlike Combobox, the input of Autocomplete can contain free-form text, as its suggestions only _optionally_ autocomplete the text.
- **Form controls must have an accessible name**: Create it with a `<label>` element or with [Field](/components/field). See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./autocomplete/Anatomy.vue

Bind the text with `v-model`. An inline completion that the input shows is not the value. The root emits no `valueChange` and no `update:modelValue` for an action that gives the text that it has, such as a press of the item with that text.

`Autocomplete.Root` renders a `<div>` (see [Forms](#forms)).

## Item values

Each `Autocomplete.Item` takes a `value` prop that identifies it. Pass the item being rendered, so that props like `itemToStringValue` receive it.

To render each filtered item, give `Autocomplete.List` the `item` slot. The slot gets `{ item, index }`.

## Animation

The popup and the backdrop are in the DOM only while the autocomplete is open. Put each of them in a `<Transition appear>`, and animate them with the classes of `<Transition>`. With `keepMounted` on `Autocomplete.Portal`, the closed popup stays in the DOM with `hidden` and `inert`, so animate it with CSS on `[hidden]`. See [Animation](/components/combobox#animation) of Combobox.

## Styling

The parts have the selectors of [Combobox](/components/combobox#styling), but an item has no `[aria-selected]`. The input is a text input: select its states with `:read-only`, `:required` and `:disabled`.

## Forms

The input is the form control: it has the `name`, `required` and the text. When the input is in the popup, the root renders an `<input type="hidden">` with the `name` and a visually hidden text input for `required`, after its mount. The server HTML thus has one input with the `name`.

## Examples

### Async search

Load items asynchronously while typing and render custom status content.

<DemoFrame>
  <DemoAutocompleteAsync />
  <template #tailwind>
    <DemoAutocompleteAsyncTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/async/css-modules/index.vue

<<< ../demos/autocomplete/async/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/async/tailwind/index.vue

:::

</DemoSource>

### Inline autocomplete

Autofill the input with the highlighted item while navigating with arrow keys using the `mode` prop. Accepts `aria-autocomplete` values `list`, `both`, `inline`, or `none`.

<DemoFrame>
  <DemoAutocompleteInline />
  <template #tailwind>
    <DemoAutocompleteInlineTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/inline/css-modules/index.vue

<<< ../demos/autocomplete/inline/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/inline/tailwind/index.vue

:::

</DemoSource>

### Grouped

Organize related options with `Autocomplete.Group` and `Autocomplete.GroupLabel` to add section headings inside the popup.

Groups are represented by an array of objects with an `items` property, which itself is an array of individual items for each group. An extra property, such as `value`, can be provided for the heading text when rendering the group label.

<<< ./autocomplete/Grouped.vue{6,12,16}

<DemoFrame>
  <DemoAutocompleteGrouped />
  <template #tailwind>
    <DemoAutocompleteGroupedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/grouped/css-modules/index.vue

<<< ../demos/autocomplete/grouped/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/grouped/tailwind/index.vue

:::

</DemoSource>

### Fuzzy matching

Use fuzzy matching to find relevant results even when the query doesn't exactly match the item text.

<DemoFrame>
  <DemoAutocompleteFuzzyMatching />
  <template #tailwind>
    <DemoAutocompleteFuzzyMatchingTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/fuzzy-matching/css-modules/index.vue

<<< ../demos/autocomplete/fuzzy-matching/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/fuzzy-matching/tailwind/index.vue

:::

</DemoSource>

### Limit results

Limit the number of visible items using the `limit` prop and guide users to refine their query using `Autocomplete.Status`.

<DemoFrame>
  <DemoAutocompleteLimit />
  <template #tailwind>
    <DemoAutocompleteLimitTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/limit/css-modules/index.vue

<<< ../demos/autocomplete/limit/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/limit/tailwind/index.vue

:::

</DemoSource>

### Auto highlight

The first matching item can be automatically highlighted as the user types by specifying the `autoHighlight` prop on `Autocomplete.Root`. Set the prop's value to `"always"` if the highlight should always be present, such as when the list is rendered inline within a dialog.

The prop can be combined with the `keepHighlight` and `highlightItemOnHover` props to configure how the highlight behaves during mouse interactions.

<DemoFrame>
  <DemoAutocompleteAutoHighlight />
  <template #tailwind>
    <DemoAutocompleteAutoHighlightTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/auto-highlight/css-modules/index.vue

<<< ../demos/autocomplete/auto-highlight/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/auto-highlight/tailwind/index.vue

:::

</DemoSource>

### Virtualized

Efficiently handle large datasets using a virtualization library like `@tanstack/vue-virtual`.

<DemoFrame>
  <DemoAutocompleteVirtualized />
  <template #tailwind>
    <DemoAutocompleteVirtualizedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/virtualized/css-modules/index.vue

<<< ../demos/autocomplete/virtualized/css-modules/VirtualizedList.vue

<<< ../demos/autocomplete/virtualized/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/virtualized/tailwind/index.vue

<<< ../demos/autocomplete/virtualized/tailwind/VirtualizedList.vue

:::

</DemoSource>

#### Memoizing items

A child component that takes the item as a prop is a simpler alternative to virtualization for a short list. Vue renders a child component again only when its props, its slots or the reactive values that its render reads change, so unchanged items skip re-rendering. This speeds up typing. It does not speed up opening, because the popup still mounts each item. For a long list, use virtualization.

::: code-group

<<< ./autocomplete/SuggestionItem.vue

<<< ./autocomplete/MemoizedItems.vue{20}

:::

## Portal target

Set `to` on `Autocomplete.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## useFilter

Matches items against a query using `Intl.Collator` for robust string matching. Use it when you filter the items yourself.

<ApiReference name="Autocomplete.useFilter" :heading-level="3" />

## useFilteredItems

Returns the items that the filter of `Autocomplete.Root` keeps. Call it inside `Autocomplete.Root`. It returns a `ComputedRef`: read `.value` in a script, and treat the list as read-only.

<ApiReference name="Autocomplete.useFilteredItems" :heading-level="3" />
