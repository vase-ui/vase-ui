import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Field } from '@vase-ui/vue/field';

// The generated id has another form in each version of Vue.
function readId(html: string) {
  const id = /id="([^"]*)"/.exec(html)?.[1];
  expect(id).toMatch(/^vase-ui-./);
  return id;
}

describe('<Field.Root /> on a server', () => {
  // The root writes its attributes before the control runs its `setup`. The root gets
  // `data-filled` in the first render of the browser.
  it('renders the value, the id, the name and the filled state of a control that has a default value', async () => {
    const html = await renderToString(
      <Field.Root name="name">
        <Field.Control defaultValue="foo" />
      </Field.Root>,
    );

    expect(html).toBe(
      `<div><!--[--><input data-filled id="${readId(html)}" name="name" value="foo"><!--]--></div>`,
    );
  });

  it('renders the disabled state on the root and on the control', async () => {
    const html = await renderToString(
      <Field.Root disabled>
        <Field.Control />
      </Field.Root>,
    );

    expect(html).toBe(
      `<div data-disabled><!--[--><input data-disabled id="${readId(html)}" disabled><!--]--></div>`,
    );
  });

  it('renders the invalid state on the root and on the control', async () => {
    const html = await renderToString(
      <Field.Root invalid>
        <Field.Control />
      </Field.Root>,
    );

    expect(html).toBe(
      `<div data-invalid><!--[--><input data-invalid id="${readId(html)}" aria-invalid="true"><!--]--></div>`,
    );
  });

  it('renders no value attribute for a control that has no value', async () => {
    const html = await renderToString(
      <Field.Root>
        <Field.Control />
      </Field.Root>,
    );

    expect(html).toBe(`<div><!--[--><input id="${readId(html)}"><!--]--></div>`);
  });
});
