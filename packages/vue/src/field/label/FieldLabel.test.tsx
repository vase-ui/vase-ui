import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import {
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
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case that renders a slot gets a warning about that slot.
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
