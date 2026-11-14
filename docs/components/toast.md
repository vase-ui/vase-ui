---
order: 1
description: An unstyled Vue toast component to generate notifications.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoToastAnchored from '../demos/toast/anchored/css-modules/index.vue';
import DemoToastCustom from '../demos/toast/custom/css-modules/index.vue';
import DemoToastDeduplicate from '../demos/toast/deduplicate/css-modules/index.vue';
import DemoToastHero from '../demos/toast/hero/css-modules/index.vue';
import DemoToastPosition from '../demos/toast/position/css-modules/index.vue';
import DemoToastPromise from '../demos/toast/promise/css-modules/index.vue';
import DemoToastUndo from '../demos/toast/undo/css-modules/index.vue';
import DemoToastVaryingHeights from '../demos/toast/varying-heights/css-modules/index.vue';
</script>

# Toast

Generates toast notifications.

<DemoFrame>
  <DemoToastHero />
</DemoFrame>

::: code-group

<<< ../demos/toast/hero/css-modules/index.vue

<<< ../demos/toast/hero/css-modules/ToastButton.vue

<<< ../demos/toast/hero/css-modules/ToastList.vue

<<< ../demos/toast/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./toast/Anatomy.vue

`Toast.useToastManager()` reads the toasts of the nearest `<Toast.Provider>`. Call it in a component inside the provider, and render a `Toast.Root` for each toast of the list. The demos have such a component, `ToastList.vue`.

## General usage

- `<Toast.Provider>` can be wrapped around your entire app, so that all toasts render in the same viewport.
- <kbd>F6</kbd> moves the focus into the landmark region of the toast viewport, so that users can move between the toasts with the keyboard. Press <kbd>F6</kbd> again to move the focus back to where it was.
- Add the `data-vase-ui-swipe-ignore` attribute to an element in a toast to stop the swipe to dismiss on that element. An interactive element does not start a swipe.

## Global manager

To make a global toast manager, call `Toast.createToastManager()` and give the result to the `toastManager` prop of `<Toast.Provider>`. You can then add a toast from anywhere in the app, such as a function outside a component, and the same provider renders it.

The manager has the same `add`, `close`, `update` and `promise` methods as `Toast.useToastManager()`. It does not have the `toasts` list, because it is not in a component.

<<< ./toast/GlobalManager.vue

All server requests share a manager of a module. A server render does not subscribe the provider to its manager, so a toast of one request does not go to another request.

## Stacking and animations

Use the `--toast-index` CSS variable for the stacking order of the toasts. The toast with the index 0 is at the front.

```css
.Toast {
  z-index: calc(1000 - var(--toast-index));
  transform: scale(calc(max(0, 1 - (var(--toast-index) * 0.1))));
}
```

The `--toast-offset-y` CSS variable gives the vertical offset of a toast when the toasts are positioned absolutely with a translation offset. Use it with the `data-expanded` attribute. The attribute is present while the pointer is on the viewport or the viewport has the focus.

```css
.Toast[data-expanded] {
  transform: translateY(var(--toast-offset-y));
}
```

While the stack is collapsed, clamp the height of each toast to the height of the frontmost toast with the `--toast-frontmost-height` CSS variable. Use `<Toast.Content>` to hide the content of the toasts behind it. The `data-behind` attribute marks the content behind the frontmost toast. Use it with the `data-expanded` attribute, so that the content fades in again when the viewport expands:

```css
.Toast {
  height: var(--toast-frontmost-height, var(--toast-height));
}

.ToastContent {
  transition: opacity 0.25s;
}

.ToastContent[data-behind] {
  opacity: 0;
}

.ToastContent[data-expanded] {
  opacity: 1;
}
```

The `--toast-swipe-movement-x` and `--toast-swipe-movement-y` CSS variables give the swipe movement of a toast. Use them in a translation offset.

```css
.Toast {
  transform: scale(calc(max(0, 1 - (var(--toast-index) * 0.1))))
    translateX(var(--toast-swipe-movement-x))
    translateY(calc(var(--toast-swipe-movement-y) + (var(--toast-index) * -20%)));
}
```

The `data-swipe-direction` attribute gives the direction of the swipe. Use it in a translation offset when the toast closes.

