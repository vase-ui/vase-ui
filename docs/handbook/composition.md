---
order: 3
description: A guide to composing Vase UI components with your own Vue components.
---

# Composition

A guide to composing Vase UI components with your own Vue components.

## Composing custom components

Use the `as` prop or the `#render` slot to compose a Vase UI part with your own components. The `as` prop takes a tag or a component. The `#render` slot gives `props` to bind on your own element or component.

For example, most triggers render a `<button>` by default. The sample below uses a custom button instead.

<<< ../examples/composition/CustomTrigger.vue{9-11}

Give a component to `as` when you set none of its own props. Use `#render` when you set a prop of the component, such as `size`. With `strictTemplates`, the type check refuses a prop that the default element of the part does not have.

The custom component needs one root element. Vue gives the attributes to that element by default. The part reads the element from the `element` that the component exposes. If the component exposes none, the part reads its root element. The part cannot read the root element of a component in [Vapor mode](#vapor-mode), so that component must expose `element`. If the component sets `element` later than its `onMounted` hook, for example after an `await`, expose `element` as a ref so that the part sees the change.

Under `#render`, the part does not render its default slot. Put the content in your element.

## Composing multiple components

To compose more than one part with your own components, nest the `#render` slots as deeply as you need. Tooltip is a common example.

<<< ../examples/composition/NestedTriggers.vue{13-23}

In this sample, `Tooltip.Trigger` renders `Dialog.Trigger`, `Dialog.Trigger` renders `Menu.Trigger`, and `Menu.Trigger` renders `MyButton`.

## How props are merged

With `as`, a part has one set of attributes. The part takes the props that it declares. It gives the other attributes to the tag or component. For example, `Toolbar.Button` declares `disabled`. Set `disabled` on `Toolbar.Button`, and not on the component that you give to `as` or render in its slot. The toolbar then keeps the element in its keyboard navigation.

An attribute with the value `undefined` counts as not set, as a prop does in Vue. The part keeps its own value, so a wrapper component can pass an optional prop on: `:aria-labelledby="labelledby"`. To remove an attribute of the part, give `null`: `<Menu.GroupLabel :aria-hidden="null">`. A prop that the part declares keeps the rules of Vue: `undefined` gives its default, and its type says if it takes `null`. A part with the `element` slot gives each attribute to its element as it is, `undefined` too. `Avatar.Image` keeps `alt=""` for an `alt` that is `undefined` or `null`.

A blank `aria-label` or `aria-labelledby` also counts as not set: an empty string, or a string of white space only. Such a value names nothing, so the part keeps its own name. A wrapper component can thus give its label prop the default `''`. This is also true for a part that declares one of them as a prop.

A blank ID reference attribute also counts as not set: `aria-describedby`, `aria-controls`, `aria-activedescendant`, `aria-owns`, `aria-details`, `aria-errormessage`, `aria-flowto` or `for`. Such a value refers to no element, so the part keeps its own value. A dialog thus keeps its description, and a trigger still names its popup in `aria-controls`. A click on `Field.Label` still moves the focus to the control. A part that declares `aria-describedby` as a prop, such as `Slider.Thumb`, follows the same rule.

A part keeps its own id when the `id` prop or attribute is empty or contains only white space. A title can then still name its dialog, and a label can still refer to its control. HTML requires a nonempty id with no ASCII white space.

These rules apply to the props and attributes you give to a part. On the element in a `#render` slot, an `id`, a name or an ID reference that you write after `v-bind="props"` wins even if it is blank or `undefined`. The same rule applies to those attributes in a later argument to `mergeProps`.

With `#render`, the slot gets `props`. It holds the attributes, the listeners, the state data attributes, the class, the style and the `ref` setter. Bind it on your element with `v-bind="props"`. In [Vapor mode](#vapor-mode), also bind the `ref` setter by name.

Attributes that you write beside `v-bind="props"` follow the rules of Vue. When `v-bind="props"` comes first, Vue joins the `class` values and merges the `style` values. Vue calls both listeners, and it calls the listener of `props` first. For another attribute, such as `id` or `title`, the attribute that comes last wins.

A part can name another part by its `id`: a trigger names its panel, and a dialog names its title. When an `id` that you write in the slot wins, the part names that `id` after the named part mounts, and follows each change of it. An empty `id` in the slot gives the element no `id`, so no part names it. The server HTML names the `id` that the part gives. To make the server HTML name the element, give the `id` to the part and not to the slot.

For your listener to run first, merge `props` with `mergeProps`. See [how merging works](/utils/merge-props#how-merging-works). In your listener, [`event.preventVaseUIHandler()`](/handbook/customization#preventing-vase-ui-from-handling-an-event) stops the listeners of the part. For example, this toolbar button renders a menu trigger:

<<< ../examples/composition/MergedProps.vue{14-18,22-26}

The rendered `<button>` gets:

- `class="menu-trigger toolbar-button"`: class names are combined, and the rightmost set comes first.
- `style="color: blue; padding: 4px;"`: style objects are merged, and the rightmost set wins.
- Both click listeners, and `handleMenuClick` runs first. `event.preventVaseUIHandler()` skips the listeners of that element that run after it. When `handleMenuClick` calls it, `handleToolbarClick` does not run. Some parts call it internally.

An element takes one `ref`, and Vue keeps the last `ref` key. To keep the `ref` of the part and add one of your own, call `props.ref` in a function ref: `:ref="(element) => { props.ref(element); own = element }"`.

## Changing the default rendered element

You can also use the `as` prop to change the element that a part renders.

For example, `<Accordion.Header>` renders an `<h3>` element by default. The sample below renders it as an `<h2>` element, so that it fits the heading hierarchy of the page.

<<< ../examples/composition/HeadingLevel.vue{8}

Each Vase UI part renders the most appropriate element by default. In most cases, render a different element only when you have a reason for it.

## The render slot

The `#render` slot gives you `props` and `state`. Bind `props` on your element. In a Vapor template, also bind `:ref="props.ref"`. Use `state` for the content, class or style.

<<< ../examples/composition/RenderSlot.vue{8-11}

The default slot also gets `{ state }`. Some parts give `#render` a third slot prop, `children`, for nodes they supply. For example, mount the `children` of `Slider.Thumb` inside your element to keep its range input. A development build warns if the slot opens without those children.

<<< ../examples/composition/RenderChildren.vue{10-12}

## Element refs

A template ref on a part gives you its public instance. For a part that renders an element, read `element` to get the DOM node.
Some parts expose another element or an action. For example, `NumberField.Root` exposes its hidden input as `inputElement`.
If the part removes its element, its exposed `element` becomes `null`.

## Wrap a part

Use [`useForwardProps`](/utils/use-forward-props) when your component wraps a part. It forwards the props that your caller sets, plus your explicit defaults. It omits values of `undefined`.

Vue sets an absent Boolean prop to `false` unless the wrapper declares a default. This also applies to an optional Boolean prop in `defineProps<...>()`. The helper omits that cast value, so the part keeps its default or parent value.

This wrapper keeps the root values of `keepMounted` and `hiddenUntilFound` when its caller omits them:

<<< ../examples/composition/MyAccordionPanel.vue{4,12-13,17}

You can instead give each optional Boolean prop the default `undefined`. An explicit `false` still reaches the part:

<<< ../examples/composition/MyAccordionPanelDefaults.vue{11-14}

You can also leave the prop undeclared and pass `$attrs` to the part with `v-bind="$attrs"`. Vue then applies the Boolean rules of the part.

A development build warns when a wrapper gives a part a cast `false` that replaces a default or parent value. The message names the wrapper, the part, the prop and both corrections. See [the development warning](/utils/use-forward-props#the-development-warning) for its limits.

An absent prop and `false` give different results in four cases.

### Parent or internal state

- `Accordion.Panel`: `keepMounted` and `hiddenUntilFound` follow the root when absent. An explicit `false` overrides the root value of that prop.
- `Menu.Trigger`: absent `openOnHover` lets the pointer open a menu while another menu in the menubar is open. An explicit `false` disables this behavior.
- `DatePicker.Root`: absent `closeOnSelect` closes the popup for a value with no time. A value with a time keeps it open.
- `TimePicker.Root`: without `closeOnSelect`, a list selection or a commit in the last clock view closes the popup. A column selection keeps it open.
- `Field.Root`: absent `dirty` and `touched` let the field track its state. An explicit `false` holds that state at `false`.
- `Calendar.Root`, `RangeCalendar.Root`, `DatePicker.Calendar` and `DateRangePicker.Calendar`: absent `showOutsideDays` is `true` with `broadcastCalendar`. An explicit `false` overrides this.
- `Toast.Positioner`: absent `sticky` and `disableAnchorTracking` take the values of the `positionerProps` of the toast. An explicit `false` overrides these values.

`Field.Root` treats `invalid` the same when it is absent or `false`.

### Controlled state

A value of `false` makes these props controlled:

- `open` on Collapsible, Dialog, Alert Dialog, Drawer, Popover, Tooltip, Preview Card, Menu, Context Menu, Select, Combobox, Autocomplete, Date Picker, Date Range Picker and Time Picker roots, and `Menu.SubmenuRoot`.
- `modelValue` on `Checkbox`, `Switch`, `Menu.CheckboxItem` and `Toggle`.

A defined model prop gives the parent control, even without an update listener. With `v-model:open`, a parent can take control after mount by setting its ref to `true` or `false`.

When the parent sets one of these Boolean props to `undefined`, the part keeps the last value and accepts local changes. A wrapper can forward `undefined` with an update listener and still leave the part in control.

Set a popup root’s `triggerId` to `null` to clear its active trigger. The popup can stay open.

### A default of true

`undefined` keeps the `true` default of the part. A wrapper with no default, or with the default `false`, disables it.

- `modal` on Dialog, Drawer, Menu and Select roots, and `Menubar`.
- `loopFocus` on Menu roots and submenus, Context Menu, Menubar, Combobox, Autocomplete, `Tabs.List`, Toggle Group and Toolbar.
- `highlightItemOnHover` on Menu, Select, Combobox, Autocomplete and Context Menu roots, and `Menu.SubmenuRoot`.
- `openOnInputClick` on `Combobox.Root`.
- `closeOnClick` on `Menu.Item` and `Tooltip.Trigger`.
- `openOnHover` on `Menu.SubmenuTrigger`.
- `alignItemWithTrigger` on `Select.Positioner`.
- `focusableWhenDisabled` on `Toolbar.Button` and `Toolbar.Input`.
- `pushPanels` on `Resizable.Root`.
- `nativeButton` on button parts such as `Dialog.Trigger` and `Toolbar.Button`.
- `initialFocus` and `finalFocus` on popup parts such as `Dialog.Popup` and `Popover.Popup`, and `finalFocus` on `Menu.Popup` and `Select.Popup`. These props also take an element or a function.
- `closeOnSelect` on `DateRangePicker.Root`, also for a range with a time.

### A warning in development

- `Collapsible.Panel`, `Accordion.Root` and `Accordion.Panel`: with `hiddenUntilFound`, an explicit `false` for `keepMounted` gives a warning.

## Vapor mode

Vase UI parts are ordinary Vue components. An application in Vapor mode renders them with the `vaporInteropPlugin` of Vue.

In a Vapor component (`<script setup vapor>`), bind the `ref` setter of `props` by name, beside `v-bind="props"`: `<a v-bind="props" :ref="props.ref">`. Vapor does not apply the `ref` key of a bound object. Vue shows no warning. Without `:ref`, the part gets no element. A development build then shows a warning that names this binding.

The rule applies to each element and each component that gets `props`. With nested `#render` slots, bind the setter of each slot: `<Dialog.Trigger v-bind="tooltipTrigger" :ref="tooltipTrigger.ref">`. With `mergeProps`, bind the setter of the slot: `v-bind="mergeProps(props, own)" :ref="props.ref"`. To add a `ref` of your own, use the function ref of [How props are merged](#how-props-are-merged). It works in a Vapor component too.

A custom component in Vapor mode must expose its element as `element`, with `defineExpose({ element })`. Make `element` a template ref of the root element. Vue gives a ref on a Vapor component only the values that the component exposes, so the part cannot read the root element. This rule applies to `as` and to `#render`, also when the component that renders the part is not in Vapor mode.

A component that you build with [useRender](/utils/use-render) exposes the `element` that `useRender` returns. Its template binds `setRef` by name on its element and calls `usesRenderSlot()` in the `v-if` of its `#render` slot, as the samples of that page do. In a Vapor component, a development build shows a warning when a native element has only the spread.

In a Vapor wrapper, give each optional Boolean prop the default `undefined`, as [useForwardProps explains](/utils/use-forward-props#vapor-mode).

In a filterable menu, an item in a Vapor component mounts its content a second time while the query hides the item. That mount is in an element outside the document, so the filter can read its text and follow changes from child components. The components in the content run while the item is hidden. Give the item a `label` to prevent that mount. The filter then matches the `label`.
