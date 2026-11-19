import { describe, expect, it, vi } from 'vitest';
import { h, render as renderVNode, Teleport, Transition } from 'vue';
import type { Component } from 'vue';
import { createRenderer, screen } from '#test-utils';
import FocusManagerPart from '../../../../test/fixtures/FocusManagerPart.vue';
import * as Combobox from '../../../combobox/index.parts';
import * as Dialog from '../../../dialog/index.parts';
import * as Menu from '../../../menu/index.parts';
import * as NavigationMenu from '../../../navigation-menu/index.parts';
import * as Popover from '../../../popover/index.parts';
import * as Select from '../../../select/index.parts';
import { createAttribute } from '../createAttribute';
import { usePortalFocus } from './usePortalFocus';
import PopupPortal from './PopupPortal.vue';

// Vue 3.5.41 and 3.6.0-rc.3 are the first versions that give a `Transition` to the element in a
// `Teleport` that is the root node of a component (https://github.com/vuejs/core/pull/11959). An
// earlier version warns and animates nothing.
function givesTransitionToTeleportChild() {
  const container = document.createElement('div');
  const entered: Element[] = [];
  const TeleportRoot = () => h(Teleport, { to: container }, [h('div')]);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    renderVNode(
      h(Transition, { appear: true, onEnter: (element: Element) => entered.push(element) }, () =>
        h(TeleportRoot),
      ),
      container,
    );
    renderVNode(null, container);
  } finally {
    warn.mockRestore();
  }
  return entered.length > 0;
}

const transitionReachesTeleportChild = givesTransitionToTeleportChild();

const open = { defaultOpen: true };

// A generic part, such as `Combobox.Root`, is a function that `Component` does not accept.
type PartComponent = Component | ((...args: any[]) => any);

interface FloatingPortalPart {
  name: string;
  root: PartComponent;
  portal: PartComponent;
  rootProps?: Record<string, unknown>;
  portalProps?: Record<string, unknown>;
}

const floatingPortalParts: FloatingPortalPart[] = [
  { name: 'Combobox.Portal', root: Combobox.Root, portal: Combobox.Portal, rootProps: open },
  { name: 'Dialog.Portal', root: Dialog.Root, portal: Dialog.Portal, rootProps: open },
  { name: 'Menu.Portal', root: Menu.Root, portal: Menu.Portal, rootProps: open },
  {
    name: 'NavigationMenu.Portal',
    root: NavigationMenu.Root,
    portal: NavigationMenu.Portal,
    portalProps: { keepMounted: true },
  },
  { name: 'Popover.Portal', root: Popover.Root, portal: Popover.Portal, rootProps: open },
  { name: 'Select.Portal', root: Select.Root, portal: Select.Portal, rootProps: open },
];

describe.runIf(transitionReachesTeleportChild)('VUE-60: the portal has one root node', () => {
  const { render } = createRenderer();

  it('gives a Transition of the consumer to the portal element, also while the guards are in the document', async () => {
    const entered: Element[] = [];
    await render(
      <div data-testid="host">
        <Transition appear onEnter={(element: Element) => entered.push(element)}>
          <PopupPortal guards={usePortalFocus} data-testid="portal">
            <FocusManagerPart>
              <input />
            </FocusManagerPart>
          </PopupPortal>
        </Transition>
      </div>,
    );

    const host = screen.getByTestId('host');
    expect(host.querySelectorAll('[data-type="outside"]')).toHaveLength(2);
    expect(host.querySelectorAll(`span:not([${createAttribute('focus-guard')}])`)).toHaveLength(1);
    expect(entered).toEqual([screen.getByTestId('portal')]);
  });

  it.each(floatingPortalParts)(
    '$name gives a Transition of the consumer to its portal element',
    async (part) => {
      const entered: Element[] = [];
      await render(
        h(part.root, part.rootProps, () =>
          h(
            Transition,
            { appear: true, onEnter: (element: Element) => entered.push(element) },
            () =>
              h(part.portal, { 'data-testid': 'portal', ...part.portalProps }, () =>
                h('span', 'content'),
              ),
          ),
        ),
      );

      const portal = await screen.findByTestId('portal');
      expect(entered).toEqual([portal]);
    },
  );
});
