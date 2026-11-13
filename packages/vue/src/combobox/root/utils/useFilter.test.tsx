import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed, defineComponent, nextTick, shallowRef } from 'vue';
import { createRenderer, hydrate, renderOnServer, screen, within } from '#test-utils';
import { getFilter } from '../../../internals/filter';
import UseFilterProbe from './UseFilterProbe.test.vue';
import { useComboboxFilter } from './useFilter';
import type { Filter } from './useFilter';

// Counts the collators that the test makes. A call with no locale uses `runtimeLocale`.
function spyOnCollator(runtimeLocale?: string) {
  const Collator = Intl.Collator;
  const collatorSpy = vi
    .spyOn(Intl, 'Collator')
    .mockImplementation(function CountedCollator(requestedLocale, options) {
      return new Collator(requestedLocale ?? runtimeLocale, options);
    });
  onTestFinished(() => collatorSpy.mockRestore());
  return collatorSpy;
}

describe('useComboboxFilter', () => {
  const { render } = createRenderer();

  it('uses default options when called without arguments', async () => {
    const TestFilter = defineComponent(() => {
      const filter = useComboboxFilter();
      return () => <span>{String(filter.contains('Apple', 'app'))}</span>;
    });

    await render(<TestFilter />);

    expect(screen.getByText('true')).not.toBe(null);
  });

  it('matches the start and end of an item label', async () => {
    const TestFilter = defineComponent(() => {
      const filter = useComboboxFilter({ locale: 'en' });
      return () => (
        <div>
          <span data-testid="starts-match">{String(filter.startsWith('Éclair', 'ec'))}</span>
          <span data-testid="starts-inner">{String(filter.startsWith('Éclair', 'clair'))}</span>
          <span data-testid="starts-empty">{String(filter.startsWith('Éclair', ''))}</span>
          <span data-testid="starts-longer">{String(filter.startsWith('Tea', 'teapot'))}</span>
          <span data-testid="ends-match">{String(filter.endsWith('Crème brûlée', 'BRULEE'))}</span>
          <span data-testid="ends-inner">{String(filter.endsWith('Crème brûlée', 'crème'))}</span>
          <span data-testid="ends-empty">{String(filter.endsWith('Crème brûlée', ''))}</span>
          <span data-testid="ends-longer">{String(filter.endsWith('Tea', 'iced tea'))}</span>
          <span data-testid="object-item">
            {String(filter.startsWith({ label: 'Banana' }, 'ban', (item) => item.label))}
          </span>
        </div>
      );
    });

    await render(<TestFilter />);

    expect(screen.getByTestId('starts-match')).toHaveTextContent('true');
    expect(screen.getByTestId('starts-inner')).toHaveTextContent('false');
    expect(screen.getByTestId('starts-empty')).toHaveTextContent('true');
    expect(screen.getByTestId('starts-longer')).toHaveTextContent('false');
    expect(screen.getByTestId('ends-match')).toHaveTextContent('true');
    expect(screen.getByTestId('ends-inner')).toHaveTextContent('false');
    expect(screen.getByTestId('ends-empty')).toHaveTextContent('true');
    expect(screen.getByTestId('ends-longer')).toHaveTextContent('false');
    expect(screen.getByTestId('object-item')).toHaveTextContent('true');
  });

  it('filters selected and unselected items in single and multiple modes', async () => {
    const TestFilter = defineComponent({
      props: { multiple: { type: Boolean, default: false } },
      setup(props) {
        const filter = useComboboxFilter(() => ({
          locale: 'en',
          multiple: props.multiple,
          value: 'Apple',
        }));
        return () => (
          <div>
            <span data-testid="selected-match">{String(filter.contains('Banana', 'apple'))}</span>
            <span data-testid="item-match">{String(filter.contains('Banana', 'nan'))}</span>
          </div>
        );
      },
    });

    const { setProps } = await render(<TestFilter multiple={false} />);

    expect(screen.getByTestId('selected-match')).toHaveTextContent('true');
    expect(screen.getByTestId('item-match')).toHaveTextContent('true');

    await setProps({ multiple: true });

    expect(screen.getByTestId('selected-match')).toHaveTextContent('false');
    expect(screen.getByTestId('item-match')).toHaveTextContent('true');
  });
});

describe('useComboboxFilter options', () => {
  const { render } = createRenderer();

  it('a computed of the consumer follows a change of the options', async () => {
    const value = shallowRef('Apple');

    const TestFilter = defineComponent(() => {
      const filter = useComboboxFilter(() => ({ locale: 'en', value: value.value }));
      const matches = computed(() =>
        ['Apple', 'Banana'].filter((item) => filter.contains(item, 'apple')),
      );
      return () => <span data-testid="matches">{matches.value.join()}</span>;
    });

    await render(<TestFilter />);

    expect(screen.getByTestId('matches').textContent).toBe('Apple,Banana');

    value.value = 'Cherry';
    await nextTick();

    expect(screen.getByTestId('matches').textContent).toBe('Apple');
  });

  it('a computed of the consumer follows a change of the locale', async () => {
    const locale = shallowRef('en');

    const TestFilter = defineComponent(() => {
      const filter = useComboboxFilter(() => ({ locale: locale.value }));
      const matches = computed(() =>
        ['Malmö', 'Malta'].filter((city) => filter.contains(city, 'malmo')),
      );
      return () => <span data-testid="matches">{matches.value.join()}</span>;
    });

    await render(<TestFilter />);

    expect(screen.getByTestId('matches').textContent).toBe('Malmö');

    locale.value = 'sv';
    await nextTick();

    expect(screen.getByTestId('matches').textContent).toBe('');
  });

  it('makes no new collator when the collator options stay the same', async () => {
    const collatorSpy = spyOnCollator();
    const multiple = shallowRef(false);
    const value = shallowRef('Apple');
    let filter!: Filter;

    const TestFilter = defineComponent(() => {
      filter = useComboboxFilter(() => ({
        locale: 'en',
        caseFirst: 'upper',
        multiple: multiple.value,
        value: value.value,
      }));
      return () => null;
    });

    await render(<TestFilter />);
    for (let call = 0; call < 50; call += 1) {
      filter.contains('Apple', 'app');
    }
    multiple.value = true;
    value.value = 'Cherry';
    for (let call = 0; call < 50; call += 1) {
      filter.contains('Apple', 'app');
    }

    expect(collatorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('VUE-44: filters with en-US until the component is mounted when it has no locale', () => {
  const probeFile = 'src/combobox/root/utils/UseFilterProbe.test.vue';

  it('hydrates the list that the server filtered, then follows the runtime locale', async () => {
    spyOnCollator('sv');
    expect(getFilter({ locale: 'en-US', numeric: true }).contains('Malmö', 'malmo')).toBe(true);
    expect(getFilter({ numeric: true }).contains('Malmö', 'malmo')).toBe(false);
    const serverHtml = await renderOnServer(probeFile);
    expect(serverHtml).toContain('<li>Malmö</li>');

    const { container } = await hydrate(UseFilterProbe, { serverHtml });

    expect(within(container).queryByText('Malmö')).toBe(null);
  });

  it('hydrates the list that the server filtered with the locale of the options', async () => {
    spyOnCollator('en-US');
    const props = { locale: 'sv' };
    const serverHtml = await renderOnServer(probeFile, props);
    expect(serverHtml).not.toContain('Malmö');

    const { container } = await hydrate(UseFilterProbe, { serverHtml, props });

    expect(within(container).queryByText('Malmö')).toBe(null);
  });
});