```css
&[data-ending-style] {
  opacity: 0;

  &[data-swipe-direction='up'] {
    transform: translateY(calc(var(--toast-swipe-movement-y) - 150%));
  }
  &[data-swipe-direction='down'] {
    transform: translateY(calc(var(--toast-swipe-movement-y) + 150%));
  }
  /* Note: --offset-y is defined locally in these examples and derives from
   --toast-offset-y, --toast-index, and swipe movement values */
  &[data-swipe-direction='left'] {
    transform: translateX(calc(var(--toast-swipe-movement-x) - 150%)) translateY(var(--offset-y));
  }
  &[data-swipe-direction='right'] {
    transform: translateX(calc(var(--toast-swipe-movement-x) + 150%)) translateY(var(--offset-y));
  }
}
```

The `data-limited` attribute shows that the toast is over the `limit` of the provider. A limited toast stays mounted with the HTML `inert` attribute. Use the attribute to hide such a toast or to animate it in a different way.

The `updateKey` property of a toast increases when the toast is updated or added again with its `id`. Use it to play an animation again: change the animation name with it. When the toast can mount again, you can also put it in the `key` of the root.

## Examples

### Anchored toasts

To anchor a toast to an element, render it in `<Toast.Positioner>` and give the element as `anchor` in the `positionerProps` option of `add`. Use this for feedback in context, such as a short "Copied" toast next to the button that copied the text.

<DemoFrame>
  <DemoToastAnchored />
</DemoFrame>

::: code-group

<<< ../demos/toast/anchored/css-modules/index.vue

<<< ../demos/toast/anchored/css-modules/AnchoredToasts.vue

<<< ../demos/toast/anchored/css-modules/CopyButton.vue

<<< ../demos/toast/anchored/css-modules/anchoredToastManager.ts

<<< ../demos/toast/anchored/css-modules/index.module.css

:::

A prop of `<Toast.Positioner>` wins over the same key of `positionerProps`. When neither of them sets a key, the positioner uses the default of that key: `'top'` for `side`, `'center'` for `align`, `0` for `sideOffset` and `alignOffset`, `5` for `arrowPadding` and `collisionPadding`, `'clipping-ancestors'` for `collisionBoundary`, `'absolute'` for `positionMethod`, and `false` for `sticky` and `disableAnchorTracking`.

Render the anchored toasts in a `<Toast.Provider>` of their own, apart from the stacked toasts. Make a global toast manager for each provider, so that the app can manage each kind of toast:

<<< ./toast/MixingManagers.vue

### Custom position

Your own CSS sets the position of the toasts. To change the position, change the styles of `.Viewport` and `.Root`. A more general component can take a `data-position` attribute, and the CSS gives each value its position. This demo shows the toasts at the top center:

<DemoFrame>
  <DemoToastPosition />
</DemoFrame>

::: code-group

<<< ../demos/toast/position/css-modules/index.vue

<<< ../demos/toast/position/css-modules/ToastButton.vue

<<< ../demos/toast/position/css-modules/ToastList.vue

<<< ../demos/toast/position/css-modules/index.module.css

:::

### Undo action

The `actionProps` option of `add` gives the props of an action button in the toast. Use it to undo the action that the toast tells about.

<DemoFrame>
  <DemoToastUndo />
</DemoFrame>

::: code-group

<<< ../demos/toast/undo/css-modules/index.vue

<<< ../demos/toast/undo/css-modules/UndoForm.vue

<<< ../demos/toast/undo/css-modules/ToastList.vue

<<< ../demos/toast/undo/css-modules/index.module.css

:::

### Promise

