import type { Ref } from 'vue';
import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  hydrateAfter,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import { useIsHydrated, useIsHydrating } from './hydration';
import ServerElementProbe from './ServerElementProbe.test.vue';
import ValueBeforeHydrationProbe from './ValueBeforeHydrationProbe.test.vue';

const PROBE = 'src/common/ValueBeforeHydrationProbe.test.vue';
const SERVER_ELEMENT_PROBE = 'src/common/ServerElementProbe.test.vue';

function createProbe(hook: () => Readonly<Ref<boolean>>, testId: string) {
  return defineComponent(() => {
    const value = hook();
    return () => <span data-testid={testId}>{value.value ? 'yes' : 'no'}</span>;
  });
}

interface ProbeProps {
  as?: string;
  type?: string;
  value?: string;
  refuses?: boolean;
  callsTwice?: boolean;
  rendersComponent?: boolean;
}

// Inserts the server HTML of the probe, lets `before` act on the control, and hydrates.
async function hydrateProbe(
  props: ProbeProps,
  before: (control: HTMLInputElement, container: HTMLElement) => void,
  editServerHtml: (html: string) => string = (html) => html,
) {
  const serverHtml = editServerHtml(await renderOnServer(PROBE, { ...props }));
  const { container } = await hydrateAfter(ValueBeforeHydrationProbe, {
    serverHtml,
    props: { ...props },
    before(serverContainer) {
      before(within(serverContainer).getByTestId<HTMLInputElement>('control'), serverContainer);
    },
  });
  const probe = within(container);
  return {
    control: probe.getByTestId<HTMLInputElement>('control'),
    model: probe.getByTestId('model'),
    events: probe.getByTestId('events'),
  };
}

describe('hydration', () => {
  const { render } = createRenderer();

  describe('useIsHydrated', () => {
    const Probe = createProbe(useIsHydrated, 'hydrated');

    it('reports hydrated once mounted on the client', async () => {
      await render(<Probe />);

      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes');
    });
  });

  describe('useIsHydrating', () => {
    const Probe = createProbe(useIsHydrating, 'hydrating');

    it('does not report hydrating for a client-only mount', async () => {
      await render(<Probe />);

      expect(screen.getByTestId('hydrating')).toHaveTextContent('no');
    });
  });

  describe('getServerElement', () => {
    it.each([
      { form: 'element' as const, expected: 'own' },
      { form: 'fragment' as const, expected: 'own' },
      // The walk stops at the end of the fragment of the part, before the element of the next part.
      { form: 'empty fragment' as const, expected: null },
      { form: 'no element' as const, expected: null },
    ])('gives $expected for a part that renders $form', async ({ form, expected }) => {
      const serverHtml = await renderOnServer(SERVER_ELEMENT_PROBE, { form });
      const elements: (string | null)[] = [];

      // The helper renders the probe on the client first, and then hydrates it. A client-only
      // mount has no server element.
      await hydrate(ServerElementProbe, {
        serverHtml,
        props: { form, onRead: (testId: string | null) => elements.push(testId) },
      });

      expect(elements).toEqual([null, expected]);
    });
  });

  describe('VUE-74: useValueBeforeHydration', () => {
    it('keeps the text that the user typed and sends one input event', async () => {
      const { control, model, events } = await hydrateProbe({ value: 'a' }, (input) => {
        input.focus();
        input.value = 'ab';
      });
      await flushMicrotasks();

      expect(control).toHaveValue('ab');
      expect(model.textContent).toBe('ab');
      // The handler reads `false` for the event of the take.
      expect(events.textContent).toBe('input of the take');
    });

    it.each([
      { name: 'a text with a line break', props: { value: 'a\nb' } },
      { name: 'an email with spaces', props: { type: 'email', value: ' a@b.c ' } },
      { name: 'a color with no value', props: { type: 'color' } },
      { name: 'a range with no value', props: { type: 'range' } },
      {
        name: 'a textarea with a CRLF',
        props: { as: 'textarea', value: 'a\r\nb' },
        // Vue writes a CRLF as it is, and the parser of the browser changes it into a LF. Vue 3.5.12
        // then also reports a mismatch for the text of the model.
        editServerHtml: (html: string) => html.replaceAll('\r\n', '&#13;&#10;'),
      },
    ])('sends no event for $name that nobody changed', async ({ props, editServerHtml }) => {
      const { events } = await hydrateProbe(props, () => {}, editServerHtml);
      await flushMicrotasks();

      expect(events.textContent).toBe('');
    });

    it.each([
      { name: 'a number', props: { type: 'number', value: '1' }, changed: '12' },
      { name: 'a range', props: { type: 'range', value: '10' }, changed: '11' },
      { name: 'a textarea', props: { as: 'textarea', value: 'a' }, changed: 'ab' },
    ])('keeps a change of $name', async ({ props, changed }) => {
      const { control, model, events } = await hydrateProbe(props, (input) => {
        input.focus();
        input.value = changed;
      });
      await flushMicrotasks();

      expect(control).toHaveValue(props.type === 'number' ? Number(changed) : changed);
      expect(model.textContent).toBe(changed);
      expect(events.textContent).toBe('input of the take');
    });

    it('writes the value at once and sends no event in a client-only mount', async () => {
      await render(<ValueBeforeHydrationProbe value="a" />);
      await flushMicrotasks();

      expect(screen.getByTestId('control')).toHaveValue('a');
      expect(screen.getByTestId('events').textContent).toBe('');
    });

    it('writes the value of a model that refuses the text', async () => {
      const { control, model, events } = await hydrateProbe(
        { value: 'a', refuses: true },
        (input) => {
          input.focus();
          input.value = 'ab';
        },
      );
      await flushMicrotasks();

      expect(control).toHaveValue('a');
      expect(model.textContent).toBe('a');
      expect(events.textContent).toBe('input of the take');
    });

    it('gives the value to a component in `as` that declares it', async () => {
      const props = { value: 'a', rendersComponent: true };
      const serverHtml = await renderOnServer(PROBE, props);

      const { container } = await hydrate(ValueBeforeHydrationProbe, { serverHtml, props });

      const valueText = within(container).getByTestId('control');
      expect(valueText.localName).toBe('output');
      expect(valueText.textContent).toBe('a');
    });

    it.each([
      { name: 'no element', focusOutside: false, relatedTarget: 'null' },
      { name: 'a button', focusOutside: true, relatedTarget: 'button' },
    ])(
      'sends change, blur and focusout after the flush, with the focus on $name',
      async ({ focusOutside, relatedTarget }) => {
        const { events } = await hydrateProbe({ value: 'a' }, (input, container) => {
          input.value = 'ab';
          if (focusOutside) {
            within(container).getByTestId('outside').focus();
          }
        });
        await waitFor(() => expect(events).toHaveTextContent('focusout'));
        await flushMicrotasks();

        // The model text in each focus event shows the render of the `input` event.
        expect(events.textContent).toBe(
          `input of the take; change; blur to ${relatedTarget}, model ab; focusout to ${relatedTarget}, model ab`,
        );
      },
    );

    it('sends the events one time for two calls on one element', async () => {
      const { control, events } = await hydrateProbe({ value: 'a', callsTwice: true }, (input) => {
        input.value = 'ab';
      });
      await waitFor(() => expect(events).toHaveTextContent('focusout'));
      await flushMicrotasks();

      expect(control).toHaveValue('ab');
      expect(events.textContent).toBe(
        'input of the take; change; blur to null, model ab; focusout to null, model ab',
      );
    });
  });
});
