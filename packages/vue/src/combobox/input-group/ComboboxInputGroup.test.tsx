import { describe, expect, it, vi } from 'vitest';
import { createRenderer, describeConformance, fireEvent, screen } from '#test-utils';
import ComboboxPartsReplacement from '../../../test/fixtures/ComboboxPartsReplacement.vue';
import * as Combobox from '../index.parts';
import type { ComboboxStore } from '../store';

describe('<Combobox.InputGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.InputGroup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root items={['a']}>{node}</Combobox.Root>);
    },
  }));

  it('has role prop', async () => {
    await render(
      <Combobox.Root items={['a']}>
        <Combobox.InputGroup />
      </Combobox.Root>,
    );

    expect(screen.queryByRole('group')).not.toBe(null);
  });

  it('keeps the element of a group that mounts before the old group unmounts', async () => {
    let store!: ComboboxStore;
    const { setProps } = await render(
      <ComboboxPartsReplacement first onStore={(value: ComboboxStore) => (store = value)} />,
    );
    expect(store.select('inputGroupElement')).toBe(screen.getByTestId('first-group'));

    await setProps({ first: false });

    expect(screen.queryByTestId('first-group')).toBe(null);
    expect(store.select('inputGroupElement')).toBe(screen.getByTestId('second-group'));
  });

  it('a press on the group focuses the input and opens', async () => {
    const handleOpenChange = vi.fn();
    await render(
      <Combobox.Root items={['a']} onOpenChange={handleOpenChange}>
        <Combobox.InputGroup data-testid="group">
          <Combobox.Input />
        </Combobox.InputGroup>
      </Combobox.Root>,
    );

    await fireEvent.mouseDown(screen.getByTestId('group'));

    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    expect(handleOpenChange.mock.lastCall?.[1].reason).toBe('input-press');
    expect(screen.getByTestId('group')).toHaveAttribute('data-popup-open');
  });
});
