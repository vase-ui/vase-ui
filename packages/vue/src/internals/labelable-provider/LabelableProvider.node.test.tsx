import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import LabelableAsyncLabel from './LabelableAsyncLabel.test.vue';
import LabelableOrder from './LabelableOrder.test.vue';

function readAttribute(html: string, testId: string, name: string) {
  const tag = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
  return new RegExp(` ${name}="([^"]*)"`).exec(tag)?.[1];
}

function read(html: string) {
  return {
    labelId: readAttribute(html, 'label', 'id'),
    descriptionId: readAttribute(html, 'description', 'id'),
    errorId: readAttribute(html, 'error', 'id'),
    labelledBy: readAttribute(html, 'control', 'aria-labelledby'),
    describedBy: readAttribute(html, 'control', 'aria-describedby'),
  };
}

// The id has a prefix and a count. Vue makes a component that defers a boundary for `useId`, so the
// ids below it have another prefix.
function readIdPrefix(html: string, testId: string) {
  return new RegExp(` data-testid="${testId}" id="([^"]*?)\\d+"`).exec(html)?.[1];
}

describe('VUE-17: the server HTML of a control in a field', () => {
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
    const server = read(await renderToString(<LabelableOrder parts={[...parts]} />));

    expect(server.labelId).toMatch(/^vase-ui-./);
    expect(server.labelledBy).toBe(server.labelId);
    expect(server.describedBy).toBe(`${server.descriptionId} ${server.errorId}`);
  });

  it('names a control with the `id` prop of a label that comes after it', async () => {
    const server = read(
      await renderToString(<LabelableOrder parts={['control', 'label']} labelId="own-label" />),
    );

    expect(server.labelledBy).toBe('own-label');
  });

  it.each([
    { name: 'no label part', labelShown: true, parts: ['control', 'description'] },
    {
      name: 'a label that v-if removes',
      labelShown: false,
      parts: ['control', 'label', 'description'],
    },
  ] as const)('gives a control with no label no `aria-labelledby`: $name', async (row) => {
    const server = read(
      await renderToString(<LabelableOrder parts={[...row.parts]} labelShown={row.labelShown} />),
    );

    expect(server.labelledBy).toBeUndefined();
    expect(server.describedBy).toBe(server.descriptionId);
  });

  it('keeps the `aria-labelledby` of the consumer', async () => {
    const server = read(
      await renderToString(<LabelableOrder parts={['control', 'label']} ariaLabelledby="other" />),
    );

    expect(server.labelledBy).toBe('other');
  });

  it('describes a labelable control with a message that comes after it', async () => {
    const server = read(await renderToString(<LabelableOrder parts={['input', 'description']} />));

    expect(server.descriptionId).toMatch(/^vase-ui-./);
    expect(server.describedBy).toBe(server.descriptionId);
  });

  it.each([
    { name: 'a control with a provider', provider: true, isDeferred: true },
    { name: 'a control with no provider', provider: false, isDeferred: false },
  ])('defers a control only with a provider: $name', async ({ provider, isDeferred }) => {
    const html = await renderToString(
      <LabelableOrder provider={provider} parts={['control', 'description']} />,
    );

    expect(readIdPrefix(html, 'description')).toMatch(/^vase-ui-./);
    expect(readIdPrefix(html, 'inside') !== readIdPrefix(html, 'description')).toBe(isDeferred);
  });

  it('does not name a control with a label below an async `setup` that comes after it', async () => {
    const html = await renderToString(<LabelableAsyncLabel />);

    expect(readAttribute(html, 'label', 'id')).toMatch(/^vase-ui-./);
    expect(readAttribute(html, 'control', 'aria-labelledby')).toBeUndefined();
  });
});
