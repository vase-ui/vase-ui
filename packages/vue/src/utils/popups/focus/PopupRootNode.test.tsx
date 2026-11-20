import { describe, expect, it } from 'vitest';
import { h, nextTick, shallowRef, Transition, vShow, withDirectives } from 'vue';
import type { Component, Directive, VNode } from 'vue';
import { createRenderer, screen, takeReportedMessages } from '#test-utils';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { Select } from '@vase-ui/vue/select';
import { MountedElementTarget } from '../../../../test/fixtures/MountedElementTarget';
import type { HTMLProps } from '../../../internals/types';
import { createAttribute } from '../createAttribute';
import PopupRootNodeScoped from './PopupRootNodeScoped.test.vue';

type Mode = 'scoped style' | 'custom directive' | 'v-show' | 'Transition';

interface PopupFamily {
  name: string;
  part: Component;
  /** The open tree of the family around a vnode of the part. */
  tree: (popup: VNode) => VNode;
}

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};

const families: PopupFamily[] = [
  {
    name: 'Dialog.Popup',
    part: Dialog.Popup,
    tree: (popup) => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>{popup}</Dialog.Portal>
      </Dialog.Root>
    ),
  },
  {
    name: 'AlertDialog.Popup',
    part: AlertDialog.Popup,
    tree: (popup) => (
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Portal>{popup}</AlertDialog.Portal>
      </AlertDialog.Root>
    ),
  },
  {
    name: 'Drawer.Popup',
    part: Drawer.Popup,
    tree: (popup) => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>{popup}</Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ),
  },
  {
    name: 'Menu.Popup',
    part: Menu.Popup,
    tree: (popup) => (
      <Menu.Root defaultOpen>
        <Menu.Portal>
          <Menu.Positioner>{popup}</Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  },
  {
    name: 'ContextMenu.Popup',
    part: ContextMenu.Popup,
    tree: (popup) => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>Area</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>{popup}</ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ),
  },
  {
    name: 'Select.Popup',
    part: Select.Popup,
    tree: (popup) => (
      <Select.Root defaultOpen>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>{popup}</Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
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

    expect([popup.previousElementSibling, popup.nextElementSibling].map(isInsideGuard)).toEqual([
      true,
      true,
    ]);

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

describe('each popup part follows a late target of the #render slot', () => {
  const { render } = createRenderer();

  it.each(families)('$name', async (family) => {
    const useLateTarget = shallowRef(false);
    const partInstance = shallowRef<{ element: HTMLElement | null } | null>(null);

    await render(() =>
      family.tree(
        h(
          family.part,
          {
            ref: (value: unknown) => {
              partInstance.value = value as { element: HTMLElement | null } | null;
            },
          },
          {
            render: ({ props }: { props: HTMLProps }) =>
              useLateTarget.value ? (
                <MountedElementTarget {...props} />
              ) : (
                <section {...props} data-testid="initial-target" />
              ),
          },
        ),
      ),
    );
    const initial = await screen.findByTestId('initial-target');
    expect(partInstance.value?.element).toBe(initial);

    useLateTarget.value = true;
    const late = await screen.findByTestId('widget');
    await nextTick();

    expect(partInstance.value?.element).toBe(late);
    expect([late.previousElementSibling, late.nextElementSibling].map(isInsideGuard)).toEqual([
      true,
      true,
    ]);
    expect(takeReportedMessages()).toEqual([]);
  });
});
