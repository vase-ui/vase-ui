import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { createHeldBranch, createRenderer, flushMicrotasks, screen } from '#test-utils';
import { NOOP } from '../noop';
import { useFieldInput } from '../field-register-control';

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

  // The new control is required and empty. The field is invalid when it validates that control.
  it.each([
    { name: 'while held, after', mount: 'while held', before: false, invalid: true },
    { name: 'while held, before', mount: 'while held', before: true, invalid: false },
    { name: 'in a show from a state, after', mount: 'state', before: false, invalid: true },
    { name: 'in a show from a state, before', mount: 'state', before: true, invalid: false },
    { name: 'in a show from a prop, after', mount: 'prop', before: false, invalid: true },
    { name: 'in a show from a prop, before', mount: 'prop', before: true, invalid: false },
  ])(
    'the field validates the last input of a shown branch in the document: $name',
    async ({ mount, before, invalid }) => {
      const { HeldBranch, hide, mountWhileHeld, show, mountInActivation } = createHeldBranch(
        () => <Field.Control key="new" required />,
        {
          renderBranch: (part) => (
            <div>
              {before ? part : null}
              <Field.Control key="old" defaultValue="old" />
              {before ? null : part}
            </div>
          ),
        },
      );
      const submit = await renderForm(() => [<HeldBranch key="branch" />]);

      if (mount === 'while held') {
        await mountWhileHeld();
        await show();
      } else {
        await hide();
        await mountInActivation({ fromProp: mount === 'prop' });
      }

      expect(await submit()).toEqual({ submitted: invalid ? 0 : 1, invalid });
    },
  );

  it('the field validates the input of the last show when it comes before an input of an earlier show', async () => {
    const requiredBranch = createHeldBranch(() => <Field.Control key="required" required />, {
      mounted: true,
    });
    const filledBranch = createHeldBranch(
      () => <Field.Control key="filled" defaultValue="filled" />,
      { mounted: true },
    );
    const submit = await renderForm(() => [
      <requiredBranch.HeldBranch key="required" />,
      <filledBranch.HeldBranch key="filled" />,
    ]);

    await requiredBranch.hide();
    await filledBranch.hide();
    await filledBranch.show();
    await requiredBranch.show();

    expect(await submit()).toEqual({ submitted: 0, invalid: true });
  });

  it('the field does not validate a control that mounted in a show after KeepAlive holds it again', async () => {
    const { HeldBranch, hide, mountInActivation } = createHeldBranch(() => (
      <Field.Control key="new" required />
    ));
    const submit = await renderForm(() => [
      <Field.Control key="shown" defaultValue="shown" />,
      <HeldBranch key="branch" />,
    ]);

    await hide();
    await mountInActivation({ fromProp: true });
    await hide();

    expect(await submit()).toEqual({ submitted: 1, invalid: false });
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
