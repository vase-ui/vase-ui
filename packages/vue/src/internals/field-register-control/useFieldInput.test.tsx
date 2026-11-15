import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { createHeldBranch, createRenderer, flushMicrotasks, screen } from '#test-utils';
import { NOOP } from '../noop';
import { useFieldInput } from './useFieldInput';

describe('useFieldInput', () => {
  const { render } = createRenderer();

  // All apps share the default context of a field, so it must hold no input.
  it('keeps no input of a control that has no field', async () => {
    let setInput: ReturnType<typeof useFieldInput> | undefined;
    const Control = defineComponent(() => {
      setInput = useFieldInput();
      return () => null;
    });

    await render(<Control />);

    expect(setInput).toBe(NOOP);
  });

  async function renderForm(controls: () => (VNode | null)[]) {
    const handleSubmit = vi.fn();
    const { user } = await render(() => (
      <Form onFormSubmit={handleSubmit}>
        <Field.Root name="email" data-testid="field">
          {controls()}
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>
    ));

    return async function submit() {
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      return {
        submitted: handleSubmit.mock.calls.length,
        invalid: screen.getByTestId('field').hasAttribute('data-invalid'),
      };
    };
  }

  it.each([{ name: 'unmount' }, { name: 'deactivation' }])(
    'VUE-83: the field validates the input before the last one when the last one goes: $name',
    async ({ name }) => {
      const visible = shallowRef(true);
      const Branch = defineComponent(() => () => <Field.Control defaultValue="last" />);
      const renderLast =
        name === 'unmount'
          ? () => (visible.value ? <Field.Control key="last" defaultValue="last" /> : null)
          : () => <KeepAlive key="branch">{visible.value ? <Branch /> : null}</KeepAlive>;
      const submit = await renderForm(() => [<Field.Control key="shown" required />, renderLast()]);

      visible.value = false;
      await flushMicrotasks();

      expect(await submit()).toEqual({ submitted: 0, invalid: true });
    },
  );

  it('a control that mounts in a held branch does not take the input of a shown control', async () => {
    const { HeldBranch, mountWhileHeld } = createHeldBranch(() => (
      <Field.Control key="held" defaultValue="held" />
    ));
    const submit = await renderForm(() => [
      <Field.Control key="shown" required />,
      <HeldBranch key="branch" />,
    ]);

    await mountWhileHeld();

    expect(await submit()).toEqual({ submitted: 0, invalid: true });
  });

  it('two controls that mount in one held branch give no input', async () => {
    const { HeldBranch, mountWhileHeld } = createHeldBranch(() => [
      <Field.Control key="first" defaultValue="first" />,
      <Field.Control key="second" defaultValue="second" />,
    ]);
    const submit = await renderForm(() => [
      <Field.Control key="shown" required />,
      <HeldBranch key="branch" />,
    ]);

    await mountWhileHeld();

    expect(await submit()).toEqual({ submitted: 0, invalid: true });
  });

  it('the field validates the input of the last control of a branch that KeepAlive shows again', async () => {
    const visible = shallowRef(true);
    const Branch = defineComponent(() => () => (
      <div>
        <Field.Control defaultValue="first" />
        <Field.Control required />
      </div>
    ));
    const submit = await renderForm(() => [
      <KeepAlive key="branch">{visible.value ? <Branch /> : null}</KeepAlive>,
      <Field.Control key="shown" defaultValue="shown" />,
    ]);

    visible.value = false;
    await flushMicrotasks();
    visible.value = true;
    await flushMicrotasks();

    expect(await submit()).toEqual({ submitted: 0, invalid: true });
  });

  it('a held control whose element changes gives no input', async () => {
    const visible = shallowRef(true);
    const tag = shallowRef('input');
    const Branch = defineComponent(() => () => <Field.Control as={tag.value} required />);
    const submit = await renderForm(() => [
      <Field.Control key="shown" defaultValue="shown" />,
      <KeepAlive key="branch">{visible.value ? <Branch /> : null}</KeepAlive>,
    ]);

    visible.value = false;
    await flushMicrotasks();
    tag.value = 'textarea';
    await flushMicrotasks();

    expect(await submit()).toEqual({ submitted: 1, invalid: false });

    visible.value = true;
    await flushMicrotasks();

    expect(screen.getAllByRole('textbox').map((control) => control.tagName)).toEqual([
      'INPUT',
      'TEXTAREA',
    ]);
  });
});
