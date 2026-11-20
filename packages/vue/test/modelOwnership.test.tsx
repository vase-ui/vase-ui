import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import DefaultModel from './fixtures/DefaultModel.vue';

const { render } = createRenderer();

it('VUE-141: Input keeps the last parent text and accepts typed edits after release', async () => {
  const value = shallowRef<string | undefined>('first');
  const hint = shallowRef('before');
  const updates = vi.fn();
  await render(() => (
    <form>
      <Field.Root>
        <Input
          modelValue={value.value}
          defaultValue="reset"
          {...{ placeholder: hint.value }}
          onUpdate:modelValue={updates}
        />
      </Field.Root>
    </form>
  ));
  const input = screen.getByRole<HTMLInputElement>('textbox');
  value.value = 'parent';
  await flushMicrotasks();
  expect(input).toHaveValue('parent');

  value.value = undefined;
  await flushMicrotasks();
  expect(input).toHaveValue('parent');
  expect(updates).not.toHaveBeenCalled();
  await userEvent.type(input, '{End}x');
  expect(updates).toHaveBeenLastCalledWith('parentx');
  hint.value = 'after';
  await flushMicrotasks();
  expect(input).toHaveValue('parentx');
  // A native reset gives the value of the mount.
  input.form?.reset();
  await new Promise((resolve) => setTimeout(resolve));
  await flushMicrotasks();
  expect(input).toHaveValue('first');
});

it('binds the group, pressed and checked values with the default model', async () => {
  const { container } = await render(<DefaultModel />);
  const italic = screen.getByRole('button', { name: 'Italic' });
  const email = screen.getByRole('switch', { name: 'Email' });
  const output = screen.getByRole('status');
  const form = container.querySelector('form')!;

  expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  expect(new FormData(form).get('notifications')).toBe('email');
  await userEvent.click(italic);
  expect(italic).toHaveAttribute('aria-pressed', 'true');
  expect(output).toHaveTextContent('bold,italic / true / true');

  await userEvent.click(email);
  expect(email).not.toBeChecked();
  expect(new FormData(form).has('notifications')).toBe(false);
  expect(output).toHaveTextContent('bold,italic / true / false');
});
