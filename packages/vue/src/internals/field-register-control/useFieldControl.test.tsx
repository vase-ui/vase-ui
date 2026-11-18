import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Input } from '@vase-ui/vue/input';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';

describe('useFieldControl', () => {
  const { render } = createRenderer();

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
