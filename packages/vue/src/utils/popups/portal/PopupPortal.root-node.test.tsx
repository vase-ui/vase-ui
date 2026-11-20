import { describe, expect, it, vi } from 'vitest';
import { h, render as renderVNode, Teleport, Transition } from 'vue';
import { createRenderer, screen } from '#test-utils';
import FocusManagerPart from '../../../../test/fixtures/FocusManagerPart.vue';
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
});
