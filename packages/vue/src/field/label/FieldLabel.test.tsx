import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Combobox } from '@vase-ui/vue/combobox';
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { NumberField } from '@vase-ui/vue/number-field';
import { OTPField } from '@vase-ui/vue/otp-field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Select } from '@vase-ui/vue/select';
import { Switch } from '@vase-ui/vue/switch';
import { TimeField } from '@vase-ui/vue/time-field';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Field.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Label />, () => ({
    refInstanceof: window.HTMLLabelElement,
    testRenderPropWith: 'label',
    render(node) {
      return render(<Field.Root>{node}</Field.Root>);
    },
  }));

  it('should set htmlFor referencing the control automatically', async () => {
    await render(
      <Field.Root data-testid="field">
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByRole('textbox').id);
  });

  it('when nativeLabel={false}, clicking focuses the associated control', async () => {
    const { user } = await render(
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label nativeLabel={false} as="div" data-testid="label">
          Label
        </Field.Label>
      </Field.Root>,
    );

    const label = screen.getByTestId('label');
    const control = screen.getByTestId('control');

    expect(label).not.toHaveAttribute('for');

    await user.click(label);
    expect(control).toHaveFocus();
  });

  describe('control selection', () => {
    const Fields = defineComponent(
      (props: { first?: boolean; second?: boolean }) => () => {
        const { first = true, second = true } = props;
        return (
          <Field.Root>
            {first && <Field.Control id="a" />}
            {second && <Field.Control id="b" />}
            <Field.Label data-testid="label">Label</Field.Label>
          </Field.Root>
        );
      },
      { props: ['first', 'second'] },
    );

    it('keeps the selected control id when another control unmounts', async () => {
      const { rerender } = await render(<Fields />);

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      await rerender(<Fields second={false} />);

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');
    });

    it('falls over to the remaining control when the selected one unmounts', async () => {
      const { rerender } = await render(<Fields />);

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      await rerender(<Fields first={false} />);

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
    });
  });

  it('reflects the disabled state from Field.Item', async () => {
    await render(
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Item>
      </Field.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('data-disabled');
  });

  describe('dev warnings', () => {
    it('does not warn by default', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <Field.Root>
          <Field.Control />
          <Field.Label>Label</Field.Label>
        </Field.Root>,
      );

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not warn when the render function returns no element', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <Field.Root>
          <Field.Label v-slots={{ render: () => null }}>Label</Field.Label>
        </Field.Root>,
      );

      expect(errorSpy).not.toHaveBeenCalled();
      // `useRenderElement` reports the slot that gives no element. The label has no element to check.
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('The `#render` slot gave no element to the part.'),
      ]);
    });

    it('errors if nativeLabel=true but ref is not a label', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <Field.Root>
          <Field.Control />
          <Field.Label nativeLabel as="div">
            Label
          </Field.Label>
        </Field.Root>,
      );

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'Vase UI: <Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' +
          'A non-<label> element has no native label association, so `for` has no effect. ' +
          'Use a real <label> with the `as` prop or the `#render` slot, or set `nativeLabel` to `false`.',
      );
    });

    it('errors if nativeLabel=false but ref is a label', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <Field.Root>
          <Field.Control />
          <Field.Label nativeLabel={false}>Label</Field.Label>
        </Field.Root>,
      );

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'Vase UI: <Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' +
          'A <label> element has native label behavior, but Vase UI treats the label as non-native. ' +
          'This can cause unexpected pointer behavior. ' +
          'Use a non-<label> element with the `as` prop or the `#render` slot, or set `nativeLabel` to `true`.',
      );
    });

    it('reports a replacement element that loses its native label association', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tag = shallowRef('label');
      await render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Label as={tag.value}>Name</Field.Label>
        </Field.Root>
      ));
      expect(error).not.toHaveBeenCalled();
      tag.value = 'span';
      await flushMicrotasks();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0]?.[0]).toContain('expected a <label> element');
    });

    it('reports a nativeLabel value that stops matching the element', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});
      const nativeLabel = shallowRef(true);

      await render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Label nativeLabel={nativeLabel.value}>Label</Field.Label>
        </Field.Root>
      ));
      expect(errorSpy).not.toHaveBeenCalled();

      nativeLabel.value = false;
      await flushMicrotasks();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        'expected a non-<label> element because the `nativeLabel` prop is false.',
      );
    });
  });

  describe('id', () => {
    it('VUE-23: uses the id prop and follows a change of it, and the control names the label with it', async () => {
      const id = shallowRef('first-label');

      await render(() => (
        <Field.Root>
          <Field.Label id={id.value} data-testid="label">
            Label
          </Field.Label>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      expect(screen.getByTestId('label')).toHaveAttribute('id', 'first-label');
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'first-label');

      id.value = 'second-label';
      await flushMicrotasks();

      expect(screen.getByTestId('label')).toHaveAttribute('id', 'second-label');
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'second-label');
    });

    it('VUE-23: gives each of two labels its own id, and the control names the last one', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="first">First</Field.Label>
          <Field.Label data-testid="second">Second</Field.Label>
          <Field.Control data-testid="control" />
        </Field.Root>,
      );

      const first = screen.getByTestId('first');
      const second = screen.getByTestId('second');

      expect(first.id).not.toBe('');
      expect(second.id).not.toBe('');
      expect(first.id).not.toBe(second.id);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', second.id);
    });
  });

  describe('VUE-118: the id that a #render slot gives an element', () => {
    function renderOwnInput({ props }: { props: HTMLProps }) {
      return <input {...props} id="own" />;
    }

    function renderOwnButton({ props }: { props: HTMLProps }) {
      return <button {...props} id="own" />;
    }

    function renderOwnSpan({ props }: { props: HTMLProps }) {
      return <span {...props} id="own" />;
    }

    const MONTH = { type: 'month', index: 0, editable: true } as const;
    const HOUR = { type: 'hour', index: 0, editable: true } as const;

    it.each([
      {
        name: 'Field.Control',
        renderControl: () => <Field.Control v-slots={{ render: renderOwnInput }} />,
      },
      {
        name: 'Field.Control with an id prop',
        renderControl: () => <Field.Control id="prop" v-slots={{ render: renderOwnInput }} />,
      },
      { name: 'Input', renderControl: () => <Input v-slots={{ render: renderOwnInput }} /> },
      {
        name: 'Select.Trigger',
        renderControl: () => (
          <Select.Root>
            <Select.Trigger v-slots={{ render: renderOwnButton }} />
          </Select.Root>
        ),
      },
      {
        name: 'Combobox.Trigger',
        renderControl: () => (
          <Combobox.Root>
            <Combobox.Trigger v-slots={{ render: renderOwnButton }} />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ),
      },
      {
        name: 'Combobox.Input',
        renderControl: () => (
          <Combobox.Root>
            <Combobox.Input v-slots={{ render: renderOwnInput }} />
          </Combobox.Root>
        ),
      },
      {
        name: 'Autocomplete.Input',
        renderControl: () => (
          <Autocomplete.Root>
            <Autocomplete.Input v-slots={{ render: renderOwnInput }} />
          </Autocomplete.Root>
        ),
      },
      {
        name: 'Checkbox.Root nativeButton',
        renderControl: () => <Checkbox.Root nativeButton v-slots={{ render: renderOwnButton }} />,
      },
      {
        name: 'Switch.Root nativeButton',
        renderControl: () => <Switch.Root nativeButton v-slots={{ render: renderOwnButton }} />,
      },
      {
        name: 'Radio.Root nativeButton',
        renderControl: () => (
          <RadioGroup>
            <Radio.Root value="a" nativeButton v-slots={{ render: renderOwnButton }} />
          </RadioGroup>
        ),
      },
      {
        name: 'NumberField.Input',
        renderControl: () => (
          <NumberField.Root>
            <NumberField.Input v-slots={{ render: renderOwnInput }} />
          </NumberField.Root>
        ),
      },
      {
        name: 'OTPField.Input',
        renderControl: () => (
          <OTPField.Root length={2}>
            <OTPField.Input v-slots={{ render: renderOwnInput }} />
            <OTPField.Input />
          </OTPField.Root>
        ),
      },
      {
        name: 'DateField.Segment',
        renderControl: () => (
          <DateField.Root locale="en-US">
            <DateField.Segment segment={MONTH} v-slots={{ render: renderOwnInput }} />
          </DateField.Root>
        ),
      },
      {
        name: 'TimeField.Segment',
        renderControl: () => (
          <TimeField.Root locale="en-US">
            <TimeField.Segment segment={HOUR} v-slots={{ render: renderOwnInput }} />
          </TimeField.Root>
        ),
      },
    ])('names the element of the control: $name', async ({ renderControl }) => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          {renderControl()}
        </Field.Root>,
      );

      const label = screen.getByTestId<HTMLLabelElement>('label');
      expect(label).toHaveAttribute('for', 'own');
      expect(label.control).toBe(document.getElementById('own'));
    });

    it.each([
      {
        name: 'Checkbox.Root',
        renderControl: () => <Checkbox.Root v-slots={{ render: renderOwnSpan }} />,
      },
      {
        name: 'Switch.Root',
        renderControl: () => <Switch.Root v-slots={{ render: renderOwnSpan }} />,
      },
      {
        name: 'Radio.Root',
        renderControl: () => (
          <RadioGroup>
            <Radio.Root value="a" v-slots={{ render: renderOwnSpan }} />
          </RadioGroup>
        ),
      },
    ])(
      'names the hidden input, and not the element of the slot: $name',
      async ({ renderControl }) => {
        await render(
          <Field.Root>
            <Field.Label data-testid="label">Label</Field.Label>
            {renderControl()}
          </Field.Root>,
        );

        const label = screen.getByTestId<HTMLLabelElement>('label');
        expect(label.control).toBeInstanceOf(HTMLInputElement);
        expect(label.control).not.toBe(document.getElementById('own'));
      },
    );

    it('focuses the element of the control on a click, also when the label is not native', async () => {
      const { user } = await render(
        <Field.Root>
          <Field.Label nativeLabel={false} as="div" data-testid="label">
            Label
          </Field.Label>
          <Field.Control v-slots={{ render: renderOwnInput }} />
        </Field.Root>,
      );

      await user.click(screen.getByTestId('label'));

      expect(document.getElementById('own')).toHaveFocus();
    });

    it('checks a native button checkbox on a click on the label', async () => {
      const { user } = await render(
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Checkbox.Root nativeButton v-slots={{ render: renderOwnButton }} />
        </Field.Root>,
      );

      await user.click(screen.getByTestId('label'));

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    });

    it('follows a change of the id, and gives the control the id of the field again', async () => {
      const slotId = shallowRef<string | undefined>('first');

      await render(() => (
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Field.Control
            id="prop"
            v-slots={{
              render: ({ props }: { props: HTMLProps }) =>
                slotId.value === undefined ? (
                  <input {...props} />
                ) : (
                  <input {...props} id={slotId.value} />
                ),
            }}
          />
        </Field.Root>
      ));

      const label = screen.getByTestId('label');
      const control = screen.getByRole('textbox');
      expect(control).toHaveAttribute('id', 'first');
      expect(label).toHaveAttribute('for', 'first');

      slotId.value = 'second';
      await flushMicrotasks();

      expect(control).toHaveAttribute('id', 'second');
      expect(label).toHaveAttribute('for', 'second');

      slotId.value = undefined;
      await flushMicrotasks();

      expect(control).toHaveAttribute('id', 'prop');
      expect(label).toHaveAttribute('for', 'prop');
    });

    it('gives the control the id of the label element', async () => {
      await render(
        <Field.Root>
          <Field.Label
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => <label {...props} id="own-label" />,
            }}
          />
          <Field.Control data-testid="control" />
        </Field.Root>,
      );

      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'own-label');
    });

    it('names the element of the control that KeepAlive shows', async () => {
      const shown = shallowRef<'a' | 'b'>('a');
      const renderInputWithId =
        (id: string) =>
        ({ props }: { props: HTMLProps }) => <input {...props} id={id} />;

      await render(() => (
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <KeepAlive>
            {shown.value === 'a' ? (
              <Field.Control key="a" v-slots={{ render: renderInputWithId('a') }} />
            ) : (
              <Field.Control key="b" v-slots={{ render: renderInputWithId('b') }} />
            )}
          </KeepAlive>
        </Field.Root>
      ));

      const label = screen.getByTestId('label');
      expect(label).toHaveAttribute('for', 'a');

      shown.value = 'b';
      await flushMicrotasks();

      expect(label).toHaveAttribute('for', 'b');

      shown.value = 'a';
      await flushMicrotasks();

      expect(label).toHaveAttribute('for', 'a');
    });

    it('gives no for to the label of a group of native button checkboxes', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <CheckboxGroup>
            <Checkbox.Root value="a" nativeButton as="button" />
            <Checkbox.Root value="b" nativeButton as="button" />
          </CheckboxGroup>
        </Field.Root>,
      );

      expect(screen.getByTestId('label')).not.toHaveAttribute('for');
    });

    it('keeps the id of the field when the #render slot gives an empty id', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Field.Control
            id="prop"
            v-slots={{ render: ({ props }: { props: HTMLProps }) => <input {...props} id="" /> }}
          />
        </Field.Root>,
      );

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'prop');
    });
  });

  describe('KeepAlive', () => {
    it('names the control only while KeepAlive shows the label', async () => {
      const shown = shallowRef(true);

      await render(() => (
        <Field.Root>
          <KeepAlive>
            {shown.value ? <Field.Label data-testid="label">Name</Field.Label> : null}
          </KeepAlive>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      const label = screen.getByTestId('label');
      const control = screen.getByTestId('control');
      expect(control).toHaveAttribute('aria-labelledby', label.id);

      shown.value = false;
      await flushMicrotasks();

      expect(control).not.toHaveAttribute('aria-labelledby');

      shown.value = true;
      await flushMicrotasks();

      expect(control).toHaveAttribute('aria-labelledby', label.id);
    });

    it.each([
      {
        name: 'no label outside',
        outside: false,
        expected: ['label-a', null, null, 'label-b'],
      },
      {
        name: 'a label outside',
        outside: true,
        expected: ['label-c', 'label-c', 'label-c', 'label-b'],
      },
    ])(
      'names the control with a label that mounts while held only after the show: $name',
      async ({ outside, expected }) => {
        const { HeldBranch, hide, mountWhileHeld, show } = createHeldBranch(
          () => (
            <Field.Label key="b" id="label-b">
              B
            </Field.Label>
          ),
          {
            renderBranch: (part) => (
              <div>
                <Field.Label key="a" id="label-a">
                  A
                </Field.Label>
                {part}
              </div>
            ),
          },
        );
        await render(() => (
          <Field.Root>
            <Field.Control data-testid="control" />
            <HeldBranch />
            {outside ? <Field.Label id="label-c">C</Field.Label> : null}
          </Field.Root>
        ));
        const control = screen.getByTestId('control');
        const seen = [control.getAttribute('aria-labelledby')];
        for (const change of [hide, mountWhileHeld, show]) {
          await change();
          seen.push(control.getAttribute('aria-labelledby'));
        }

        expect(seen).toEqual(expected);
      },
    );
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws a descriptive error when rendered outside <Field.Root>', async () => {
    await expect(render(<Field.Label />)).rejects.toThrow(
      'Vase UI: A part of Field must be inside <Field.Root>. Without a root the part has no field state to read. Put the part inside <Field.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
