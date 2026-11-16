import { describe, expect, it, onTestFinished } from 'vitest';
import { createSSRApp, h, nextTick } from 'vue';
import type { Component } from 'vue';
import { hydrate, renderOnServer, setAttributeInHtml, takeReportedMessages } from '#test-utils';
import ServerAttributesPart from './ServerAttributesPart.test.vue';
import UseRenderElementHydration from './UseRenderElementHydration.test.vue';

const FIXTURE = 'src/internals/UseRenderElementHydration.test.vue';
const PART_FILE = 'src/internals/ServerAttributesPart.test.vue';
const PART = '[data-testid="part"]';

// `hydrate` fails when the hydrated DOM differs from a client-only render. A case that keeps an
// attribute of the server HTML has such a difference, so it hydrates by hand.
async function hydrateByHand(
  component: Component,
  serverHtml: string,
  props: Record<string, unknown>,
) {
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = serverHtml;
  const app = createSSRApp({ render: () => h(component, props) });
  onTestFinished(() => {
    app.unmount();
    container.remove();
  });
  app.mount(container);
  await nextTick();
  await nextTick();
  expect(takeReportedMessages()).toEqual([]);
  return container;
}

describe('useRenderElement: the attributes that Vue does not write while it hydrates', () => {
  describe.each([{ form: 'tag' as const }, { form: 'slot' as const }])(
    'element from the $form',
    ({ form }) => {
      const props = { form, controls: 'panel', abbreviation: 'Mon', label: 'Name', active: true };

      it.each([
        { name: 'an aria attribute of the part', attribute: 'aria-controls', client: 'panel' },
        { name: 'an aria attribute of the consumer', attribute: 'aria-label', client: 'Name' },
        { name: 'the role', attribute: 'role', client: 'group' },
        { name: 'the abbr', attribute: 'abbr', client: 'Mon' },
        { name: 'a state attribute', attribute: 'data-active', client: '' },
      ])('writes the client value of $name', async ({ attribute, client }) => {
        const serverHtml = setAttributeInHtml(
          await renderOnServer(FIXTURE, props),
          PART,
          attribute,
          'server',
        );

        const { container } = await hydrate(UseRenderElementHydration, { serverHtml, props });

        expect(container.querySelector(PART)?.getAttribute(attribute)).toBe(client);
      });

      it.each([
        {
          name: 'an aria attribute whose key has no value',
          attribute: 'aria-controls',
          serverProps: { controls: 'panel' },
        },
        {
          name: 'an abbr whose key has no value',
          attribute: 'abbr',
          serverProps: { abbreviation: 'Mon' },
        },
      ])('removes $name', async ({ attribute, serverProps }) => {
        const serverHtml = await renderOnServer(FIXTURE, { form, ...serverProps });

        const { container } = await hydrate(UseRenderElementHydration, {
          serverHtml,
          props: { form },
        });

        expect(container.querySelector(PART)?.hasAttribute(attribute)).toBe(false);
      });

      it('removes a state attribute whose state is false', async () => {
        const serverHtml = await renderOnServer(FIXTURE, { form, active: true });

        const { container } = await hydrate(UseRenderElementHydration, {
          serverHtml,
          props: { form, active: false },
        });

        expect(container.querySelector(PART)?.hasAttribute('data-active')).toBe(false);
      });

      it.each([
        { name: 'an aria attribute with no key', attribute: 'aria-busy' },
        { name: 'a data attribute with no state', attribute: 'data-extension' },
      ])('keeps $name', async ({ attribute }) => {
        const serverHtml = setAttributeInHtml(
          // A difference that makes the part render again after the mount.
          setAttributeInHtml(await renderOnServer(FIXTURE, props), PART, 'aria-controls', 'server'),
          PART,
          attribute,
          'true',
        );

        const container = await hydrateByHand(UseRenderElementHydration, serverHtml, props);

        const part = container.querySelector(PART);
        expect(part?.getAttribute('aria-controls')).toBe('panel');
        expect(part?.getAttribute(attribute)).toBe('true');
      });

      it('keeps an aria-hidden that a script wrote before the hydration', async () => {
        // The lock of a modal popup writes `aria-hidden` to the elements outside the popup, and a
        // part can hydrate after that.
        const serverHtml = setAttributeInHtml(
          setAttributeInHtml(await renderOnServer(FIXTURE, props), PART, 'aria-controls', 'server'),
          PART,
          'aria-hidden',
          'true',
        );

        const container = await hydrateByHand(UseRenderElementHydration, serverHtml, props);

        const part = container.querySelector(PART);
        expect(part?.getAttribute('aria-controls')).toBe('panel');
        expect(part?.getAttribute('aria-hidden')).toBe('true');
      });
    },
  );

  describe('renders of the part', () => {
    // The props have a string, a number, a Boolean and a state, which the server writes as text.
    async function countRenders(serverControls: string) {
      const props = {
        'data-testid': 'part',
        controls: 'panel',
        'aria-level': 2,
        'aria-expanded': false,
        active: true,
      };
      const serverHtml = setAttributeInHtml(
        await renderOnServer(PART_FILE, props),
        PART,
        'aria-controls',
        serverControls,
      );
      let renders = 0;
      // The part calls `stateClass` one time in each render.
      const stateClass = () => {
        renders += 1;
        return undefined;
      };

      await hydrateByHand(ServerAttributesPart, serverHtml, { ...props, stateClass });

      return renders;
    }

    it('renders one time when each value is equal to the server HTML', async () => {
      expect(await countRenders('panel')).toBe(1);
    });

    it('renders one more time when a value differs from the server HTML', async () => {
      expect(await countRenders('server')).toBe(2);
    });
  });
});
