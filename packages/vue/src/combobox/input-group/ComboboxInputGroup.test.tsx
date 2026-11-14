import { describe, expect, it, vi } from 'vitest';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import { createRenderer, describeConformance, fireEvent, screen } from '#test-utils';
import ComboboxPartsReplacement from '../../../test/fixtures/ComboboxPartsReplacement.vue';
import type { ComboboxStore } from '../store';

describe('<Combobox.InputGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.InputGroup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root items={['a']}>{node}</Combobox.Root>);
    },
  }));

  it('should not dismiss the popup when clicking inside the input group', async () => {
    const { user } = await render(
      <Combobox.Root items={['a', 'b']}>
        <Combobox.InputGroup style={{ padding: '10px' }}>
          <span data-testid="pad">padding</span>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('listbox')).not.toBe(null);

    await user.click(screen.getByTestId('pad'));
    expect(screen.queryByRole('listbox')).not.toBe(null);
  });

  it('focuses the input and opens when clicking input-group padding around chips', async () => {
    await render(
      <Combobox.Root items={['a', 'b']} multiple defaultValue={['a']}>
        <Combobox.InputGroup data-testid="group" style={{ padding: '10px' }}>
          <Combobox.Chips>
            <Combobox.Chip>a</Combobox.Chip>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const group = screen.getByTestId('group');
    const input = screen.getByTestId('input');

    await fireEvent.mouseDown(group);

    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBe(null);
  });

  it('does not handle chip presses a second time when chips are nested inside the input group', async () => {
    const onOpenChange = vi.fn();

    await render(
      <Combobox.Root items={['a', 'b']} multiple defaultValue={['a']} onOpenChange={onOpenChange}>
        <Combobox.InputGroup>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">a</Combobox.Chip>
            <Combobox.Input />
          </Combobox.Chips>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await fireEvent.mouseDown(screen.getByTestId('chip'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('focuses the input without opening when openOnInputClick is false', async () => {
    await render(
      <Combobox.Root items={['a', 'b']} multiple openOnInputClick={false} defaultValue={['a']}>
        <Combobox.InputGroup data-testid="group" style={{ padding: '10px' }}>
          <Combobox.Chips>
            <Combobox.Chip>a</Combobox.Chip>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await fireEvent.mouseDown(screen.getByTestId('group'));

    expect(screen.getByTestId('input')).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('does not focus or open when disabled by Field.Root', async () => {
    await render(
      <Field.Root disabled>
        <Combobox.Root items={['a', 'b']} multiple defaultValue={['a']}>
          <Combobox.InputGroup data-testid="group" style={{ padding: '10px' }}>
            <Combobox.Chips>
              <Combobox.Chip>a</Combobox.Chip>
              <Combobox.Input data-testid="input" />
            </Combobox.Chips>
          </Combobox.InputGroup>

          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>,
    );

    await fireEvent.mouseDown(screen.getByTestId('group'));

    expect(screen.getByTestId('input')).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('focuses the input and opens when readOnly', async () => {
    await render(
      <Combobox.Root items={['a', 'b']} multiple readOnly defaultValue={['a']}>
        <Combobox.InputGroup data-testid="group" style={{ padding: '10px' }}>
          <Combobox.Chips>
            <Combobox.Chip>a</Combobox.Chip>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await fireEvent.mouseDown(screen.getByTestId('group'));

    expect(screen.getByTestId('input')).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBe(null);
  });

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
