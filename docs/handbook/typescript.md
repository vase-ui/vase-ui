---
order: 6
description: A guide to using TypeScript with Vase UI.
---

# TypeScript

A guide to using TypeScript with Vase UI.

## Namespaces

The namespace of a part holds its types. The main types are:

- `Props`, such as `Tooltip.Root.Props`
- `Emits`, such as `Tooltip.Root.Emits`: the events of the part, in the form of `defineEmits`
- `State`, such as `Tooltip.Root.State`

Each type also has a flat name, such as `TooltipRootProps`. The entry point of the component exports both names. A component with one part has its types on the component, such as `Checkbox.Props` and `CheckboxProps`.

### Props and Emits

A component that wraps a part takes the types of the props and the events of the part from its `Props` and `Emits` types. Extend the flat names with `/* @vue-ignore */`, so that Vue gives the props and the listeners to the part. See [Wrap a part](/handbook/composition#wrap-a-part).

<<< ../examples/typescript/MyTooltip.vue{5-9}

### State

The `State` type is the state of the part. For example, the state of `Popover.Positioner` gives the side and the alignment of the popup. The `element` slot gives the state to a typed function:

<<< ../examples/typescript/PositionerState.vue{4-6,14-15,17-20}

### Events

The namespace of a part also has the types of its change events:

- `ChangeEventDetails`, such as `Combobox.Root.ChangeEventDetails`: the details that a change listener, such as `valueChange`, gets.
- `OpenChangeEventDetails`, such as `Combobox.Root.OpenChangeEventDetails`: the details that `openChange` gets, on a part whose `ChangeEventDetails` serves other listeners.
- `ChangeEventReason`, such as `Combobox.Root.ChangeEventReason`: the union of the reasons of a change.

<<< ../examples/typescript/ChangeEvents.vue{6,7,11}

### Other accessible types

A part or a utility can export other types. Its page documents them. Some examples:

- A template ref on a part has the types of the members that the part exposes. `useTemplateRef` gives the ref of `Menu.Root` the type of its `close` method:

  <<< ../examples/typescript/Actions.vue{5-9,14}

- `ToastObject` is the type of a toast of `Toast.Root`.
- `ElementSlotProps<State>` of `@vase-ui/vue/types` is the type of the props of the `element` slot. A component of yours can have the same slot. See [useElement](/utils/use-element).

## Generic components

A part whose types follow a value or a payload is a generic component. Its type parameter comes from its props:

- A part with a value, such as `RadioGroup`, `ToggleGroup`, `Slider.Root`, `Select.Root` or `Accordion.Root`, takes it from `v-model` or `default-value`.
- A popup root and its trigger, such as `Tooltip.Root` and `Tooltip.Trigger`, take the type of their payload from `handle`.

In this sample, the type of the listener follows `default-value`: a number for one thumb, and an array of numbers for a range. The type check refuses a listener with another type.

<<< ../examples/typescript/GenericValue.vue

## Temporal types

The types of the date and time components use the global `Temporal` types of TypeScript 6.0. [Dates and times](/handbook/dates-and-times#typescript) gives the setup of a project.

## Differences from Base UI

| Base UI                                                         | Vase UI                                                                                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A wrapper spreads the props of the part on it                   | A wrapper types its props and events with `Props` and `Emits` of the part and `/* @vue-ignore */`. Vue gives the attributes and the listeners to the part. |
| `OpenChangeEventDetails` with `preventUnmountOnClose()`         | `OpenChangeEventDetails` with `trigger`. A `<Transition>` keeps a closing popup in the DOM.                                                                |
| The types of `actionsRef`, such as `Menu.Root.Actions`          | The types of the exposed members of the part, which a template ref gets.                                                                                   |
| `useRender.ComponentProps` for a component with a `render` prop | `ElementSlotProps<State>` of `@vase-ui/vue/types`, for a component with an `element` slot.                                                                 |
