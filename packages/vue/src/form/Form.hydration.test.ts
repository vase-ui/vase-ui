import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import FieldsInForm from '../../test/fixtures/FieldsInForm.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML is a form with novalidate and the errors of the fields, and a blocked submit focuses after hydration', async () => {
    const props = {
      form: { errors: { email: 'Taken.' } },
      fields: [{ root: { name: 'email' }, input: { id: 'email' } }],
    };
    const root = await renderOnServer('FieldsInForm', props);
    const form = root.querySelector('form')!;
    const input = root.querySelector('input')!;
    expect(form).toHaveAttribute('novalidate');
    expect(form.firstElementChild).toHaveAttribute('data-invalid');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(form.firstElementChild!.querySelector(':scope > div')).toHaveTextContent('Taken.');
    hydrate(FieldsInForm, props, root);
    await nextTick();
    form.querySelector('button')!.click();
    expect(input).toHaveFocus();
  });

  test('with :novalidate="false", the server HTML has no novalidate', async () => {
    const props = { form: { novalidate: false }, fields: [] };
    const root = await renderOnServer('FieldsInForm', props);
    expect(root.querySelector('form')).not.toHaveAttribute('novalidate');
    hydrate(FieldsInForm, props, root);
  });
});
