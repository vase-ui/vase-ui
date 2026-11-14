import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef, Teleport } from 'vue';
import type { PropType } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
import { reset as resetWarnings } from '../../common/warn';
import * as Menu from '../../menu/index.parts';
import { useFilterDropdownRoot } from './FilterDropdownRoot';
import type {
  FilterDropdownRootChangeEventDetails,
  FilterDropdownRootContext,
} from './FilterDropdownRootContext';

describe('<FilterDropdown.Root />', () => {
  const { render } = createRenderer();

  it('renders the expected markup and ARIA relationships', async () => {
    await render(
      <>
        <button type="button" id="host-trigger">
          Choose a country
        </button>
        <TestFilterDropdownRoot open value="" triggerId="host-trigger">
          <FilterDropdown.Popup id={undefined}>
            <FilterDropdown.Input aria-label="Filter countries" />
            <FilterDropdown.List id={undefined} data-testid="list" />
          </FilterDropdown.Popup>
        </TestFilterDropdownRoot>
      </>,
    );

    const popup = screen.getByRole('dialog', { name: 'Choose a country' });
    const input = screen.getByRole('searchbox', { name: 'Filter countries' });
    const list = screen.getByRole('menu', { name: 'Choose a country' });

    expect(popup.tagName).toBe('DIV');
    expect(popup).toHaveAttribute('aria-labelledby', 'host-trigger');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('id');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'search');
    expect(input).not.toHaveAttribute('enterkeyhint');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'none');
    expect(input).not.toHaveAttribute('role', 'combobox');
    expect(input).not.toHaveAttribute('aria-expanded');
    expect(list).toHaveAttribute('id');
    expect(list).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('keeps focus on the input when the list or popup background is clicked', async () => {
    const { user } = await render(
      <TestFilterDropdownRoot open value="">
        <FilterDropdown.Popup id={undefined} data-testid="popup">
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.List id={undefined} />
        </FilterDropdown.Popup>
      </TestFilterDropdownRoot>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter countries' });
    const list = screen.getByRole('menu');

    await user.click(input);
    await user.click(list);
    expect(input).toHaveFocus();

    await user.click(screen.getByTestId('popup'));

    expect(input).toHaveFocus();
  });

  it('focuses the input when the pointer enters or the popup itself receives focus', async () => {
    const { user } = await render(
      <TestFilterDropdownRoot open value="">
        <FilterDropdown.Popup id={undefined} data-testid="popup" tabindex={-1}>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.List id={undefined}>
            <div role="menuitem">Canada</div>
          </FilterDropdown.List>
        </FilterDropdown.Popup>
        <button type="button">Outside</button>
      </TestFilterDropdownRoot>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter countries' });
    const outside = screen.getByRole('button', { name: 'Outside' });
    const popup = screen.getByTestId('popup');

    outside.focus();
    await flushMicrotasks();
    await user.hover(popup);
    expect(input).toHaveFocus();

    outside.focus();
    popup.focus();
    await flushMicrotasks();
    expect(input).toHaveFocus();
  });

  it('does not focus a parent input when the pointer enters a portalled nested popup', async () => {
    const { user } = await render(
      <TestFilterDropdownRoot open value="">
        <FilterDropdown.Popup id={undefined} data-testid="parent-popup">
          <FilterDropdown.Input aria-label="Filter parent items" />
          <TestFilterDropdownRoot open value="">
            <Teleport to={document.body}>
              <FilterDropdown.Popup id={undefined} data-testid="child-popup">
                <FilterDropdown.Input aria-label="Filter child items" />
              </FilterDropdown.Popup>
            </Teleport>
          </TestFilterDropdownRoot>
        </FilterDropdown.Popup>
      </TestFilterDropdownRoot>,
    );

    const parentInput = screen.getByRole('searchbox', { name: 'Filter parent items' });
    const childInput = screen.getByRole('searchbox', { name: 'Filter child items' });

    parentInput.focus();
    await flushMicrotasks();
    await user.hover(screen.getByTestId('child-popup'));

    expect(childInput).toHaveFocus();
  });

  it('does not focus a parent input when the pointer enters an inline nested popup', async () => {
    const { user } = await render(
      <TestFilterDropdownRoot open value="">
        <FilterDropdown.Popup id={undefined} data-testid="parent-popup">
          <FilterDropdown.Input aria-label="Filter parent items" />
          <TestFilterDropdownRoot open value="">
            <FilterDropdown.Popup id={undefined} data-testid="child-popup">
              <FilterDropdown.Input aria-label="Filter child items" />
            </FilterDropdown.Popup>
          </TestFilterDropdownRoot>
        </FilterDropdown.Popup>
      </TestFilterDropdownRoot>,
    );

    const parentInput = screen.getByRole('searchbox', { name: 'Filter parent items' });
    const childInput = screen.getByRole('searchbox', { name: 'Filter child items' });

    parentInput.focus();
    await flushMicrotasks();
    await user.hover(screen.getByTestId('child-popup'));

    expect(childInput).toHaveFocus();
  });

  it('updates relationships when id props change', async () => {
    const App = defineComponent(() => {
      const version = shallowRef('first');

      return () => (
        <TestFilterDropdownRoot open value="">
          <FilterDropdown.Popup id={`${version.value}-popup`}>
            <FilterDropdown.Input aria-label="Filter actions" />
            <FilterDropdown.List id={`${version.value}-list`} />
            <button
              type="button"
              onClick={() => {
                version.value = 'second';
              }}
            >
              Change ids
            </button>
          </FilterDropdown.Popup>
        </TestFilterDropdownRoot>
      );
    });

    const { user } = await render(<App />);
    const popup = screen.getByRole('dialog');
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const list = screen.getByRole('menu');

    await user.click(screen.getByRole('button', { name: 'Change ids' }));

    expect(popup).toHaveAttribute('id', 'second-popup');
    expect(input).toHaveAttribute('aria-controls', 'second-list');
    expect(list).toHaveAttribute('id', 'second-list');
  });

  it('releases id overrides when their props are removed', async () => {
    const App = defineComponent(() => {
      const customIds = shallowRef(true);

      return () => (
        <TestFilterDropdownRoot open value="">
          <FilterDropdown.Popup id={customIds.value ? 'custom-popup' : undefined}>
            <FilterDropdown.Input aria-label="Filter actions" />
            <FilterDropdown.List id={customIds.value ? 'custom-list' : undefined} />
            <button
              type="button"
              onClick={() => {
                customIds.value = false;
              }}
            >
              Remove ids
            </button>
          </FilterDropdown.Popup>
        </TestFilterDropdownRoot>
      );
    });

    const { user } = await render(<App />);
    const popup = screen.getByRole('dialog');
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const list = screen.getByRole('menu');

    await user.click(screen.getByRole('button', { name: 'Remove ids' }));
    await flushMicrotasks();

    expect(popup).not.toHaveAttribute('id', 'custom-popup');
    expect(list).not.toHaveAttribute('id', 'custom-list');
    // Removing an explicit id must return the element to its generated one, not leave it dangling.
    expect(popup.id).not.toBe('');
    expect(input.getAttribute('aria-controls')).toBe(list.id);
  });

  it('keeps the live region in sync with a changing Empty message', async () => {
    const App = defineComponent(() => {
      const value = shallowRef('zz');

      return () => (
        <TestFilterDropdownRoot
          open
          value={value.value}
          onValueChange={(nextValue: string) => {
            value.value = nextValue;
          }}
        >
          <FilterDropdown.Popup id={undefined}>
            <FilterDropdown.Input aria-label="Filter countries" />
            <FilterDropdown.Empty>No matches for {value.value}</FilterDropdown.Empty>
            <FilterDropdown.List id={undefined} />
          </FilterDropdown.Popup>
        </TestFilterDropdownRoot>
      );
    });

    const { user } = await render(<App />);
    const status = screen.getByRole('status');

    await waitFor(() => {
      expect(status).toHaveTextContent('No matches for zz');
    });

    await user.type(screen.getByRole('searchbox', { name: 'Filter countries' }), 'q');

    await waitFor(() => {
      expect(status).toHaveTextContent('No matches for zzq');
    });
  });

  describe('prop: filter with null', () => {
    const ServerResults = defineComponent({
      props: {
        items: { type: Array as PropType<string[]>, required: true },
        autoHighlight: { type: Boolean, default: false },
      },
      setup: (props) => () => (
        <Menu.FilterProvider autoHighlight={props.autoHighlight} filter={null}>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    {props.items.map((item) => (
                      <Menu.Item key={item}>{item}</Menu.Item>
                    ))}
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
    });

    it('clears a stale highlight when the item set changes', async () => {
      const { user, setProps } = await render(<ServerResults items={['A', 'B', 'C']} />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      // `null` runs no match pass, but the query still has to change for the highlight to be
      // reconciled against the new results.
      await fireEvent.input(input, { target: { value: 'q' } });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown][ArrowDown][ArrowDown]');

      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'C' }).id,
        );
      });

      // Results swap under the highlight. Leaving `activeIndex` alone would point the cursor at
      // whatever moved into that slot, and Enter would run an item the user never chose.
      await setProps({ items: ['X', 'Y', 'Z'] });
      await flushMicrotasks();

      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('keeps autoHighlight seeding the first item', async () => {
      const { setProps } = await render(<ServerResults items={['A', 'B']} autoHighlight />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });

      // The consumer owns matching, so the rendered set never changes here. Seeding must still
      // follow the query.
      await fireEvent.input(input, { target: { value: 'q' } });

      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'A' }).id,
        );
      });

      // A query that matches nothing, then results returning, must seed again rather than leave
      // the list unhighlighted.
      await setProps({ items: [] });
      await flushMicrotasks();
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await setProps({ items: ['X', 'Y'] });

      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'X' }).id,
        );
      });
    });
  });

  it('clears a stale highlight when items change with an empty query', async () => {
    const Results = defineComponent({
      props: { items: { type: Array as PropType<string[]>, required: true } },
      setup: (props) => () => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    {props.items.map((item) => (
                      <Menu.Item key={item}>{item}</Menu.Item>
                    ))}
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
    });

    const { user, setProps } = await render(<Results items={['A', 'B']} />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await user.keyboard('[ArrowDown][ArrowDown]');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('menuitem', { name: 'B' }).id,
    );

    await setProps({ items: ['B', 'A'] });
    await flushMicrotasks();

    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('useFilterDropdownRoot', () => {
  const { render } = createRenderer();

  it('resets the focus ring state in the write of openedByKeyboard', async () => {
    const openedByKeyboard = shallowRef(false);
    let rootContext: FilterDropdownRootContext | undefined;
    const Host = defineComponent(() => {
      ({ rootContext } = useFilterDropdownRoot({
        open: true,
        value: '',
        openedByKeyboard,
        listRef: shallowRef([]),
        getActiveIndex: getNoActiveIndex,
        setActiveIndex: NOOP,
      }));
      return () => null;
    });
    await render(<Host />);

    // Base UI writes the two states in the render that reads the new value.
    openedByKeyboard.value = true;

    expect(rootContext?.inputFocusVisible.value).toBe(true);
    expect(rootContext?.keyboardModality.value).toBe(true);
  });

  it('compares a later query with the query of the mount', async () => {
    const value = shallowRef('a');
    const setActiveIndex = vi.fn();
    const Host = defineComponent(() => {
      useFilterDropdownRoot({
        open: true,
        value,
        listRef: shallowRef([]),
        getActiveIndex: getNoActiveIndex,
        setActiveIndex,
      });
      return () => null;
    });
    await render(<Host />);
    expect(setActiveIndex).not.toHaveBeenCalled();

    value.value = '';
    await flushMicrotasks();

    // No item is registered, so only the change of the query clears the highlight.
    expect(setActiveIndex).toHaveBeenCalledWith(null);
  });
});

describe('useMenuFilterPopup', () => {
  const { render } = createRenderer();

  function spyOnWarnings() {
    resetWarnings();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => {
      warn.mockRestore();
    });
    return warn;
  }

  const message =
    'Vase UI: A filterable menu opened without a <Menu.Input>. The focus then has no input to stay on, so the user cannot type a query. Render the input inside <Menu.Popup>, or remove <Menu.FilterProvider> for a menu that does not filter.';

  it('warns when the popup mounts open with no input', async () => {
    const warn = spyOnWarnings();

    await render(
      <TestFilterDropdownRoot open value="">
        <FilterDropdown.Popup />
      </TestFilterDropdownRoot>,
    );

    expect(warn.mock.calls).toEqual([[message]]);
  });

  it('warns when the popup opens later with no input', async () => {
    const warn = spyOnWarnings();

    const { setProps } = await render(
      <TestFilterDropdownRoot open={false} value="">
        <FilterDropdown.Popup />
      </TestFilterDropdownRoot>,
    );
    expect(warn).not.toHaveBeenCalled();

    await setProps({ open: true });

    expect(warn.mock.calls).toEqual([[message]]);
  });
});

const TestFilterDropdownRoot = defineComponent(
  (
    props: {
      open: boolean;
      value: string;
      triggerId?: string | undefined;
      onValueChange?:
        ((value: string, eventDetails: FilterDropdownRootChangeEventDetails) => void) | undefined;
    },
    { slots },
  ) => {
    const listRef = shallowRef<HTMLElement[]>([]);
    return () => (
      <FilterDropdown.Root
        open={props.open}
        value={props.value}
        triggerId={props.triggerId}
        onValueChange={props.onValueChange}
        listRef={listRef}
        getActiveIndex={getNoActiveIndex}
        setActiveIndex={NOOP}
        v-slots={slots}
      />
    );
  },
  { props: ['open', 'value', 'triggerId', 'onValueChange'] },
);

function getNoActiveIndex() {
  return null;
}
