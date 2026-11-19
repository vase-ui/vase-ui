import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Toolbar } from '@vase-ui/vue/toolbar';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  hydrateAfter,
  mockPageBeforeLoad,
  recordInputEvents,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import InputBeforeHydration from './InputBeforeHydration.test.vue';
import InputHydration from './InputHydration.test.vue';

describe('<Input />', () => {
  const { render } = createRenderer();

  it('uses its id for the input and its field label', async () => {
    await render(
      <Field.Root>
        <Field.Label>Address</Field.Label>
        <Input id="address" />
      </Field.Root>,
    );

    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveAttribute('id', 'address');
    expect(screen.getByText('Address')).toHaveAttribute('for', 'address');
  });

  it('follows the native value of a toolbar input in the field state', async () => {
    const value = shallowRef('prefilled');
    await render(() => (
      <Toolbar.Root>
        <Field.Root>
          <Toolbar.Input as={Input} value={value.value} />
          <Field.Description>Search terms</Field.Description>
        </Field.Root>
      </Toolbar.Root>
    ));

    const input = screen.getByRole('textbox');
    const description = screen.getByText('Search terms');
    expect(input).toHaveAttribute('data-filled');
    value.value = '';
    await flushMicrotasks();
    expect(input).toHaveValue('');
    expect(input).not.toHaveAttribute('data-filled');
    expect(description).not.toHaveAttribute('data-filled');
    await fireEvent.input(input, { target: { value: 'refused' } });
    expect(input).toHaveValue('');
    expect(description).not.toHaveAttribute('data-filled');

    value.value = 'prefilled';
    await flushMicrotasks();
    expect(input).toHaveAttribute('data-filled');
    expect(description).not.toHaveAttribute('data-dirty');
  });

  describeConformance(<Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    render,
  }));

  it('writes the typed value to v-model and shows a value written to it', async () => {
    const value = shallowRef('');

    await render(() => (
      <Input
        modelValue={value.value}
        onUpdate:modelValue={(next: string) => {
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

  it('forwards each composing input event once through a custom render slot', async () => {
    const value = shallowRef('');
    const events: Event[] = [];
    const updates: string[] = [];
    await render(() => (
      <Input
        modelValue={value.value}
        onInput={(event) => events.push(event)}
        onUpdate:modelValue={(text) => {
          updates.push(text);
          value.value = text;
        }}
        v-slots={{ render: ({ props }: { props: HTMLProps }) => <input {...props} /> }}
      />
    ));
    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    const edit = new InputEvent('input', { bubbles: true, data: 'か', isComposing: true });
    input.value = 'か';
    input.dispatchEvent(edit);
    await flushMicrotasks();
    expect(input).toHaveFocus();
    expect(events).toEqual([edit]);
    expect(updates).toEqual(['か']);

    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '仮' }));
    const commit = new InputEvent('input', { bubbles: true, data: '仮' });
    input.value = '仮';
    input.dispatchEvent(commit);
    await flushMicrotasks();
    expect(events).toEqual([edit, commit]);
    expect(updates).toEqual(['か', '仮']);
    expect(input).toHaveValue('仮');
  });

  it('stops update:modelValue when a valueChange listener cancels the change', async () => {
    const updates: string[] = [];

    await render(
      <Input
        modelValue="fixed"
        onValueChange={(_value: string, details: Input.ChangeEventDetails) => details.cancel()}
        onUpdate:modelValue={(next: string) => {
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

  it.each([
    { name: 'defaultValue', props: { defaultValue: 'first' }, expected: 'edit' },
    { name: 'modelValue alone', props: { modelValue: 'first' }, expected: 'first' },
  ])('edits an input with $name', async ({ props, expected }) => {
    await render(<Input {...props} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('first');
    await fireEvent.input(input, { target: { value: 'edit' } });
    expect(input).toHaveValue(expected);
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

  describe('VUE-74: text that the user typed before the hydration', () => {
    it('writes the text to v-model', async () => {
      const serverHtml = await renderOnServer('src/input/InputBeforeHydration.test.vue');

      const { container } = await hydrateAfter(InputBeforeHydration, {
        serverHtml,
        before(serverContainer) {
          const serverInput = within(serverContainer).getByTestId<HTMLInputElement>('input');
          serverInput.focus();
          serverInput.value = 'foo bar';
        },
      });
      await flushMicrotasks();

      expect(within(container).getByTestId('input')).toHaveValue('foo bar');
      expect(within(container).getByTestId('value').textContent).toBe('foo bar');
    });
  });

  describe('VUE-81: the form state that the browser restores', () => {
    it('writes a value that the browser restores to v-model', async () => {
      const { container } = await render(<InputBeforeHydration />);
      within(container).getByTestId<HTMLInputElement>('input').value = 'restored';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(within(container).getByTestId('value').textContent).toBe('restored');
    });

    it('sends no event at the page show after a new value of Input', async () => {
      mockPageBeforeLoad();
      const value = shallowRef('a');
      const { container } = await render(() => (
        <Input modelValue={value.value} data-testid="input" />
      ));
      const recorded = recordInputEvents(container);
      screen.getByTestId<HTMLInputElement>('input').value = 'restored';

      value.value = 'b';
      await flushMicrotasks();
      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveValue('b');
      expect(recorded).toEqual([]);
    });
  });
});
