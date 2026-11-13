import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Field } from '@vase-ui/vue/field';
import FieldPartOrder from './FieldPartOrder.test.vue';

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

function readAttribute(html: string, testId: string, name: string) {
  const tag = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
  return new RegExp(` ${name}="([^"]*)"`).exec(tag)?.[1];
}

function read(html: string) {
  return {
    labelId: readAttribute(html, 'label', 'id'),
    labelFor: readAttribute(html, 'label', 'for'),
    descriptionId: readAttribute(html, 'description', 'id'),
    errorId: readAttribute(html, 'error', 'id'),
    controlId: readAttribute(html, 'control', 'id'),
    labelledBy: readAttribute(html, 'control', 'aria-labelledby'),
    describedBy: readAttribute(html, 'control', 'aria-describedby'),
  };
}

describe('VUE-17: <Field.Control /> on a server, with a label and messages', () => {
  it.each([
    {
      name: 'the label and the messages first',
      parts: ['label', 'description', 'error', 'control'],
    },
    {
      name: 'the label first, the messages last',
      parts: ['label', 'control', 'description', 'error'],
    },
    { name: 'the control first', parts: ['control', 'label', 'description', 'error'] },
    {
      name: 'the messages first, the label last',
      parts: ['description', 'error', 'control', 'label'],
    },
  ] as const)('names the label and the messages: $name', async ({ parts }) => {
    const server = read(await renderToString(<FieldPartOrder parts={[...parts]} />));

    expect(server.labelId).toMatch(/^vase-ui-./);
    expect(server.labelledBy).toBe(server.labelId);
    expect(server.labelFor).toBe(server.controlId);
    expect(server.describedBy).toBe(`${server.descriptionId} ${server.errorId}`);
  });

  it('names a control with the `id` prop of a label that comes after it', async () => {
    const server = read(
      await renderToString(<FieldPartOrder parts={['control', 'label']} labelId="own-label" />),
    );

    expect(server.labelId).toBe('own-label');
    expect(server.labelledBy).toBe('own-label');
  });

  it('gives a control with no label no `aria-labelledby`', async () => {
    const server = read(await renderToString(<FieldPartOrder parts={['control', 'error']} />));

    expect(server.labelledBy).toBeUndefined();
    expect(server.describedBy).toBe(server.errorId);
  });
});

describe('<Field.Label /> and <Field.Item /> on a server', () => {
  it('renders a label that is not native with its id and no `for`', async () => {
    const server = read(
      await renderToString(
        <Field.Root>
          <Field.Label nativeLabel={false} as="div" data-testid="label">
            Label
          </Field.Label>
          <Field.Control data-testid="control" />
        </Field.Root>,
      ),
    );

    expect(server.labelId).toMatch(/^vase-ui-./);
    expect(server.labelFor).toBeUndefined();
    expect(server.labelledBy).toBe(server.labelId);
  });

  it('gives the label and the control of each item their own ids', async () => {
    const html = await renderToString(
      <Field.Root>
        <Field.Item>
          <Field.Label data-testid="first-label">First</Field.Label>
          <Field.Control data-testid="first-control" />
        </Field.Item>
        <Field.Item>
          <Field.Control data-testid="second-control" />
          <Field.Label data-testid="second-label">Second</Field.Label>
        </Field.Item>
      </Field.Root>,
    );
    const firstControl = readAttribute(html, 'first-control', 'id');
    const secondControl = readAttribute(html, 'second-control', 'id');

    expect(firstControl).toMatch(/^vase-ui-./);
    expect(secondControl).not.toBe(firstControl);
    expect(readAttribute(html, 'first-label', 'for')).toBe(firstControl);
    expect(readAttribute(html, 'second-label', 'for')).toBe(secondControl);
    expect(readAttribute(html, 'first-control', 'aria-labelledby')).toBe(
      readAttribute(html, 'first-label', 'id'),
    );
    expect(readAttribute(html, 'second-control', 'aria-labelledby')).toBe(
      readAttribute(html, 'second-label', 'id'),
    );
  });
});
