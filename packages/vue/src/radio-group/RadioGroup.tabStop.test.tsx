import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';

function readTabindexes() {
  return ['a', 'b', 'c'].map((testId) => screen.getByTestId(testId).getAttribute('tabindex'));
}

function renderRadios(disabled?: string) {
  return (
    <>
      <Radio.Root value="a" data-testid="a" disabled={disabled === 'a'} />
      <Radio.Root value="b" data-testid="b" />
      <Radio.Root value="c" data-testid="c" />
    </>
  );
}

// The user checks the radio and then leaves the group.
async function checkThenBlur(testId: string) {
  const radio = screen.getByTestId(testId);
  radio.focus();
  await fireEvent.click(radio);
  radio.blur();
  await flushMicrotasks();
}

function createControlledGroup(initialValue: string, disabled?: string) {
  const value = shallowRef<string | null>(initialValue);
  const Group = defineComponent(() => () => (
    <RadioGroup
      value={value.value}
      onValueChange={(next: string | null) => {
        value.value = next;
      }}
    >
      {renderRadios(disabled)}
    </RadioGroup>
  ));

  return { Group, value };
}

describe('VUE-54: the tab stop of <RadioGroup /> follows the checked radio', () => {
  const { render } = createRenderer();

  it('moves the tab stop to the default radio after a native reset', async () => {
    await render(
      <form data-testid="form">
        <RadioGroup name="fruit" defaultValue="a">
          {renderRadios()}
        </RadioGroup>
      </form>,
    );
    await checkThenBlur('c');
    expect(readTabindexes()).toEqual(['-1', '-1', '0']);

    screen.getByTestId<HTMLFormElement>('form').reset();
    await waitFor(() => {
      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
    });
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['0', '-1', '-1']);
  });

  it('moves the tab stop to the first enabled radio when a native reset checks a disabled radio', async () => {
    await render(
      <form data-testid="form">
        <RadioGroup name="fruit" defaultValue="a">
          {renderRadios('a')}
        </RadioGroup>
      </form>,
    );
    await checkThenBlur('c');
    expect(readTabindexes()).toEqual(['-1', '-1', '0']);

    screen.getByTestId<HTMLFormElement>('form').reset();
    await waitFor(() => {
      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
    });
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '0', '-1']);
  });

  // A browser can check a radio with no focus on it: Safari gives no focus to a native button
  // that the user clicks.
  it('moves the tab stop to a radio that a click checks with no focus', async () => {
    await render(<RadioGroup defaultValue="a">{renderRadios()}</RadioGroup>);
    expect(readTabindexes()).toEqual(['0', '-1', '-1']);

    await fireEvent.click(screen.getByTestId('c'));
    await flushMicrotasks();

    expect(screen.getByTestId('c')).toHaveAttribute('aria-checked', 'true');
    expect(readTabindexes()).toEqual(['-1', '-1', '0']);
  });

  it('moves the tab stop when the parent changes a controlled value', async () => {
    const { Group, value } = createControlledGroup('a');
    await render(<Group />);
    await checkThenBlur('c');
    expect(readTabindexes()).toEqual(['-1', '-1', '0']);

    value.value = 'b';
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '0', '-1']);
  });

  it('moves the tab stop to the first enabled radio when the parent clears the value', async () => {
    const { Group, value } = createControlledGroup('c', 'a');
    await render(<Group />);
    expect(readTabindexes()).toEqual(['-1', '-1', '0']);

    value.value = null;
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '0', '-1']);
  });

  it.each([
    { name: 'a span', buttonProps: {} },
    { name: 'a native button', buttonProps: { as: 'button', nativeButton: true } },
  ])(
    'moves the tab stop to a checked radio that becomes enabled, $name',
    async ({ buttonProps }) => {
      const disabled = shallowRef(true);
      const Group = defineComponent(() => () => (
        <RadioGroup value="c">
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
          <Radio.Root value="c" data-testid="c" disabled={disabled.value} {...buttonProps} />
        </RadioGroup>
      ));
      await render(<Group />);
      await checkThenBlur('a');
      expect(readTabindexes()).toEqual(['0', '-1', '-1']);

      disabled.value = false;
      await flushMicrotasks();

      expect(readTabindexes()).toEqual(['-1', '-1', '0']);
    },
  );

  // The user checks c, and the parent checks a while c has the focus.
  async function renderValueChangeInGroup() {
    const { Group, value } = createControlledGroup('a');
    await render(<Group />);
    const c = screen.getByTestId('c');
    c.focus();
    await fireEvent.click(c);

    value.value = 'a';
    await flushMicrotasks();

    expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
    return c;
  }

  it('keeps the tab stop on the focused radio when the value changes while the group has the focus', async () => {
    const c = await renderValueChangeInGroup();

    expect(c).toHaveFocus();
    expect(readTabindexes()).toEqual(['-1', '-1', '0']);
  });

  it('moves the tab stop to the checked radio when the focus leaves the group', async () => {
    const c = await renderValueChangeInGroup();

    c.blur();
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['0', '-1', '-1']);
  });
});
