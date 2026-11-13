import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Field.Validity />', () => {
  const { render } = createRenderer();

  it.each([{ validationMode: 'onBlur' as const }, { validationMode: 'onSubmit' as const }])(
    'surfaces valueMissing immediately after a stale custom error in $validationMode mode',
    async ({ validationMode }) => {
      const handleValidity = vi.fn();
      const validate = vi.fn(() => 'custom error');

      await render(
        <Form>
          <Field.Root validationMode={validationMode} validate={validate}>
            <Field.Control required />
            <Field.Error match="valueMissing">Required</Field.Error>
            <Field.Validity v-slots={{ default: handleValidity }} />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      const establishInvalidState = async () => {
        if (validationMode === 'onBlur') {
          await fireEvent.focusOut(input);
        } else {
          await fireEvent.click(screen.getByText('submit'));
        }
      };

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: 'invalid' } });
      await establishInvalidState();

      expect(handleValidity.mock.lastCall?.[0].value).toBe('invalid');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
      expect(validate).toHaveBeenCalledTimes(1);

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '' } });

      expect(handleValidity.mock.lastCall?.[0].value).toBe('');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(
        validationMode === 'onSubmit',
      );
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(true);
      expect(screen.getByText('Required')).toBeVisible();
      expect(validate).toHaveBeenCalledTimes(validationMode === 'onBlur' ? 1 : 2);

      if (validationMode === 'onBlur') {
        await fireEvent.focusOut(input);
      } else {
        await fireEvent.click(screen.getByText('submit'));
      }

      expect(handleValidity.mock.lastCall?.[0].value).toBe('');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(
        validationMode === 'onSubmit',
      );
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(true);
      expect(screen.getByText('Required')).toBeVisible();
    },
  );

  it.skipIf(isJSDOM)('defers badInput during required change revalidation', async () => {
    // Real browser input is needed: typing `e` into a number input only sets `badInput` when the
    // browser handles the keystroke.
    const handleValidity = vi.fn();

    await render(
      <Field.Root validationMode="onBlur" validate={() => 'custom error'}>
        <Field.Control type="number" required />
        <Field.Error match="valueMissing">Required</Field.Error>
        <Field.Error match="badInput">Invalid number</Field.Error>
        <Field.Validity v-slots={{ default: handleValidity }} />
      </Field.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('spinbutton');

    await userEvent.type(input, '1[Tab]');
    await flushMicrotasks();

    expect(handleValidity.mock.lastCall?.[0].value).toBe('1');
    expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(true);

    await userEvent.type(input, '{Control>}a{/Control}e');
    await flushMicrotasks();

    expect(input.validity.valueMissing).toBe(true);
    expect(input.validity.badInput).toBe(true);
    expect(handleValidity.mock.lastCall?.[0].value).toBe('1');
    expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
    expect(handleValidity.mock.lastCall?.[0].validity.badInput).toBe(false);
    expect(screen.queryByText('Required')).toBe(null);
    expect(screen.queryByText('Invalid number')).toBe(null);
  });

  it('reports the invalid prop of the root as an invalid validity', async () => {
    const handleValidity = vi.fn();

    await render(
      <Field.Root invalid>
        <Field.Control />
        <Field.Validity v-slots={{ default: handleValidity }} />
      </Field.Root>,
    );

    expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(false);
  });

  it('gives its slot the same objects until the validity changes', async () => {
    const handleValidity = vi.fn();

    await render(
      <Field.Root>
        <Field.Control />
        <Field.Validity v-slots={{ default: handleValidity }} />
      </Field.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    const before = handleValidity.mock.lastCall?.[0];

    // These changes are about the focus, the dirty state, the filled state and the touched state.
    await fireEvent.focusIn(input);
    await fireEvent.input(input, { target: { value: 'a' } });
    await fireEvent.focusOut(input);

    expect(screen.getByRole('textbox')).toHaveAttribute('data-touched', '');
    expect(handleValidity.mock.lastCall?.[0]).toBe(before);
    expect(handleValidity.mock.lastCall?.[0].validity).toBe(before.validity);
  });

  describe('validationMode=onSubmit', () => {
    it('should pass validity data', async () => {
      const handleValidity = vi.fn();

      await render(
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Validity v-slots={{ default: handleValidity }} />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(null);

      await fireEvent.click(screen.getByText('submit'));

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(false);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(true);
      expect(handleValidity.mock.lastCall?.[0]).toHaveProperty('transitionStatus');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: 'test' } });

      expect(handleValidity.mock.lastCall?.[0].value).toBe('test');
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
    });
  });

  describe('validationMode=onBlur', () => {
    it('should pass validity data', async () => {
      const handleValidity = vi.fn();

      await render(
        <Field.Root validationMode="onBlur">
          <Field.Control required />
          <Field.Validity v-slots={{ default: handleValidity }} />
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(null);

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: 'test' } });
      await fireEvent.focusOut(input);

      expect(handleValidity.mock.lastCall?.[0].value).toBe('test');
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
    });

    it('should correctly pass errors when validate function returns a string', async () => {
      const handleValidity = vi.fn();

      await render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Field.Control />
          <Field.Validity v-slots={{ default: handleValidity }} />
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      expect(handleValidity.mock.lastCall?.[0].error).toBe('error');
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['error']);
    });

    it('should correctly pass errors when validate function returns an array of strings', async () => {
      const handleValidity = vi.fn();

      await render(
        <Field.Root validationMode="onBlur" validate={() => ['1', '2']}>
          <Field.Control />
          <Field.Validity v-slots={{ default: handleValidity }} />
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      expect(handleValidity.mock.lastCall?.[0].error).toBe('1');
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['1', '2']);
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case that renders a slot gets a warning about that slot.
  it('throws a descriptive error when rendered outside <Field.Root>', async () => {
    await expect(render(<Field.Validity />)).rejects.toThrow(
      'Vase UI: A part of Field must be inside <Field.Root>. Without a root the part has no field state to read. Put the part inside <Field.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
