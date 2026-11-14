import { describe, expect, it, vi } from 'vitest';
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

  it.each(portalParts)('$name does not render the inner part with a #render slot', async (part) => {
    expect(await renderOuterAgain(part, true)).not.toHaveBeenCalled();
  });
});
