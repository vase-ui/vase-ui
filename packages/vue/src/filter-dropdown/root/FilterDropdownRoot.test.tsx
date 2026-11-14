import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
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
