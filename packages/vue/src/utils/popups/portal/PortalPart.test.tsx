import { describe, expect, it, vi } from 'vitest';
import { h, nextTick, render as renderVNode } from 'vue';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import * as Combobox from '../../../combobox/index.parts';
import * as Dialog from '../../../dialog/index.parts';
import * as Menu from '../../../menu/index.parts';
import * as NavigationMenu from '../../../navigation-menu/index.parts';
import * as Popover from '../../../popover/index.parts';
import * as PreviewCard from '../../../preview-card/index.parts';
import * as Select from '../../../select/index.parts';
import * as Toast from '../../../toast/index.parts';
import * as Tooltip from '../../../tooltip/index.parts';
import PortalPartContent from './PortalPartContent.test.vue';
import PropReadsSlotVariable from './PropReadsSlotVariable.test.vue';

// A compiler before Vue 3.5.21 makes the slots of a part dynamic when a prop of the part reads a
// slot variable (https://github.com/vuejs/core/pull/9427). `<component :is="children">` in a
// `#render` slot has such a prop, so the parts in `children` then render again with their parent.
async function rendersInnerPartAgain() {
  const onInnerRender = vi.fn();
  const container = document.createElement('div');
  renderVNode(h(PropReadsSlotVariable, { active: false, onInnerRender }), container);
  onInnerRender.mockClear();
  renderVNode(h(PropReadsSlotVariable, { active: true, onInnerRender }), container);
  await nextTick();
  renderVNode(null, container);
  return onInnerRender.mock.calls.length > 0;
}

const keepsSlotsStable = !(await rendersInnerPartAgain());

const open = { defaultOpen: true };

const portalParts = [
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
  {
    name: 'PreviewCard.Portal',
    root: PreviewCard.Root,
    portal: PreviewCard.Portal,
    rootProps: open,
  },
  { name: 'Select.Portal', root: Select.Root, portal: Select.Portal, rootProps: open },
  { name: 'Toast.Portal', root: Toast.Provider, portal: Toast.Portal },
  { name: 'Tooltip.Portal', root: Tooltip.Root, portal: Tooltip.Portal, rootProps: open },
];

describe('portal part of each family', () => {
  const { render } = createRenderer();

  async function renderOuterAgain(part: (typeof portalParts)[number], hasRenderSlot: boolean) {
    const onOuterRender = vi.fn();
    const onInnerRender = vi.fn();
    const { setProps } = await render(
      <PortalPartContent
        root={part.root}
        portal={part.portal}
        rootProps={part.rootProps}
        portalProps={part.portalProps}
        hasRenderSlot={hasRenderSlot}
        active={false}
        onOuterRender={onOuterRender}
        onInnerRender={onInnerRender}
      />,
    );
    await screen.findByTestId('inner');
    await flushMicrotasks();
    onOuterRender.mockClear();
    onInnerRender.mockClear();

    await setProps({ active: true });
    await waitFor(() => expect(onOuterRender).toHaveBeenCalled());
    await flushMicrotasks();

    return onInnerRender;
  }

  it.each(portalParts)(
    '$name does not render the inner part when the outer part renders',
    async (part) => {
      expect(await renderOuterAgain(part, false)).not.toHaveBeenCalled();
    },
  );

  describe.runIf(keepsSlotsStable)('with a compiler from Vue 3.5.21', () => {
    it.each(portalParts)(
      '$name does not render the inner part with a #render slot',
      async (part) => {
        expect(await renderOuterAgain(part, true)).not.toHaveBeenCalled();
      },
    );
  });

  describe.runIf(!keepsSlotsStable)('with a compiler before Vue 3.5.21', () => {
    it.each(portalParts)(
      '$name renders the inner part again with a #render slot, because `children` has dynamic slots',
      async (part) => {
        expect(await renderOuterAgain(part, true)).toHaveBeenCalled();
      },
    );
  });
});
