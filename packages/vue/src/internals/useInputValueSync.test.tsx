import { describe, expect, it, vi } from 'vitest';
import { h, shallowRef } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  hydrate,
  hydrateAfter,
  isVaporApp,
  renderOnServer,
  screen,
} from '#test-utils';
import { recordInputWrites } from '../../test/recordInputWrites';
import InputValueSyncPart from './InputValueSyncPart.test.vue';
import InputValueSyncPartVapor from './InputValueSyncPartVapor.test.vue';
import type { InputValueSync } from './useInputValueSync';

const FIXTURE = 'src/internals/InputValueSyncPart.test.vue';

describe('useInputValueSync', () => {
  const { render } = createRenderer();

  async function mount(value?: string, hidden = false, Part: Component = InputValueSyncPart) {
    const report = vi.fn<(sync: InputValueSync) => void>();
    const check = vi.fn<(changed: boolean) => void>();
    const { setProps } = await render(h(Part, { value, hidden, report, check }));
    const input = screen.getByRole<HTMLInputElement>('textbox');
    return {
      input,
      sync: report.mock.calls[0][0],
      setProps,
      change() {
        input.dispatchEvent(new Event('change'));
        return check.mock.lastCall![0];
      },
    };
  }

  it('writes only when the input has other text', async () => {
    const { input, sync } = await mount('kept');
    input.value = 'refused';
    const assignments = recordInputWrites(input, 'value');

    sync.write();
    sync.write();

    expect(input.value).toBe('kept');
    expect(assignments).toEqual(['kept']);
  });

  it('records the input when the state gives no text', async () => {
    const { input, sync, change } = await mount();
    input.value = 'typed';
    const assignments = recordInputWrites(input, 'value');

    sync.write();

    expect(assignments).toEqual([]);
    expect(change()).toBe(false);
  });

  it('recognizes each value from the last event, write or record', async () => {
    const { input, sync, change } = await mount('state');
    input.value = 'typed';
    expect(change()).toBe(true);
    expect(change()).toBe(false);

    sync.write();
    expect(change()).toBe(false);

    input.value = 'reset';
    sync.record();
    expect(change()).toBe(false);

    sync.recordAs('server');
    input.value = 'server';
    expect(change()).toBe(false);
  });

  it('records the text that the browser kept after a write', async () => {
    const { sync } = await mount('two\nlines');
    sync.write();
    expect(sync.handledValue()).toBe('twolines');
  });

  describe('useHiddenInputValueSync', () => {
    async function checkRenders(Part: Component) {
      const { input, setProps, change } = await mount('first', true, Part);
      expect(input.value).toBe('first');
      expect(change()).toBe(false);

      await setProps({ value: 'second' });

      expect(input.value).toBe('second');
      expect(change()).toBe(false);
      input.value = 'first';
      expect(change()).toBe(true);
    }

    it('records the mount and the next value of the parent', () =>
      checkRenders(InputValueSyncPart));

    it.runIf(isVaporApp)('records both values in a Vapor part', () =>
      checkRenders(InputValueSyncPartVapor),
    );

    it('takes text from before hydration one time', async () => {
      const props = { hidden: true, value: 'server' };
      const serverHtml = await renderOnServer(FIXTURE, props);
      const value = shallowRef(props.value);
      const check = vi.fn((changed: boolean, event: Event) => {
        if (changed) {
          value.value = (event.currentTarget as HTMLInputElement).value;
        }
      });
      const { container } = await hydrateAfter(
        () => h(InputValueSyncPart, { hidden: true, value: value.value, check }),
        {
          serverHtml,
          before(server) {
            server.querySelector('input')!.value = 'typed';
          },
        },
      );

      const input = container.querySelector('input')!;
      expect(input.value).toBe('typed');
      input.dispatchEvent(new Event('change'));
      expect(check.mock.calls.map(([changed, event]) => [event.type, changed])).toEqual([
        ['input', true],
        ['change', false],
      ]);
    });

    it('records sanitized server text once the input accepts writes', async () => {
      const props = { hidden: true, value: 'two\nlines' };
      const serverHtml = await renderOnServer(FIXTURE, props);
      const report = vi.fn<(sync: InputValueSync) => void>();

      const { container } = await hydrate(InputValueSyncPart, {
        serverHtml,
        props: { ...props, report },
      });

      expect(container.querySelector('input')!.value).toBe('twolines');
      expect(report.mock.lastCall![0].handledValue()).toBe('twolines');
    });
  });
});
