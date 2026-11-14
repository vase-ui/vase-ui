import { describe, expect, it } from 'vitest';
import { h, nextTick, shallowRef, Transition, vShow, withDirectives } from 'vue';
import type { Component, Directive, VNode } from 'vue';
import { createRenderer, screen } from '#test-utils';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { Popover } from '@vase-ui/vue/popover';
import { Select } from '@vase-ui/vue/select';
import { createAttribute } from '../createAttribute';
import PopupRootNodeScoped from './PopupRootNodeScoped.test.vue';

type Mode = 'scoped style' | 'custom directive' | 'v-show' | 'Transition';

interface PopupFamily {
  name: string;
  part: Component;
  /** The open tree of the family around a vnode of the part. */
  tree: (popup: VNode) => VNode;
  /** The nodes that the part keeps beside its element. */
  siblings: 'guards' | 'dismiss button';
}

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};

const open = { defaultOpen: true };

const families: PopupFamily[] = [
  {
    name: 'Dialog.Popup',
    part: Dialog.Popup,
    tree: (popup) => h(Dialog.Root, open, () => h(Dialog.Portal, null, () => popup)),
    siblings: 'guards',
  },
  {
    name: 'AlertDialog.Popup',
    part: AlertDialog.Popup,
    tree: (popup) => h(AlertDialog.Root, open, () => h(AlertDialog.Portal, null, () => popup)),
    siblings: 'guards',
  },
  {
    name: 'Drawer.Popup',
    part: Drawer.Popup,
    tree: (popup) =>
      h(Drawer.Root, open, () =>
        h(Drawer.Portal, null, () => h(Drawer.Viewport, null, () => popup)),
      ),
    siblings: 'guards',
  },
  {
    name: 'Popover.Popup',
    part: Popover.Popup,
    tree: (popup) =>
      h(Popover.Root, open, () =>
        h(Popover.Portal, null, () => h(Popover.Positioner, null, () => popup)),
      ),
    siblings: 'guards',
  },
  {
    name: 'Menu.Popup',
    part: Menu.Popup,
    tree: (popup) =>
      h(Menu.Root, open, () => h(Menu.Portal, null, () => h(Menu.Positioner, null, () => popup))),
    siblings: 'guards',
  },
  {
    name: 'ContextMenu.Popup',
    part: ContextMenu.Popup,
    tree: (popup) =>
      h(ContextMenu.Root, open, () => [
        h(ContextMenu.Trigger, null, () => 'Area'),
        h(ContextMenu.Portal, null, () => h(ContextMenu.Positioner, null, () => popup)),
      ]),
    siblings: 'guards',
  },
  {
    name: 'Select.Popup',
    part: Select.Popup,
    tree: (popup) =>
      h(Select.Root, open, () => [
        h(Select.Trigger, null, () => h(Select.Value)),
        h(Select.Portal, null, () => h(Select.Positioner, null, () => popup)),
      ]),
    siblings: 'guards',
  },
  {
    name: 'Combobox.Popup',
    part: Combobox.Popup,
    tree: (popup) =>
      h(Combobox.Root, { ...open, items: ['a'] }, () => [
        h(Combobox.Input),
        h(Combobox.Portal, null, () => h(Combobox.Positioner, null, () => popup)),
      ]),
    siblings: 'dismiss button',
  },
  {
    name: 'Autocomplete.Popup',
    part: Autocomplete.Popup,
    tree: (popup) =>
      h(Autocomplete.Root, { ...open, items: ['a'] }, () => [
        h(Autocomplete.Input),
        h(Autocomplete.Portal, null, () => h(Autocomplete.Positioner, null, () => popup)),
      ]),
    siblings: 'dismiss button',
  },
];

const modes: Mode[] = ['scoped style', 'custom directive', 'v-show', 'Transition'];

const rows = families.flatMap((family) =>
  modes.map((mode) => ({ name: `${family.name}: ${mode}`, family, mode })),
);

const attributes = { class: 'part', 'data-testid': 'part' };

function isInsideGuard(element: Element | null) {
  return (
    element?.hasAttribute(createAttribute('focus-guard')) === true &&
    element.getAttribute('data-type') === 'inside'
  );
}

describe('VUE-60: each popup part has one root node', () => {
  const { render } = createRenderer();

  it.each(rows)('$name', async ({ family, mode }) => {
    const shown = shallowRef(true);

    function renderPart() {
      switch (mode) {
        case 'scoped style':
          return h(PopupRootNodeScoped, { part: family.part });
        case 'custom directive':
          return withDirectives(h(family.part, attributes), [[vMark, 'marked']]);
        case 'v-show':
          return withDirectives(h(family.part, attributes), [[vShow, shown.value]]);
        case 'Transition':
          return h(Transition, null, () => h(family.part, attributes));
      }
    }

    await render(() => family.tree(renderPart()));
    const popup = await screen.findByTestId('part');

    if (family.siblings === 'guards') {
      expect([popup.previousElementSibling, popup.nextElementSibling].map(isInsideGuard)).toEqual([
        true,
        true,
      ]);
    } else {
      expect(popup.nextElementSibling).toHaveAttribute('role', 'button');
      expect(popup.nextElementSibling).toHaveAttribute('aria-label', 'Dismiss');
    }

    if (mode === 'scoped style') {
      expect(getComputedStyle(popup).outlineStyle).toBe('dashed');
    } else if (mode === 'custom directive') {
      expect(popup).toHaveAttribute('data-mark', 'marked');
    } else if (mode === 'v-show') {
      shown.value = false;
      await nextTick();
      expect(getComputedStyle(popup).display).toBe('none');
    }
  });
});
