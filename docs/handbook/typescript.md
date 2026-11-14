---
order: 6
description: A guide to using TypeScript with Vase UI.
---

# TypeScript

A guide to using TypeScript with Vase UI.

## Namespaces

Vase UI uses namespaces to organize types. Each part has two core interfaces:

- `Props` (such as `Tooltip.Root.Props`)
- `State` (such as `Tooltip.Root.State`)

Each type also has a flat name, such as `TooltipRootProps` and `TooltipRootState`. The entry point of the component exports both names.

### Props

When you create a wrapping component, use the `Props` type to accept all of the props of the part that you wrap.

<<< ../examples/typescript/MyTooltip.vue{5}

Vue changes an absent Boolean prop to `false`. The wrapper gives `open` the default `undefined`, so that the tooltip stays uncontrolled.

### State

The `State` type is the internal state of the part. For example, a `Positioner` part, such as `<Tooltip.Positioner>`, has state that describes the position of the element in relation to its anchor.

The sample gives a function with a typed `state` parameter to `stateClass`. It also uses the same state in the `#render` slot.

<<< ../examples/typescript/PositionerState.vue{4-6,13,17-20}

### Events

The namespace of a part also exports the types of the custom events.

- `ChangeEventDetails` (such as `Tooltip.Root.ChangeEventDetails`) is the object that a part gives to a change listener, such as `openChange`.
- `ChangeEventReason` (such as `Tooltip.Root.ChangeEventReason`) is the union of the possible reason strings of a change event.

<<< ../examples/typescript/ChangeEvents.vue{4-7}

### Other accessible types

Depending on the API, a part or a utility exports other types. The list below is not complete. Each type is documented where it is needed.

- A popup root exposes methods, and you read them through a template ref. For example, `Tooltip.Root.Actions` is the type of the methods that `Tooltip.Root` exposes.
- The `toast` object of `<Toast.Root>` is a complex object with many properties. `Toast.Root.ToastObject` gives access to this interface.
- A part that renders an element has `as`, `stateClass` and `stateStyle`. `useRender.ComponentProps` gives access to these props. See [useRender](/utils/use-render#typescript).

<<< ../examples/typescript/Actions.vue{5-10,15}

## Generic components

A part whose types follow a value or a payload is a generic component. Its type parameter comes from its props.

- `RadioGroup`, `ToggleGroup`, `Slider.Root` and `Accordion.Root` take the type of their value from `value` or `default-value`.
- A popup root and its trigger, such as `Tooltip.Root` and `Tooltip.Trigger`, take the type of their payload from `handle`. See [Multiple triggers](/components/tooltip#multiple-triggers).

In this sample, the type of `value` follows `default-value`: a number for one thumb, and an array of numbers for a range.

<<< ../examples/typescript/GenericValue.vue

The type check refuses a generic component as the value of `as`. Give the part `props` in the `#render` slot instead.