An asynchronous toast has three states: `loading`, `success` and `error`. The `type` string of the toast has the name of the state, so a style can change with it. Each state also accepts an object of options of the toast. See [promise method](#promise-method).

<DemoFrame>
  <DemoToastPromise />
</DemoFrame>

::: code-group

<<< ../demos/toast/promise/css-modules/index.vue

<<< ../demos/toast/promise/css-modules/PromiseDemo.vue

<<< ../demos/toast/promise/css-modules/ToastList.vue

<<< ../demos/toast/promise/css-modules/index.module.css

:::

### Custom

To give a toast custom data, pass an object of your own type in the `data` option. The object can hold any data, functions also, and the template of the toast can read it.

<DemoFrame>
  <DemoToastCustom />
</DemoFrame>

::: code-group

<<< ../demos/toast/custom/css-modules/index.vue

<<< ../demos/toast/custom/css-modules/CustomToast.vue

<<< ../demos/toast/custom/css-modules/CustomToastData.ts

<<< ../demos/toast/custom/css-modules/ToastList.vue

<<< ../demos/toast/custom/css-modules/index.module.css

:::

### Deduplicated toast

When you add a toast again with the same `id`, its `updateKey` property increases, so that a custom template can play an animation again. This demo changes between two CSS animation names with `updateKey`. The same toast stays mounted, and the pulse plays again.

<DemoFrame>
  <DemoToastDeduplicate />
</DemoFrame>

::: code-group

<<< ../demos/toast/deduplicate/css-modules/index.vue

<<< ../demos/toast/deduplicate/css-modules/PulseToastButton.vue

<<< ../demos/toast/deduplicate/css-modules/ToastList.vue

<<< ../demos/toast/deduplicate/css-modules/index.module.css

:::

### Varying heights

To stack toasts of different heights, clamp the height of each toast to the height of the frontmost toast with the `--toast-frontmost-height` CSS variable. The `data-behind` attribute hides the content of the toasts behind it. Do not give `<Toast.Content>` the height of the root, such as `height: 100%`. A change of its height with the root stops the height transition of the root.

<DemoFrame>
  <DemoToastVaryingHeights />
</DemoFrame>

::: code-group

<<< ../demos/toast/varying-heights/css-modules/index.vue

<<< ../demos/toast/varying-heights/css-modules/ToastButton.vue

<<< ../demos/toast/varying-heights/css-modules/ToastList.vue

<<< ../demos/toast/varying-heights/css-modules/index.module.css

:::

## API reference

<ApiReference />

## useToastManager

Manages the toasts. Call it in `setup` of a component inside a `<Toast.Provider>`.

<<< ./toast/ManagerMethods.vue#usage{ts}

It returns `toasts` as a `ComputedRef` of the list. Read `toasts.value` in a script. A template unwraps a `toasts` that you destructure at the top level of `<script setup>`.

<ApiReference name="Toast.useToastManager" />

### `add` method

Makes a toast and adds it to the list of toasts.

When you give an `id` that the list has, the toast with that id changes in place. The list gets no second toast.

It returns the `toastId`. Use it to update or close the toast later.

<<< ./toast/ManagerMethods.vue#add{ts}

<<< ./toast/AddToast.vue

The `title` and the `description` are a text, a number, or a function that returns the content. Use a function for rich content. A label is not a vnode, because the label of a toast with the priority `high` shows in the toast and in the announcement of the viewport. A vnode that mounts two times on a hydrated page loses its components.

<<< ./toast/ManagerMethods.vue#label-function{ts}

For a toast with the priority `high`, a screen reader announces the `title` and the `description`. A screen reader does not announce other content of `<Toast.Root>`, the content of `<Toast.Title>` and `<Toast.Description>` included, unless the user moves to the toast viewport.

### `update` method

Changes the options of the toast.

<<< ./toast/ManagerMethods.vue#update{ts}

The options replace the values of the toast. Custom `data` is also replaced as a whole. To make the update from the current toast, pass a function. It gets the current toast and returns the options. Custom `data` is `undefined` when the toast has none yet:

<<< ./toast/ManagerMethods.vue#update-function{ts}

### `close` method

Closes the toast. The toast goes from the list after its animations end.

<<< ./toast/ManagerMethods.vue#close{ts}

To close all toasts, give no id:

<<< ./toast/ManagerMethods.vue#close-all{ts}

### `promise` method

Makes an asynchronous toast with three states: `loading`, `success` and `error`.

<<< ./toast/ManagerMethods.vue#promise{ts}

The `loading` state accepts the options of the `add` method. The `success` and `error` states accept the options of the `update` method:

<<< ./toast/ManagerMethods.vue#promise-options{ts}

Give `loading.id` to update or close the toast with that id. An id that the list has updates that toast in place, and the list gets no second toast.
