import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef, watch } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  flushMicrotasks,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import type { HTMLProps, VaseUIEvent } from '../../internals/types';

// Kept in a separate file so the module mock doesn't leak into `MenuFilterRoot.test.tsx`.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

// React focuses an `autoFocus` element when it mounts, before it gives the element to its ref. This
// `#render` slot does the same one time for each element, because Vue calls a function ref again on
// each patch.
const autoFocusedElements = new WeakSet<Element>();
const autoFocusSlots = {
  render: ({ props }: { props: HTMLProps }) => (
    <input
      {...props}
      ref={(element: unknown) => {
        if (element instanceof HTMLElement && !autoFocusedElements.has(element)) {
          autoFocusedElements.add(element);
          element.focus();
        }
        props.ref(element as Element | null);
      }}
    />
  ),
};

const Test = defineComponent(
  (props: { autoFocus?: boolean; inputKey?: string; showInput?: boolean }) => () => (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              {props.showInput !== false && (
                <Menu.Input
                  key={props.inputKey}
                  aria-label="Filter actions"
                  v-slots={props.autoFocus ? autoFocusSlots : {}}
                />
              )}
              <Menu.List>
                <Menu.Item>Apple</Menu.Item>
                <Menu.Item>Banana</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  ),
  { props: ['autoFocus', 'inputKey', 'showInput'] },
);

describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider> (WebKit)', () => {
  const { render } = createRenderer();

  it('marks only the highlighted item while its input is focused in WebKit', async () => {
    const { user } = await render(<Test />);

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    const banana = screen.getByRole('menuitem', { name: 'Banana' });
    expect(apple).not.toHaveAttribute('aria-selected');

    await user.keyboard('[ArrowDown]');

    expect(apple).toHaveAttribute('aria-selected', 'true');
    expect(banana).not.toHaveAttribute('aria-selected');
    expect(input).toHaveAttribute('aria-activedescendant', apple.id);

    await user.keyboard('[ArrowDown]');

    expect(apple).not.toHaveAttribute('aria-selected');
    expect(banana).toHaveAttribute('aria-selected', 'true');

    input.blur();
    await flushMicrotasks();
    expect(banana).not.toHaveAttribute('aria-selected');

    input.focus();
    await flushMicrotasks();
    expect(banana).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps selection state when a focused input is replaced', async () => {
    const { user, setProps } = await render(<Test autoFocus inputKey="first" />);
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus(),
    );

    await setProps({ inputKey: 'second' });
    const replacement = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(replacement).toHaveFocus());

    await user.keyboard('[ArrowDown]');
    expect(screen.getByRole('menuitem', { name: 'Apple' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps selection in sync when a focused input is replaced without autofocus', async () => {
    const { user, setProps } = await render(<Test autoFocus inputKey="first" />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('[ArrowDown]');
    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    expect(apple).toHaveAttribute('aria-selected', 'true');

    await setProps({ inputKey: 'second', autoFocus: false });
    const replacement = screen.getByRole('searchbox', { name: 'Filter actions' });
    expect(replacement).not.toBe(input);
    // Engines differ in whether they restore focus after removing the old input.
    expect(apple.getAttribute('aria-selected')).toBe(replacement.matches(':focus') ? 'true' : null);
  });

  it('clears selection when the focused input unmounts while the menu stays open', async () => {
    const { user, setProps } = await render(<Test autoFocus />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('[ArrowDown]');
    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    expect(apple).toHaveAttribute('aria-selected', 'true');

    await setProps({ showInput: false });
    expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null);
    expect(apple).toBeInTheDocument();
    expect(apple).not.toHaveAttribute('aria-selected');
  });

  it('does not restore selection after a focused input unmounts and the menu reopens on hover', async () => {
    const ControlledTest = defineComponent(
      (props: { close: boolean }) => {
        const open = shallowRef(true);

        watch(
          () => props.close,
          (close) => {
            if (close) {
              open.value = false;
            }
          },
          { immediate: true },
        );

        return () => (
          <Menu.FilterProvider autoHighlight="always">
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
            >
              <Menu.Trigger openOnHover delay={0}>
                Actions
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Apple</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      },
      { props: ['close'] },
    );

    const { user, setProps } = await render(<ControlledTest close={false} />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByRole('menuitem', { name: 'Apple' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await setProps({ close: true });
    await waitFor(() =>
      expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null),
    );

    await user.hover(screen.getByRole('button', { name: 'Actions' }));
    const reopenedInput = await screen.findByRole('searchbox', { name: 'Filter actions' });
    expect(reopenedInput).not.toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Apple' })).not.toHaveAttribute('aria-selected');
  });

  it('preserves checked state on checkbox and radio items in WebKit', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.CheckboxItem defaultChecked>Details</Menu.CheckboxItem>
                  <Menu.RadioGroup defaultValue="date">
                    <Menu.RadioItem value="date">Date</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const checkbox = screen.getByRole('menuitemcheckbox', { name: 'Details' });
    const radio = screen.getByRole('menuitemradio', { name: 'Date' });
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    expect(checkbox).toHaveAttribute('aria-selected', 'true');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('[ArrowDown]');
    expect(radio).toHaveAttribute('aria-selected', 'true');
    expect(radio).toHaveAttribute('aria-checked', 'true');
  });

  it('marks highlighted links and submenu triggers while their input is focused in WebKit', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.LinkItem href="#docs">Documentation</Menu.LinkItem>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More actions</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.List>
                              <Menu.Item>Share</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>Plain submenu</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Item>Copy</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const link = screen.getByRole('menuitem', { name: 'Documentation' });
    const submenuTrigger = screen.getByRole('menuitem', { name: 'More actions' });
    const plainSubmenuTrigger = screen.getByRole('menuitem', { name: 'Plain submenu' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    expect(link).toHaveAttribute('aria-selected', 'true');
    expect(submenuTrigger).not.toHaveAttribute('aria-selected');
    expect(input).toHaveAttribute('aria-activedescendant', link.id);

    await user.keyboard('[ArrowDown]');
    expect(link).not.toHaveAttribute('aria-selected');
    expect(submenuTrigger).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

    expect(plainSubmenuTrigger).not.toHaveAttribute('aria-selected');
    await user.keyboard('[ArrowDown]');

    expect(submenuTrigger).not.toHaveAttribute('aria-selected');
    expect(plainSubmenuTrigger).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', plainSubmenuTrigger.id);
  });

  it('marks items inside an opened submenu while its input is focused', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More actions</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more actions" />
                            <Menu.List>
                              <Menu.Item>Share</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });
    const submenuInput = await waitForLaterMillisecond(async () => {
      await user.keyboard('[ArrowDown][ArrowRight]');
      return screen.findByRole('searchbox', { name: 'Filter more actions' });
    });
    await waitFor(() => {
      expect(submenuInput).toHaveFocus();
    });

    const shareItem = screen.getByRole('menuitem', { name: 'Share' });
    const submenuTrigger = screen.getByRole('menuitem', { name: 'More actions' });
    expect(submenuTrigger).not.toHaveAttribute('aria-selected');
    expect(shareItem).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('[ArrowUp]');
    expect(shareItem).not.toHaveAttribute('aria-selected');

    await user.keyboard('[ArrowDown]');

    expect(shareItem).toHaveAttribute('aria-selected', 'true');
    expect(submenuInput).toHaveAttribute('aria-activedescendant', shareItem.id);
  });

  it('leaves plain menu items alone, which navigate with real focus', async () => {
    const { user } = await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Apple</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    expect(apple).not.toHaveAttribute('aria-selected');

    await waitFor(() => {
      expect(screen.getByRole('menu')).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(apple).toHaveAttribute('data-highlighted');
    });
    expect(apple).not.toHaveAttribute('aria-selected');
  });
});

describe('focus listeners of Menu.Input', () => {
  const { render } = createRenderer();

  it('shows the focus ring of an input that replaces a focused input', async () => {
    const { setProps } = await render(<Test autoFocus inputKey="first" />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    await waitFor(() => expect(input).toHaveAttribute('data-highlighted'));

    // A Vue listener of a new input misses the focus of the mount only in most runs, so the case
    // replaces the input three times.
    let previous = input;
    for (const inputKey of ['second', 'third', 'fourth']) {
      await setProps({ inputKey });
      const replacement = screen.getByRole('searchbox', { name: 'Filter actions' });
      expect(replacement).not.toBe(previous);
      previous = replacement;
      await waitFor(() => expect(replacement).toHaveFocus());
      await waitSingleFrame();

      expect(replacement).toHaveAttribute('data-highlighted');
    }
  });

  it('lets a focusin listener of the consumer stop the focus listeners of the input', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input
                  aria-label="Filter actions"
                  onFocusin={(event: VaseUIEvent<FocusEvent>) => {
                    event.preventVaseUIHandler();
                  }}
                />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    await flushMicrotasks();
    expect(input).not.toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowDown]');
    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    expect(input).toHaveAttribute('aria-activedescendant', apple.id);
    expect(apple).not.toHaveAttribute('aria-selected');
  });
});
