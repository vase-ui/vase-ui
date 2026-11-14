import { describe, expect, it } from 'vitest';
import type { VNode } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';

describe('Menu filter parts conformance', () => {
  const { render } = createRenderer();

  function renderInPopup(node: VNode, filterProps?: Partial<Menu.FilterProvider.Props>) {
    return render(
      <Menu.FilterProvider {...filterProps}>
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter" />
                {node}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );
  }

  function renderInList(node: VNode) {
    return renderInPopup(<Menu.List>{node}</Menu.List>);
  }

  describeConformance(<Menu.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render: (node) =>
      render(
        <Menu.FilterProvider>
          <Menu.Root>{node}</Menu.Root>
        </Menu.FilterProvider>,
      ),
  }));

  // A second input is in the popup. A case that replaces the input with a component that has no
  // element leaves the menu with no input, and the menu then warns a second time.
  describeConformance(<Menu.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    render: (node) => renderInPopup(node),
  }));

  describeConformance(<Menu.Clear />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render: (node) => renderInPopup(node, { defaultValue: 'query' }),
  }));

  it('excludes Clear from the tab order and accessibility tree', async () => {
    await renderInPopup(<Menu.Clear aria-label="Clear filter" />, { defaultValue: 'query' });

    const clear = screen.getByLabelText('Clear filter');
    expect(clear).toHaveAttribute('tabindex', '-1');
    expect(clear).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBe(null);
  });

  describeConformance(<Menu.Empty />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => renderInPopup(node),
  }));

  describeConformance(<Menu.List />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => renderInPopup(node),
  }));

  // The input is beside the popup. A popup that a case replaces with a component can drop its slot,
  // and the menu then has no input.
  describeConformance(<Menu.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) =>
      render(
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                {node}
                <Menu.Input aria-label="Filter" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      ),
  }));

  describeConformance(<Menu.Item />, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render: renderInList,
  }));

  describeConformance(<Menu.LinkItem href="#" />, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: renderInList,
  }));

  describeConformance(<Menu.CheckboxItem />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: renderInList,
  }));

  describeConformance(
    <Menu.RadioGroup>
      <Menu.RadioItem value="value" />
    </Menu.RadioGroup>,
    () => ({
      refInstanceof: window.HTMLDivElement,
      render: renderInList,
    }),
  );

  describeConformance(<Menu.RadioItem value="value" />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => renderInList(<Menu.RadioGroup defaultValue="value">{node}</Menu.RadioGroup>),
  }));

  describeConformance(<Menu.Group />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: renderInList,
  }));

  describeConformance(<Menu.Arrow />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => renderInPopup(node),
  }));

  describeConformance(<Menu.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) =>
      render(
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              {node}
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter" />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      ),
  }));

  describeConformance(<Menu.Separator />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: renderInList,
  }));

  // These cases are the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when Trigger is rendered without a root or handle', async () => {
    await expect(render(<Menu.Trigger />)).rejects.toThrow(
      'Vase UI: <Menu.Trigger> must be inside <Menu.Root>, or it must have a `handle`. Without a root the trigger has no menu to open. Put the trigger inside <Menu.Root>, or pass a `handle`.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });

  it.each([
    ['Input', <Menu.Input />],
    ['Clear', <Menu.Clear />],
    ['Empty', <Menu.Empty />],
  ])('throws when <Menu.%s> is rendered without a filter provider', async (part, element) => {
    await expect(render(element)).rejects.toThrow(
      `Vase UI: <Menu.${part}> must be placed in a menu wrapped in <Menu.FilterProvider>.`,
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
