---
order: 3
description: A guide to composing Vase UI components with your own Vue components.
---

# Composition

A guide to composing Vase UI components with your own Vue components.

## Composing custom components

A part renders one element. Two ways replace it:

- The `as` prop takes a tag or a component. The part gives it the attributes, the listeners and the content of its own element.
- The [`element` slot](#the-element-slot) gives full control: render your own element or component in it.

When a part has `as` and the `element` slot, the slot wins.

For example, a tab renders a `<button>`. The first tab of the sample gives a component to `as`. The second tab sets the `size` prop of the component, so it uses the slot.

<<< ../examples/composition/CustomTab.vue{9-14}

A part that is a native form control, another form element or an image has no `as`. Examples are `Input`, `NumberField.Input`, `Checkbox`, `Fieldset.Root`, `Field.Label` and `Avatar.Image`. Use the `element` slot.

The component needs one root element, and Vue gives the attributes to it. The part reads the element from the `element` that the component exposes, else from its root element. A component in [Vapor mode](#vapor-mode) has no root element for the part, so it must expose `element`. Expose `element` as a ref, so that the part sees each change of it.

With `as`, the part keeps its content and its own nodes, such as the hidden text of `Progress.Root`.

## Composing multiple components

To compose more than one part, nest the `element` slots. In this sample, `Tooltip.Trigger` renders `Dialog.Trigger`, which renders `Menu.Trigger`, which renders `MyButton`:

<<< ../examples/composition/NestedTriggers.vue{13-23}

## How attributes are merged

A part takes the props that it declares. It gives each other attribute and listener to its element, merged with its own by the rules of Vue:

- Vue joins the `class` values and merges the `style` values.
- Vue calls each listener.
- For each other attribute, the value that you give wins. A value of `undefined` or `null` also wins, and Vue then writes no attribute.

A part that writes its own id takes `id` as a prop. An `id` that is empty or holds only white space counts as no `id`, and the part keeps its own id.

In a `Field`, each control adds the ids of the descriptions and the errors of the field after the ids of your `aria-describedby`. With `null`, the control writes no `aria-describedby`.

Set a prop on the part, and not on the component in `as` or in the slot. For example, set `disabled` on `Toolbar.Button`: the toolbar then keeps the button in its keyboard navigation.

In the `element` slot, the attributes that you write beside `v-bind="props"` follow the same rules, in the order of the template: the later value wins. To merge in a script or a render function, use [`mergeProps`](https://vuejs.org/api/render-function.html#mergeprops) of Vue. It merges in the order of its arguments.

<<< ../examples/composition/MergedProps.vue{14-18,22-25}

The `<button>` gets:

- `class="menu-trigger toolbar-button"`.
- `style="color: red; padding: 4px;"`: the last argument wins.
- The two click listeners. `handleMenuClick` runs first, because it is in the first argument.

To stop an event before the part gets it, see [Stop a native event before a part gets it](/handbook/customization#stop-a-native-event-before-a-part-gets-it).

## Changing the default rendered element

The `as` prop also changes the tag of a part. For example, `Accordion.Header` renders an `<h3>`. The sample renders an `<h2>`, to fit the heading levels of the page:

<<< ../examples/composition/HeadingLevel.vue{8}

Each part renders the most applicable element. Change it only when you have a reason.

## The element slot

The `element` slot gets three props:

- `props`: the attributes, the listeners, the class and the style of the part, merged with yours. Bind them with `v-bind="props"`.
- `elementRef`: a function ref. Bind it with `:ref="elementRef"`, so that the part gets your element.
- `state`: the state of the part. Use it for a class, a style or the content.

The part does not render its default slot in the `element` slot. Put the content in your element.

<<< ../examples/composition/CustomTrigger.vue{9-11}

Your element can be a component: it exposes `element`, or its root element is the element of the part. For a router link, use the `custom` form of `RouterLink` or `NuxtLink`, and render a native `<a>` in the `element` slot. The [Navigation Menu](/components/navigation-menu) page shows this.

An element takes one `ref`. To keep the ref of the part and add one of your own, call `elementRef` in a function ref: `:ref="(element) => { elementRef(element); own = element }"`.

## Slots and template refs

Some parts give more slot props. `TimePicker.Item` gives `text`, its time in the locale of the picker:

<<< ../examples/composition/ElementSlotText.vue{10-14}

The `element` slot of `Slider.Thumb` gives its range input as `inputProps` and `inputRef`. Render the input in your element, or in another place:

<<< ../examples/composition/ThumbElementSlot.vue{10-14}

A template ref on a part gives the members that the part exposes. `element` is its DOM element, or `null` while the part renders no element. Some parts expose more, such as `close()` of `Menu.Root`.

## Wrap a part

Declare only your own props and events in a wrapper. Vue gives each attribute and listener that the wrapper does not declare to its root, the part. The part then keeps its default, or the value of its parent.

To type the props and the events of the part, extend its `Props` and `Emits` types with `/* @vue-ignore */`. The SFC compiler skips these types, so the wrapper declares no prop and no event at run time. The type check of the caller knows each prop, each `v-model` and each event of the part:

<<< ../examples/composition/MyDialog.vue{5-9}

A wrapper of a generic part, such as `Select.Root`, has the type parameters of the part. The value then keeps the type of the `v-model` of the caller:

<<< ../examples/composition/MySelect.vue{1,5-9}

Vue sets an absent Boolean prop to `false`, unless you give it a default. If you declare a Boolean prop of the part, give it the default `undefined`. Else the wrapper changes the part: `modal` of `Dialog.Root` becomes `false`, and `Accordion.Panel` ignores the `keepMounted` of its root. An explicit `false` still reaches the part.

<<< ../examples/composition/MyAccordionPanelDefaults.vue{11-14}

Do not bind an attribute that you declared and that can be `undefined`, such as `:aria-labelledby="labelledby"`. A value of `undefined` removes the value of the part, such as the title that names a dialog. Leave the attribute undeclared, and Vue passes it on only when the caller gives it.

### Reka UI and shadcn-vue

A wrapper of a Reka UI part, such as a shadcn-vue component, declares the props and the emits of the part. It gives them to the part with `useForwardPropsEmits(props, emits)`. In Vase UI, Vue gives the part what the wrapper does not declare:

- `defineProps<DialogRootProps>()` becomes `defineProps<Props>()`, with `interface Props extends /* @vue-ignore */ DialogRootProps {}`.
- Vue does the Boolean casting only for a declared prop, so the undeclared props need no `useForwardProps`. Give a declared Boolean prop the default `undefined`.
- `defineEmits<DialogRootEmits>()` becomes `defineEmits<Emits>()`, with `interface Emits extends /* @vue-ignore */ DialogRootEmits {}`. Vue gives each listener to the part, so the wrapper needs no `useEmitAsProps`.
- `v-bind="forwarded"` is not necessary when the part is the root of the wrapper. Else, set `defineOptions({ inheritAttrs: false })` and write `v-bind="$attrs"` on the part.

## Portals, Transition and KeepAlive

A `Portal` part renders its content in a Vue [`<Teleport>`](https://vuejs.org/guide/built-ins/teleport.html), in another place of the document. It renders no element of its own, so an attribute on it reaches no element. Its props:

- `to`: the target, a CSS selector, an element or a shadow root. With no `to`, the target of the nearest portal above, else `<body>`. While `to` is `null`, such as a template ref before its mount, the portal renders nothing. A change of `to` moves the content.
- `disabled`: renders the content in its place, also on the server.
- `defer`: moves the content after the other content of the same update mounts.
- `keepMounted`: the closed popup stays in the DOM, with `hidden` and `inert`.

```vue-html
<Dialog.Portal to="#overlays">
  <Dialog.Popup>Account settings</Dialog.Popup>
</Dialog.Portal>
```

Put a `<Transition>` in the portal, around the part that it animates. See [Animation](/handbook/animation).

`KeepAlive` takes the elements of a held part out of the document. A part has no code for a hold:

- A held part gets no event.
- A held control has no form. It is not in the form data, it does not stop a submit, and a reset does not change it. When it returns, it has the same value and belongs to its form again.
- A toolbar moves its tab stop to an item that is in the document, so that <kbd>Tab</kbd> still reaches the toolbar.

## Vapor mode

Vase UI parts are Vue components. An application in Vapor mode renders them with the `vaporInteropPlugin` of Vue.

- In the `element` slot, bind `elementRef` with `:ref`. Vapor ignores a `ref` key in the object of `v-bind`.
- A Vapor component that you give to `as`, or render in the `element` slot, must expose its element: `defineExpose({ element })`, with `element` a template ref of its root element. A Vapor component has no root element that the part can read. [useElement](/utils/use-element) gives such a component its `element`.

## Differences from Base UI

| Base UI                                                                    | Vase UI                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render` with an element, such as `render={<h2 />}`                        | The `as` prop, with a tag or a component.                                                                                                               |
| `render` with a function of the props and the state                        | The `element` slot, with `props`, `elementRef` and `state`.                                                                                             |
| A component in `render` takes a `ref` and spreads its props on its element | A component in `as` or in the `element` slot gets the attributes as fallthrough attributes. It exposes `element`, else its root element is the element. |
| `ref` on a part gives its element                                          | A template ref on a part gives its exposed members. Read `element`.                                                                                     |
| `render` keeps the `ref` of each part that it merges                       | An element takes one `ref`. To keep the ref of the part, call `elementRef` in your function ref.                                                        |
| An empty `id` stays on the element in most parts                           | An `id` that is empty or holds only white space counts as no `id`. The part keeps its own id.                                                           |
| `mergeProps` and `mergePropsN`                                             | `mergeProps` of Vue: `import { mergeProps } from 'vue'`.                                                                                                |
| `useRender`                                                                | [useElement](/utils/use-element) and the `element` slot in your template.                                                                               |
| A `Portal` part renders a `<div>`                                          | A `Portal` part renders a `<Teleport>` and no element.                                                                                                  |
| `container` of a `Portal` part: an element, a shadow root or a ref         | `to`: a CSS selector, an element or a shadow root. With no `to`, the target of the nearest portal above, else `<body>`.                                 |
