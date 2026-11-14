import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { createRenderer } from '#test-utils';
import { FOCUSABLE_ATTRIBUTE } from '../src/utils/popups/constants';
import { useTestInteractions } from './useTestInteractions';
import type { TestElementProps, UseTestInteractionsReturn } from './useTestInteractions';

describe('useTestInteractions', () => {
  const { render } = createRenderer();

  async function renderInteractions(propsList?: Parameters<typeof useTestInteractions>[0]) {
    let interactions!: UseTestInteractionsReturn;
    const App = defineComponent({
      setup() {
        interactions = useTestInteractions(propsList);
        return () => null;
      },
    });

    await render(<App />);

    return interactions;
  }

  it('correctly merges functions', async () => {
    const firstInteractionOnClick = vi.fn();
    const secondInteractionOnClick = vi.fn();
    const secondInteractionOnKeydown = vi.fn();
    const userOnClick = vi.fn();

    const { getReferenceProps } = await renderInteractions([
      { reference: { onClick: firstInteractionOnClick } },
      {
        reference: {
          onClick: secondInteractionOnClick,
          onKeydown: secondInteractionOnKeydown,
        },
      },
    ]);

    const { onClick, onKeydown } = getReferenceProps({ onClick: userOnClick });

    // @ts-expect-error The prop getter returns unknown values; these supplied handlers are callable.
    onClick();
    // @ts-expect-error The prop getter returns unknown values; these supplied handlers are callable.
    onKeydown();

    expect(firstInteractionOnClick).toHaveBeenCalledTimes(1);
    expect(secondInteractionOnClick).toHaveBeenCalledTimes(1);
    expect(userOnClick).toHaveBeenCalledTimes(1);
    expect(secondInteractionOnKeydown).toHaveBeenCalledTimes(1);
  });

  it('does not error with undefined user supplied functions', async () => {
    const { getReferenceProps } = await renderInteractions([{ reference: { onClick() {} } }]);

    expect(() =>
      // @ts-expect-error The prop getter returns unknown values; the interaction supplies a callable onClick.
      getReferenceProps({ onClick: undefined }).onClick(),
    ).not.toThrow();
  });

  it('does not break props that start with `on`', async () => {
    const { getReferenceProps } = await renderInteractions([]);

    const props = getReferenceProps({
      // @ts-expect-error onlyShowVotes is a custom prop outside Vue HTMLAttributes.
      onlyShowVotes: true,
      onyx: () => {},
    });

    expect(props.onlyShowVotes).toBe(true);
    expect(typeof props.onyx).toBe('function');
  });

  it('does not break props that return values', async () => {
    const { getReferenceProps } = await renderInteractions([]);

    const props = getReferenceProps({
      // @ts-expect-error onyx is a custom callback outside Vue HTMLAttributes.
      onyx: () => 'returned value',
    });

    // @ts-expect-error The prop getter returns unknown values; the supplied onyx callback is callable.
    expect(props.onyx()).toBe('returned value');
  });

  it('adds focusable props to floating elements', async () => {
    const { getFloatingProps } = await renderInteractions([]);

    const props = getFloatingProps();

    expect(props.tabindex).toBe(-1);
    expect(props[FOCUSABLE_ATTRIBUTE]).toBe('');
  });

  it('strips active and selected from item props passed to item callbacks', async () => {
    const item = vi.fn((props: { active?: boolean; selected?: boolean }) => ({
      role: 'option' as const,
      tabindex: props.active ? 0 : -1,
      'aria-selected': props.selected,
    }));

    const { getItemProps } = await renderInteractions([{ item }]);

    const props = getItemProps({ active: true, selected: true });

    expect(item).toHaveBeenCalledWith({ active: true, selected: true });
    expect(props.active).toBeUndefined();
    expect(props.selected).toBeUndefined();
    expect(props.role).toBe('option');
    expect(props.tabindex).toBe(0);
    expect(props['aria-selected']).toBe(true);
  });

  it.each([
    { name: 'a ref', toEntry: (entry: ShallowRef<TestElementProps>) => entry },
    { name: 'a getter', toEntry: (entry: ShallowRef<TestElementProps>) => () => entry.value },
  ])('reads the current props of $name', async ({ toEntry }) => {
    const oldOnClick = vi.fn();
    const newOnClick = vi.fn();
    const entry = shallowRef<TestElementProps>({ reference: { onClick: oldOnClick } });
    const { getReferenceProps } = await renderInteractions([toEntry(entry)]);

    // @ts-expect-error The prop getter returns unknown values; the interaction supplies a callable onClick.
    getReferenceProps().onClick();
    entry.value = { reference: { onClick: newOnClick } };
    // @ts-expect-error The prop getter returns unknown values; the interaction supplies a callable onClick.
    getReferenceProps().onClick();

    expect(oldOnClick).toHaveBeenCalledTimes(1);
    expect(newOnClick).toHaveBeenCalledTimes(1);
  });
});
