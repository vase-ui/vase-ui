import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import InputHydration from './InputHydration.test.vue';

describe('<Input />', () => {
  const { render } = createRenderer();

  describeConformance(<Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    render,
  }));

  it('writes the typed value to v-model:value and shows a value written to it', async () => {
    const value = shallowRef('');

    await render(() => (
      <Input
        value={value.value}
        onUpdate:value={(next: string) => {
          value.value = next;
        }}
      />
    ));

    const input = screen.getByRole<HTMLInputElement>('textbox');
    await fireEvent.input(input, { target: { value: 'typed' } });

    expect(value.value).toBe('typed');

    value.value = 'written';
    await flushMicrotasks();

    expect(input).toHaveValue('written');
  });

  it('stops update:value when a valueChange listener cancels the change', async () => {
    const updates: string[] = [];

    await render(
      <Input
        value="fixed"
        onValueChange={(_value: string, details: Input.ChangeEventDetails) => details.cancel()}
        onUpdate:value={(next: string) => {
          updates.push(next);
        }}
      />,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    await fireEvent.input(input, { target: { value: 'fixedx' } });
    await flushMicrotasks();

    expect(updates).toEqual([]);
    expect(input).toHaveValue('fixed');
  });

  it('gives the state of the field to the #render slot', async () => {
    await render(
      <Field.Root invalid>
        <Input
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => <textarea {...props} />,
          }}
        />
      </Field.Root>,
    );

    const textarea = screen.getByRole('textbox');

    expect(textarea.localName).toBe('textarea');
    expect(textarea).toHaveAttribute('data-invalid', '');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });

  it('is named by the label of its field and described by the description of its field', async () => {
    await render(
      <Field.Root>
        <Field.Label>Name</Field.Label>
        <Input />
        <Field.Description>Your full name</Field.Description>
      </Field.Root>,
    );

    const input = screen.getByRole('textbox', { name: 'Name' });

    expect(screen.getByText('Name')).toHaveAttribute('for', input.id);
    expect(input).toHaveAccessibleDescription('Your full name');
  });

  it('leaves a disabled input out of the data of its form', async () => {
    await render(
      <form data-testid="form">
        <Input name="a" defaultValue="x" />
        <Input name="b" disabled defaultValue="y" />
      </form>,
    );

    const form = screen.getByTestId<HTMLFormElement>('form');
    const [, disabledInput] = within(form).getAllByRole('textbox');

    expect(disabledInput).toHaveAttribute('disabled', '');
    expect(disabledInput).toHaveAttribute('data-disabled', '');
    expect(Object.fromEntries(new FormData(form))).toEqual({ a: 'x' });
  });

  describe('hydration', () => {
    it('hydrates the name, the value and the id of the server HTML with no message', async () => {
      const props = { defaultValue: 'foo' };
      const serverHtml = await renderOnServer('src/input/InputHydration.test.vue', props);

      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverInput = template.content.querySelector('input')!;
      expect(serverInput.getAttribute('name')).toBe('name');
      expect(serverInput.getAttribute('value')).toBe('foo');
      expect(serverInput.id).not.toBe('');
      expect(serverInput.hasAttribute('data-filled')).toBe(true);
      expect(serverInput.closest('label')).not.toBe(null);

      const { container } = await hydrate(InputHydration, { serverHtml, props });

      expect(within(container).getByTestId('input')).toHaveValue('foo');
    });
  });
});
