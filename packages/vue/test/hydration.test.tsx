import { expect, describe, it } from 'vitest';
import { defineComponent, h, nextTick, onMounted, ref, warn } from 'vue';
import { hydrate, renderOnServer } from '#test-utils';
import ClassedElement from './fixtures/ClassedElement.vue';
import HydrationFixture from './fixtures/HydrationFixture.vue';
import LabelForControl from './fixtures/LabelForControl.vue';
import PlainPart from './fixtures/PlainPart.vue';
import StyledElement from './fixtures/StyledElement.vue';

const FIXTURE = 'test/fixtures/HydrationFixture.vue';
const STYLED_ELEMENT = 'test/fixtures/StyledElement.vue';
const CLASSED_ELEMENT = 'test/fixtures/ClassedElement.vue';
const LABEL_FOR_CONTROL = 'test/fixtures/LabelForControl.vue';

describe('hydrate', () => {
  it('passes for the clean fixture', async () => {
    const serverHtml = await renderOnServer(FIXTURE);

    await hydrate(HydrationFixture, { serverHtml });
  });

  it('passes for a label that names a control with `for`', async () => {
    const serverHtml = await renderOnServer(LABEL_FOR_CONTROL);

    const { container } = await hydrate(LabelForControl, { serverHtml });

    // The control finds the label in the document after the mount.
    const label = container.querySelector('label')!;
    expect(label.id).not.toBe('');
    expect(container.querySelector('[role="checkbox"]')).toHaveAttribute(
      'aria-labelledby',
      label.id,
    );
  });

  it('fails for a seeded text mismatch', async () => {
    const serverHtml = await renderOnServer(FIXTURE);

    await expect(
      hydrate(HydrationFixture, { serverHtml: serverHtml.replace('>Press<', '>Prsss<') }),
    ).rejects.toThrow(/Hydration text mismatch/);
  });

  it('fails for a second seeded text mismatch', async () => {
    const serverHtml = await renderOnServer(FIXTURE);

    // The label has one text child, so Vue words this message another way.
    // This case shows that the first failure did not stop the warnings of Vue.
    await expect(
      hydrate(HydrationFixture, { serverHtml: serverHtml.replace('>Name<', '>Nome<') }),
    ).rejects.toThrow(/Hydration text content mismatch/);
  });

  it('fails for a seeded id mismatch', async () => {
    const serverHtml = await renderOnServer(FIXTURE);

    await expect(
      hydrate(HydrationFixture, {
        serverHtml: serverHtml.replace(/(<input[^>]* id=")[^"]*"/, '$1other"'),
      }),
    ).rejects.toThrow(/Hydration attribute mismatch/);
  });

  it('fails with the DOM difference only for a seeded aria-pressed mismatch on the part', async () => {
    const serverHtml = await renderOnServer(FIXTURE);

    // Vue does not compare `aria-*`, and it does not patch an attribute of a `v-bind` object.
    const error = await hydrate(HydrationFixture, {
      serverHtml: serverHtml.replace('aria-pressed="false"', 'aria-pressed="true"'),
    }).catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/The hydrated DOM differs from a client-only render/);
    expect((error as Error).message).not.toMatch(/Vue and the console reported/);
  });

  it('fails with the DOM difference only for a server render with another state', async () => {
    const serverHtml = await renderOnServer('test/fixtures/PlainPart.vue', { active: true });

    // Vue does not compare `data-*`.
    const error = await hydrate(PlainPart, { serverHtml, props: { active: false } }).catch(
      (caught: Error) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/The hydrated DOM differs from a client-only render/);
    expect((error as Error).message).not.toMatch(/Vue and the console reported/);
  });

  it.each([
    {
      name: 'a style that a browser writes in another format',
      elementStyle: {
        border: 0,
        lineHeight: 1.5,
        '--x': '1px',
        margin: '0 auto',
        color: 'red !important',
      },
      serverText: 'border:0;',
    },
    { name: 'an empty style object', elementStyle: {}, serverText: 'style=""' },
  ])('passes for $name', async ({ elementStyle, serverText }) => {
    const serverHtml = await renderOnServer(STYLED_ELEMENT, { elementStyle });

    // The case tests the helper only while the server HTML has this text.
    // When Vue changes its format, this assertion fails.
    expect(serverHtml).toContain(serverText);
    await hydrate(StyledElement, { serverHtml, props: { elementStyle } });
  });

  it('passes for a root element with an undefined class', async () => {
    const serverHtml = await renderOnServer(CLASSED_ELEMENT);

    // The case tests the helper only while the server HTML has no `class`.
    // When Vue changes its format, this assertion fails.
    expect(serverHtml).toBe('<div></div>');
    await hydrate(ClassedElement, { serverHtml });
  });

  it.each([
    {
      name: 'another value of a style property',
      serverStyle: { border: 0, lineHeight: 2 },
      clientStyle: { border: 0, lineHeight: 1.5 },
    },
    {
      name: 'a style property that only the server HTML has',
      serverStyle: { border: 0, lineHeight: 1.5 },
      clientStyle: { border: 0 },
    },
  ])('fails with the DOM difference only for $name', async ({ serverStyle, clientStyle }) => {
    const serverHtml = await renderOnServer(STYLED_ELEMENT, { elementStyle: serverStyle });

    // Vue does not patch `style`, and `data-allow-mismatch` stops its warning.
    const error = await hydrate(StyledElement, {
      serverHtml,
      props: { elementStyle: clientStyle },
    }).catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/The hydrated DOM differs from a client-only render/);
    expect((error as Error).message).not.toMatch(/Vue and the console reported/);
  });

  it('fails for an empty container', async () => {
    // Vue writes this message to `console.warn` only.
    await expect(hydrate(HydrationFixture, { serverHtml: '' })).rejects.toThrow(
      /container is empty/,
    );
  });

  it('fails for a warning that comes in the flush after the mount', async () => {
    const LateWarning = defineComponent({
      setup() {
        const late = ref(false);
        onMounted(async () => {
          await nextTick();
          late.value = true;
        });
        return () => {
          if (late.value) {
            warn('warning raised in the flush after mount');
          }
          return h('i');
        };
      },
    });

    await expect(hydrate(LateWarning, { serverHtml: '<i></i>' })).rejects.toThrow(
      /warning raised in the flush after mount/,
    );
  });

  it('passes for a state that a part writes after two ticks of its own', async () => {
    // The helper waits two ticks after each mount. With fewer ticks, it compares the client-only
    // render before that render shows the last state.
    const LateState = defineComponent({
      setup() {
        const text = ref('first');
        onMounted(async () => {
          await nextTick();
          await nextTick();
          text.value = 'last';
        });
        return () => h('i', text.value);
      },
    });

    const { container } = await hydrate(LateState, { serverHtml: '<i>first</i>' });

    expect(container.textContent).toBe('last');
  });

  it('runs the inline script of the server HTML', async () => {
    const globals = globalThis as { vaseUiHydrationScriptRuns?: number };
    const runsBefore = globals.vaseUiHydrationScriptRuns ?? 0;
    const serverHtml = await renderOnServer(FIXTURE);

    await hydrate(HydrationFixture, { serverHtml });

    // One run in the client-only render, and one run when the helper inserts the server HTML.
    expect(globals.vaseUiHydrationScriptRuns).toBe(runsBefore + 2);
  });

  it('passes for the clean fixture again', async () => {
    const serverHtml = await renderOnServer(FIXTURE);

    await hydrate(HydrationFixture, { serverHtml });
  });
});

describe('after a hydration', () => {
  it('removes the containers when the test ends', async ({ onTestFinished }) => {
    const hydrated: { container?: HTMLElement } = {};

    // The hooks of `onTestFinished` run in reverse order, so this hook runs after the hooks of
    // `hydrate`.
    onTestFinished(() => {
      expect(hydrated.container?.isConnected).toBe(false);
    });

    const serverHtml = await renderOnServer(FIXTURE);
    const { container } = await hydrate(HydrationFixture, { serverHtml });
    hydrated.container = container;

    expect(container.isConnected).toBe(true);
  });
});
