import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import type { HTMLProps } from '@vase-ui/vue/types';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';

describe('useCheckboxGroupParent', () => {
  const { render } = createRenderer();
  const allValues = ['a', 'b', 'c'];

  it('should control child checkboxes', async () => {
    const parentCheckedChange = vi.fn();
    const childCheckedChange = vi.fn();
    const App = defineComponent(() => {
      const value = shallowRef<string[]>([]);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" onCheckedChange={parentCheckedChange} />
          <Checkbox.Root value="a" />
          <Checkbox.Root value="b" onCheckedChange={childCheckedChange} />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    });

    await render(<App />);

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);
    const parent = screen.getByTestId('parent');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    await fireEvent.click(parent);
    expect(parent).toHaveAttribute('aria-checked', 'true');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    expect(parentCheckedChange.mock.calls.length).toBe(1);
    expect(childCheckedChange.mock.calls.length).toBe(0);

    await fireEvent.click(parent);
    expect(parent).toHaveAttribute('aria-checked', 'false');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    expect(parentCheckedChange.mock.calls.length).toBe(2);
    expect(childCheckedChange.mock.calls.length).toBe(0);
  });

  it('parent should be marked as mixed if some children are checked', async () => {
    const childCheckedChange = vi.fn();
    const App = defineComponent(() => {
      const value = shallowRef<string[]>([]);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" onCheckedChange={childCheckedChange} />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    });

    await render(<App />);

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
    await fireEvent.click(checkboxes[0]);
    expect(childCheckedChange.mock.calls.length).toBe(1);

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('updates uncontrolled parent-enabled groups from child clicks without duplicate callbacks', async () => {
    const handleValueChange = vi.fn();

    await render(
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>,
    );

    const parent = screen.getByTestId('parent');
    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const checkboxC = screen.getByTestId('checkboxC');

    await fireEvent.click(checkboxA);

    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);
    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');

    await fireEvent.click(parent);

    expect(handleValueChange.mock.calls.length).toBe(2);
    expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b', 'c']);
    expect(parent).toHaveAttribute('aria-checked', 'true');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'true');
    expect(checkboxC).toHaveAttribute('aria-checked', 'true');

    await fireEvent.click(parent);

    expect(handleValueChange.mock.calls.length).toBe(3);
    expect(handleValueChange.mock.calls[2][0]).toEqual([]);
    expect(parent).toHaveAttribute('aria-checked', 'false');
    expect(checkboxA).toHaveAttribute('aria-checked', 'false');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');
    expect(checkboxC).toHaveAttribute('aria-checked', 'false');
  });

  it('should correctly initialize the values array', async () => {
    const App = defineComponent(() => {
      const value = shallowRef<string[]>(['a']);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    });

    await render(<App />);

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');

    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'true');
  });

  it('should update the values array when a child checkbox is clicked', async () => {
    const App = defineComponent(() => {
      const value = shallowRef<string[]>(['a']);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    });

    await render(<App />);

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);

    const checkboxA = screen.getByTestId('checkboxA');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');

    for (const checkbox of checkboxes) {
      if (checkbox !== checkboxA) {
        await fireEvent.click(checkbox);
      }
    }

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'true');
  });

  it('should apply space-separated aria-controls attribute with child names', async () => {
    const App = defineComponent(() => {
      const value = shallowRef<string[]>([]);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" />
          {allValues.map((v) => (
            <Checkbox.Root key={v} value={v} data-testid={v} />
          ))}
        </CheckboxGroup>
      );
    });

    await render(<App />);

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      allValues.map((v) => screen.getByTestId(v).id).join(' '),
    );
  });

  it('keeps a custom child id in aria-controls', async () => {
    await render(
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" nativeButton as="button" />
        <Checkbox.Root id="custom" value="a" data-testid="a" nativeButton as="button" />
      </CheckboxGroup>,
    );

    expect(screen.getByTestId('a')).toHaveAttribute('id', 'custom');
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'custom');
  });

  it.each([false, true])(
    'keeps a rendered child id in aria-controls (nativeButton=%s)',
    async (nativeButton) => {
      await render(
        <CheckboxGroup allValues={['a']}>
          <Checkbox.Root
            parent
            data-testid="parent"
            nativeButton={nativeButton}
            as={nativeButton ? 'button' : undefined}
          />
          <Checkbox.Root
            value="a"
            nativeButton={nativeButton}
            v-slots={{
              render: ({ props }: { props: HTMLProps }) =>
                nativeButton ? (
                  <button {...props} id="rendered" />
                ) : (
                  <span {...props} id="rendered" />
                ),
            }}
          />
        </CheckboxGroup>,
      );

      expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'rendered');
    },
  );

  it('references the exposed child rather than its custom-id input without nativeButton', async () => {
    await render(
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="custom" value="a" data-testid="a" />
      </CheckboxGroup>,
    );

    // The custom `id` lands on the hidden input, so `aria-controls` has to name the exposed
    // element instead.
    expect(document.querySelector('input[type="checkbox"][id="custom"]')).not.toBe(null);
    expect(screen.getByTestId('a').id).not.toBe('custom');
    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('does not read aria-controls ids off Object.prototype', async () => {
    await render(
      <CheckboxGroup allValues={['a', 'constructor']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
      </CheckboxGroup>,
    );

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('drops an unmounted child from aria-controls', async () => {
    const App = defineComponent(
      (props: { showB: boolean }) => () => (
        <CheckboxGroup allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="a" />
          {props.showB && <Checkbox.Root value="b" data-testid="b" />}
        </CheckboxGroup>
      ),
      { props: ['showB'] },
    );

    const { rerender } = await render(<App showB />);
    await rerender(<App showB={false} />);

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('keeps both ids for checkboxes sharing a value and retains the survivor', async () => {
    const App = defineComponent(
      (props: { showSecondB: boolean }) => () => (
        <CheckboxGroup allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="a" />
          <Checkbox.Root value="b" data-testid="b" />
          {props.showSecondB && <Checkbox.Root value="b" data-testid="second-b" />}
        </CheckboxGroup>
      ),
      { props: ['showSecondB'] },
    );

    const { rerender } = await render(<App showSecondB />);

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      `${screen.getByTestId('a').id} ${screen.getByTestId('b').id} ${screen.getByTestId('second-b').id}`,
    );

    await rerender(<App showSecondB={false} />);

    expect(screen.getByTestId('parent')).toHaveAttribute(
      'aria-controls',
      `${screen.getByTestId('a').id} ${screen.getByTestId('b').id}`,
    );
  });

  it('does not select a child without an identifying value', async () => {
    await render(
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="standalone" data-testid="no-value" />
        <Checkbox.Root value="a" data-testid="checkbox-a" />
      </CheckboxGroup>,
    );

    const parent = screen.getByTestId('parent');
    const noValue = screen.getByTestId('no-value');
    const checkboxA = screen.getByTestId('checkbox-a');

    await fireEvent.click(parent);

    expect(parent).toHaveAttribute('aria-checked', 'true');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(noValue).toHaveAttribute('aria-checked', 'false');
    expect(noValue.nextElementSibling).toHaveAttribute('id', 'standalone');
  });

  it('preserves initial state if mixed when parent is clicked', async () => {
    const App = defineComponent(() => {
      const value = shallowRef<string[]>([]);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    });

    await render(<App />);

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);
    const checkboxA = screen.getByTestId('checkboxA');
    const parent = screen.getByTestId('parent');

    await fireEvent.click(checkboxA);

    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');

    await fireEvent.click(parent);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    await fireEvent.click(parent);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    await fireEvent.click(parent);

    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('aria-checked', checkbox === checkboxA ? 'true' : 'false');
    });
  });

  it('lets a parent checkbox cancel a parent-enabled group change', async () => {
    const handleValueChange = vi.fn();
    const handleParentChange = vi.fn((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    await render(
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" onCheckedChange={handleParentChange} />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>,
    );

    await fireEvent.click(screen.getByTestId('parent'));

    expect(handleParentChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(0);
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxB')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxC')).toHaveAttribute('aria-checked', 'false');
  });

  it('lets a child checkbox cancel a parent-enabled group change', async () => {
    const handleValueChange = vi.fn();
    const handleChildChange = vi.fn((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    await render(
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" onCheckedChange={handleChildChange} />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>,
    );

    await fireEvent.click(screen.getByTestId('checkboxA'));

    expect(handleChildChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(0);
    expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not advance the parent toggle cycle when the group cancels a parent change', async () => {
    const handleValueChange = vi.fn((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    await render(
      <CheckboxGroup value={['a']} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>,
    );

    const parent = screen.getByTestId('parent');

    // From a mixed state the parent attempts to check all. The group cancels, so
    // the internal status must not advance to 'on'.
    await fireEvent.click(parent);
    // A second click must retry the same 'mixed -> on' transition instead of
    // skipping ahead to 'on -> off' and proposing an empty value.
    await fireEvent.click(parent);

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange.mock.calls[0][0]).toEqual(allValues);
    expect(handleValueChange.mock.calls[1][0]).toEqual(allValues);
  });

  it('does not pollute the parent snapshot when the group cancels a child change', async () => {
    const handleValueChange = vi.fn((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    await render(
      <CheckboxGroup value={allValues} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>,
    );

    // Unchecking a child is canceled, so the parent's snapshot of checked
    // children must stay intact.
    await fireEvent.click(screen.getByTestId('checkboxA'));
    // The parent still sees an all-checked group and toggles to none. A polluted
    // snapshot would make it propose checking everything again.
    await fireEvent.click(screen.getByTestId('parent'));

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange.mock.calls[0][0]).toEqual(['b', 'c']);
    expect(handleValueChange.mock.calls[1][0]).toEqual([]);
  });

  it('handles unchecked disabled checkboxes', async () => {
    const App = defineComponent(() => {
      const value = shallowRef<string[]>([]);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" disabled data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    });

    await render(<App />);

    const parent = screen.getByTestId('parent');
    await fireEvent.click(parent);

    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByTestId('checkboxA')).toHaveAttribute('aria-checked', 'false');
  });

  it('handles checked disabled checkboxes', async () => {
    const App = defineComponent(() => {
      const value = shallowRef<string[]>(['a']);
      return () => (
        <CheckboxGroup
          value={value.value}
          onValueChange={(nextValue: string[]) => {
            value.value = nextValue;
          }}
          allValues={allValues}
        >
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" disabled />
          <Checkbox.Root value="b" data-testid="checkboxB" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    });

    await render(<App />);

    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const parent = screen.getByTestId('parent');

    await fireEvent.click(parent);
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'true');

    await fireEvent.click(parent);
    expect(checkboxA).toHaveAttribute('aria-checked', 'true');
    expect(checkboxB).toHaveAttribute('aria-checked', 'false');
  });

  describe('aria-controls', () => {
    it('follows a change of the id of the element', async () => {
      const id = shallowRef('first');

      await render(() => (
        <CheckboxGroup allValues={['a']}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root
            value="a"
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => <span {...props} id={id.value} />,
            }}
          />
        </CheckboxGroup>
      ));

      expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'first');

      id.value = 'second';
      await flushMicrotasks();

      expect(screen.getByTestId('parent')).toHaveAttribute('aria-controls', 'second');
    });

    it('drops a child that KeepAlive holds, and lists it again when KeepAlive shows it', async () => {
      const shown = shallowRef(true);
      const Blank = defineComponent(() => () => <span />);
      const Held = defineComponent(() => () => <Checkbox.Root value="b" data-testid="b" />);
      const App = defineComponent(() => () => (
        <CheckboxGroup allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="a" />
          <KeepAlive>{shown.value ? <Held key="held" /> : <Blank key="blank" />}</KeepAlive>
        </CheckboxGroup>
      ));

      await render(<App />);

      const parent = screen.getByTestId('parent');
      const aId = screen.getByTestId('a').id;
      const bId = screen.getByTestId('b').id;
      expect(parent).toHaveAttribute('aria-controls', `${aId} ${bId}`);

      shown.value = false;
      await flushMicrotasks();
      expect(parent).toHaveAttribute('aria-controls', aId);

      shown.value = true;
      await flushMicrotasks();
      expect(parent).toHaveAttribute('aria-controls', `${aId} ${bId}`);
    });
  });

  describe('BUG-6206: a native reset of a group with a parent', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function reset() {
      await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
    }

    it.each([
      { name: 'the value is already the default', defaultValue: [] as string[] },
      { name: 'the reset changes the value', defaultValue: ['a'] },
    ])(
      'gives the parent the state that it has at the mount when $name',
      async ({ defaultValue }) => {
        const handleValueChange = vi.fn();
        await render(
          <form>
            <CheckboxGroup
              allValues={allValues}
              defaultValue={defaultValue}
              onValueChange={handleValueChange}
            >
              <Checkbox.Root parent aria-label="All" />
              <Checkbox.Root value="a" aria-label="A" />
              <Checkbox.Root value="b" aria-label="B" />
              <Checkbox.Root value="c" aria-label="C" />
            </CheckboxGroup>
            <button type="reset">Reset</button>
          </form>,
        );
        const [all, , b] = screen.getAllByRole('checkbox');

        // The children make a value, and then the parent cycles to all and to none.
        await fireEvent.click(b);
        await fireEvent.click(all);
        await fireEvent.click(all);
        expect(all).toHaveAttribute('aria-checked', 'false');

        await reset();
        await fireEvent.click(all);

        expect(handleValueChange.mock.lastCall?.[0]).toEqual(allValues);
        expect(all).toHaveAttribute('aria-checked', 'true');
      },
    );

    it('puts the group back to its default value, and the parent does not change it again', async () => {
      const handleValueChange = vi.fn();
      await render(
        <form>
          <CheckboxGroup
            allValues={['a', 'b']}
            defaultValue={['a', 'b']}
            onValueChange={handleValueChange}
          >
            <Checkbox.Root parent aria-label="All" />
            <Checkbox.Root value="a" aria-label="A" />
            <Checkbox.Root value="b" aria-label="B" />
          </CheckboxGroup>
          <button type="reset">Reset</button>
        </form>,
      );
      const [all, a, b] = screen.getAllByRole('checkbox');
      await fireEvent.click(a);
      expect(all).toHaveAttribute('aria-checked', 'mixed');

      await reset();

      expect(all).toHaveAttribute('aria-checked', 'true');
      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(b).toHaveAttribute('aria-checked', 'true');
      expect(handleValueChange.mock.calls.map(([value]) => value)).toEqual([['b'], ['a', 'b']]);
    });

    it('keeps the parent as it was when the listener cancels the reset', async () => {
      const handleValueChange = vi.fn(
        (_value: string[], details: CheckboxGroup.ChangeEventDetails) => {
          if (details.event.type === 'reset') {
            details.cancel();
          }
        },
      );
      await render(
        <form>
          <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
            <Checkbox.Root parent aria-label="All" />
            <Checkbox.Root value="a" aria-label="A" />
            <Checkbox.Root value="b" aria-label="B" />
            <Checkbox.Root value="c" aria-label="C" />
          </CheckboxGroup>
          <button type="reset">Reset</button>
        </form>,
      );
      const [all, a, b] = screen.getAllByRole('checkbox');

      // The children make `['a', 'b']`, and the parent selects all.
      await fireEvent.click(a);
      await fireEvent.click(b);
      await fireEvent.click(all);

      await reset();
      expect(all).toHaveAttribute('aria-checked', 'true');

      // The parent still has `['a', 'b']`. It gives that value back after one cycle.
      await fireEvent.click(all);
      await fireEvent.click(all);

      expect(handleValueChange.mock.lastCall?.[0]).toEqual(['a', 'b']);
    });
  });

  describe('disabled children', () => {
    it('leaves out a child that becomes disabled after the mount', async () => {
      const disabled = shallowRef(false);
      const App = defineComponent(() => () => (
        <CheckboxGroup allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" disabled={disabled.value} data-testid="a" />
          <Checkbox.Root value="b" data-testid="b" />
          <Checkbox.Root value="c" data-testid="c" />
        </CheckboxGroup>
      ));

      await render(<App />);

      disabled.value = true;
      await flushMicrotasks();
      await fireEvent.click(screen.getByTestId('parent'));

      expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('b')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('c')).toHaveAttribute('aria-checked', 'true');
    });

    it('stops keeping the value of a disabled child that unmounts', async () => {
      const shown = shallowRef(true);
      const App = defineComponent(() => () => (
        <CheckboxGroup allValues={['a', 'b']} defaultValue={['a']}>
          <Checkbox.Root parent data-testid="parent" />
          {shown.value && <Checkbox.Root value="a" disabled />}
          <Checkbox.Root value="b" />
        </CheckboxGroup>
      ));

      await render(<App />);

      shown.value = false;
      await flushMicrotasks();

      const parent = screen.getByTestId('parent');
      await fireEvent.click(parent);
      expect(parent).toHaveAttribute('aria-checked', 'true');

      // The disabled child kept its value while it showed. After it unmounts, the parent clears it.
      await fireEvent.click(parent);
      expect(parent).toHaveAttribute('aria-checked', 'false');
    });

    it('stops keeping the value of a disabled child that KeepAlive holds', async () => {
      const shown = shallowRef(true);
      const Blank = defineComponent(() => () => <span />);
      const Held = defineComponent(() => () => <Checkbox.Root value="a" disabled />);
      const App = defineComponent(() => () => (
        <CheckboxGroup allValues={['a', 'b']} defaultValue={['a']}>
          <Checkbox.Root parent data-testid="parent" />
          <KeepAlive>{shown.value ? <Held key="held" /> : <Blank key="blank" />}</KeepAlive>
          <Checkbox.Root value="b" />
        </CheckboxGroup>
      ));

      await render(<App />);

      shown.value = false;
      await flushMicrotasks();

      const parent = screen.getByTestId('parent');
      await fireEvent.click(parent);
      expect(parent).toHaveAttribute('aria-checked', 'true');

      // The held child reports no disabled state. The parent thus clears its value, as for an
      // enabled child.
      await fireEvent.click(parent);
      expect(parent).toHaveAttribute('aria-checked', 'false');
    });
  });
});
