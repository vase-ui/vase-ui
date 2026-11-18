import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Input } from '@vase-ui/vue/input';
import { OTPField } from '@vase-ui/vue/otp-field';
import { Switch } from '@vase-ui/vue/switch';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';

describe('useFieldControl', () => {
  const { render } = createRenderer();

  it.each([
    { part: 'Switch', control: () => <Switch.Root required /> },
    {
      part: 'OTPField',
      control: () => (
        <OTPField.Root required length={1}>
          <OTPField.Input />
        </OTPField.Root>
      ),
    },
  ])('validates the text input that mounts after a required $part', async ({ control }) => {
    const showText = shallowRef(true);
    const submit = vi.fn();
    await render(() => (
      <Form data-testid="form" onFormSubmit={submit}>
        <Field.Root name="entry" data-testid="field">
          {control()}
          {showText.value && <Field.Control defaultValue="last" />}
        </Field.Root>
      </Form>
    ));
    const form = screen.getByTestId('form');
    await fireEvent.submit(form);
    expect(submit.mock.calls.map(([values]) => values)).toEqual([{ entry: 'last' }]);

    showText.value = false;
    await flushMicrotasks();
    await fireEvent.submit(form);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('field')).toHaveAttribute('data-invalid');
  });

  it('keeps the first control as the dirty baseline when two controls mount together', async () => {
    await render(
      <Field.Root data-testid="field">
        <Field.Control defaultValue="first" />
        <Field.Control aria-label="Second" defaultValue="second" />
      </Field.Root>,
    );
    const field = screen.getByTestId('field');
    const input = screen.getByRole('textbox', { name: 'Second' });
    await fireEvent.input(input, { target: { value: 'changed' } });
    expect(field).toHaveAttribute('data-dirty');
    await fireEvent.input(input, { target: { value: 'first' } });
    expect(field).not.toHaveAttribute('data-dirty');
  });

  it('uses the active control for native names and form values after a rename or removal', async () => {
    const name = shallowRef<string>();
    const showLast = shallowRef(true);
    const submit = vi.fn();
    await render(() => (
      <Form data-testid="form" onFormSubmit={submit}>
        <Field.Root name={name.value}>
          <Field.Control name="first" defaultValue="one" />
          {showLast.value && <Input name="last" defaultValue="two" />}
        </Field.Root>
      </Form>
    ));
    const form = screen.getByTestId<HTMLFormElement>('form');

    async function check(key: string, values: string[]) {
      expect([...new FormData(form)]).toEqual(values.map((value) => [key, value]));
      await fireEvent.submit(form);
      expect(submit.mock.lastCall?.[0]).toEqual({ [key]: values.at(-1) });
    }

    await check('last', ['one', 'two']);
    name.value = 'shared';
    await flushMicrotasks();
    await check('shared', ['one', 'two']);
    showLast.value = false;
    name.value = undefined;
    await flushMicrotasks();
    await check('first', ['one']);
  });
});
