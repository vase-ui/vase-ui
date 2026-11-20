---
order: 6
description: A guide to using TypeScript with Vase UI.
---

# TypeScript

A guide to using TypeScript with Vase UI.

## Namespaces

Vase UI uses namespaces to organize types. The namespace of a part holds its types. The two core types are:

- `Props` (such as `Tooltip.Root.Props`)
- `State` (such as `Tooltip.Root.State`)

A part with no props of its own has no `Props`. A part with no state has no `State`.

Each type also has a flat name, such as `TooltipRootProps` and `TooltipRootState`. The entry point of the component exports both names.

A component with one part has its types on the component, such as `Checkbox.Props` and `CheckboxProps`.

### Props

To make a component that wraps a part, use the `Props` type to accept all of the props of that part. The sample takes the flat name in `defineProps`.

<<< ../examples/typescript/MyTooltip.vue{6-7}

Vue changes an absent Boolean prop to `false`. The wrapper uses `useForwardProps` to omit that cast value, so the tooltip stays uncontrolled.

See [Wrap a part](/handbook/composition#wrap-a-part) for the Boolean props that need this rule.

### State

The `State` type is the internal state of the part. For example, a `Positioner` part, such as `<Popover.Positioner>`, has state that describes the position of the element in relation to its anchor.

The render slot passes its state to a typed function that selects the class of the positioner.

<<< ../examples/typescript/PositionerState.vue{4-6,14-15,17-20}

### Events

The namespace of a part also exports the types of the custom events.

- `ChangeEventDetails` (such as `Combobox.Root.ChangeEventDetails`) is the object that a part gives to a change listener, such as `valueChange`.
- `OpenChangeEventDetails` (such as `Combobox.Root.OpenChangeEventDetails`) is the object that a part gives to `openChange`, on a part whose `ChangeEventDetails` also serves other listeners. It has the members of `ChangeEventDetails` and `preventUnmountOnClose()`.
- `ChangeEventReason` (such as `Combobox.Root.ChangeEventReason`) is the union of the possible reason strings of a change event.

<<< ../examples/typescript/ChangeEvents.vue{6,7,11}

### Other accessible types

A part or a utility can also export other types. The list below is not complete. Each type is documented where it is needed.

- A popup root exposes methods, and you read them through a template ref. `Menu.Root.Actions` is the type of the methods that `Menu.Root` exposes.

  <<< ../examples/typescript/Actions.vue{5-10,15}

- The `toast` object of `<Toast.Root>` is a complex object with many properties. `Toast.Root.ToastObject` gives access to this interface.
- A part that renders an element accepts `as`. Extend `useRender.ComponentProps` to give your component this prop. See [useRender](/utils/use-render#typescript).

## Generic components

A part whose types follow a value or a payload is a generic component. Its type parameter comes from its props.

- A part with a value, such as `RadioGroup`, `ToggleGroup`, `Slider.Root` or `Accordion.Root`, takes its type parameter from `model-value` or `default-value`.
- A popup root and its trigger, such as `Tooltip.Root` and `Tooltip.Trigger`, take the type of their payload from `handle`. See [Multiple triggers](/components/tooltip#multiple-triggers).

In this sample, the type of the listener follows `default-value`: a number for one thumb, and an array of numbers for a range. The type check refuses a listener with another type.

<<< ../examples/typescript/GenericValue.vue

When no prop gives the type, write it on the parameter of the listener, such as `(value: string | null) => void` on a `Select.Root` with no `model-value` and no `default-value`.

A generic component can be the value of `as`. To give it a prop or a listener with its type, render it in the `#render` slot of the other part, and bind `props` on it.
