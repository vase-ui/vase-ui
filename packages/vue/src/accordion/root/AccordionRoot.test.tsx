import { expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { Component } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  heldMountListTests,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import AccordionRootHydration from './AccordionRootHydration.test.vue';
import AccordionRootList from './AccordionRootList.test.vue';
import AccordionRootPanelFirst from './AccordionRootPanelFirst.test.vue';

const HYDRATION_FIXTURE = 'src/accordion/root/AccordionRootHydration.test.vue';
const PANEL_FIRST_FIXTURE = 'src/accordion/root/AccordionRootPanelFirst.test.vue';

const PANEL_CONTENT_1 = 'Panel contents 1';
const PANEL_CONTENT_2 = 'Panel contents 2';

/** The text and the `data-index` of each trigger, in the order of the document. */
function readTriggers(root: ParentNode) {
  return [...root.querySelectorAll('button')].map(
    (trigger) => `${trigger.textContent}:${trigger.getAttribute('data-index')}`,
  );
}

/** The ids of the first trigger and of its panel, and the attributes that name them. */
function readAssociation(root: ParentNode) {
  const trigger = root.querySelector('button')!;
  const panel = root.querySelector('[role="region"]')!;
  return {
    triggerId: trigger.getAttribute('id'),
    controls: trigger.getAttribute('aria-controls'),
    panelId: panel.getAttribute('id'),
    labelledBy: panel.getAttribute('aria-labelledby'),
  };
}

/**
 * What `aria-controls` of the first trigger and `aria-labelledby` of its panel name, in words, and
 * whether the panel is hidden. A test does not write a generated id.
 */
function readNames(root: ParentNode) {
  const { triggerId, controls, panelId, labelledBy } = readAssociation(root);
  const panel = root.querySelector('[role="region"]')!;
  const name = (id: string | null) => {
    if (id === null) {
      return 'nothing';
    }
    if (!id.startsWith('vase-ui-')) {
      return id;
    }
    if (id === triggerId) {
      return 'the generated trigger id';
    }
    return id === panelId ? 'the generated panel id' : 'another generated id';
  };

  return {
    controls: name(controls),
    labelledBy: name(labelledBy),
    hidden: panel.hasAttribute('hidden'),
  };
}

describe('<Accordion.Root />', () => {
  const { render } = createRenderer();

  heldMountListTests({
    render,
    renderList: (withLastItem) => (
      <Accordion.Root>
        <Accordion.Item value="a" data-testid="item-a" />
        {withLastItem ? <Accordion.Item value="b" data-testid="item-b" /> : null}
      </Accordion.Root>
    ),
    check() {
      expect(screen.getByTestId('item-a')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('item-b')).toHaveAttribute('data-index', '1');
    },
  });

  describeConformance(<Accordion.Root />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('warns when hiddenUntilFound overrides keepMounted={false}', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <Accordion.Root hiddenUntilFound keepMounted={false}>
          <Accordion.Item>
            <Accordion.Panel>Panel</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        'Vase UI: The `keepMounted` prop of `Accordion.Root` is `false` and `hiddenUntilFound` is enabled. The panels must stay mounted while they are closed, so `keepMounted` has no effect. Remove `keepMounted`, or remove `hiddenUntilFound`.',
      );
      expect(screen.getByText('Panel').getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('ARIA attributes', () => {
    it('renders correct ARIA attributes', async () => {
      await render(
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');
      const panel = screen.queryByText(PANEL_CONTENT_1) as HTMLElement;

      expect(trigger).toHaveAttribute('aria-controls');
      expect(panel.getAttribute('id')).toBe(trigger.getAttribute('aria-controls'));
      expect(panel).toHaveAttribute('role', 'region');
      expect(trigger.getAttribute('id')).toBe(panel.getAttribute('aria-labelledby'));
    });

    it('references manual panel id in trigger aria-controls', async () => {
      await render(
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel id="custom-panel-id">{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');
      const panel = screen.queryByText(PANEL_CONTENT_1) as HTMLElement;

      expect(trigger).toHaveAttribute('aria-controls', 'custom-panel-id');
      expect(panel).toHaveAttribute('id', 'custom-panel-id');
    });

    it('references manual trigger id in panel aria-labelledby', async () => {
      await render(
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger id="custom-trigger-id">Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const panel = screen.getByText(PANEL_CONTENT_1);

      expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id');
    });

    it('updates panel labeling when a manual trigger id is added or changed', async () => {
      const App = defineComponent(() => {
        const triggerId = shallowRef<string | undefined>();

        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                triggerId.value = 'custom-trigger-id-1';
              }}
            >
              Set id 1
            </button>
            <button
              type="button"
              onClick={() => {
                triggerId.value = 'custom-trigger-id-2';
              }}
            >
              Set id 2
            </button>
            <Accordion.Root defaultValue={[0]}>
              <Accordion.Item value={0}>
                <Accordion.Header>
                  <Accordion.Trigger id={triggerId.value}>Trigger 1</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
              </Accordion.Item>
            </Accordion.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Trigger 1' });
      const panel = screen.getByText(PANEL_CONTENT_1);

      expect(trigger).toHaveAttribute('id');
      expect(panel).toHaveAttribute('aria-labelledby', trigger.id);

      await user.click(screen.getByRole('button', { name: 'Set id 1' }));

      await waitFor(() => {
        expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id-1');
      });
      expect(trigger).toHaveAttribute('id', 'custom-trigger-id-1');

      await user.click(screen.getByRole('button', { name: 'Set id 2' }));

      await waitFor(() => {
        expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id-2');
      });
      expect(trigger).toHaveAttribute('id', 'custom-trigger-id-2');
    });

    it('restores panel labeling when a manual trigger id is removed', async () => {
      const App = defineComponent(() => {
        const triggerId = shallowRef<string | undefined>('custom-trigger-id');

        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                triggerId.value = undefined;
              }}
            >
              Remove id
            </button>
            <Accordion.Root defaultValue={[0]}>
              <Accordion.Item value={0}>
                <Accordion.Header>
                  <Accordion.Trigger id={triggerId.value}>Trigger 1</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
              </Accordion.Item>
            </Accordion.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Trigger 1' });
      const panel = screen.getByText(PANEL_CONTENT_1);

      expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id');

      await user.click(screen.getByRole('button', { name: 'Remove id' }));

      await waitFor(() => {
        expect(panel.getAttribute('aria-labelledby')).toMatch(/^vase-ui-/);
      });
      expect(trigger).toHaveAttribute('id', panel.getAttribute('aria-labelledby'));
    });

    it('unregisters generated part ids when the trigger or panel unmounts', async () => {
      function App({ parts }: { parts: 'both' | 'trigger' | 'panel' }) {
        return (
          <Accordion.Root defaultValue={[0]}>
            <Accordion.Item value={0}>
              <Accordion.Header>
                {parts !== 'panel' && <Accordion.Trigger>Trigger 1</Accordion.Trigger>}
              </Accordion.Header>
              {parts !== 'trigger' && <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>}
            </Accordion.Item>
          </Accordion.Root>
        );
      }

      const { rerender } = await render(<App parts="both" />);

      await rerender(<App parts="panel" />);
      expect(screen.getByText(PANEL_CONTENT_1)).not.toHaveAttribute('aria-labelledby');

      await rerender(<App parts="both" />);
      let trigger = screen.getByRole('button', { name: 'Trigger 1' });
      let panel = screen.getByText(PANEL_CONTENT_1);
      expect(panel).toHaveAttribute('aria-labelledby', trigger.id);

      await rerender(<App parts="trigger" />);
      expect(screen.getByRole('button', { name: 'Trigger 1' })).not.toHaveAttribute(
        'aria-controls',
      );

      await rerender(<App parts="both" />);
      trigger = screen.getByRole('button', { name: 'Trigger 1' });
      panel = screen.getByText(PANEL_CONTENT_1);
      expect(trigger).toHaveAttribute('aria-controls', panel.id);
    });

    it.skipIf(isJSDOM)('preserves generated part associations during hydration', async () => {
      const props = { defaultValue: [0] };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      // The parse in a `<template>` element has no side effect.
      const server = document.createElement('template');
      server.innerHTML = serverHtml;
      const serverIds = readAssociation(server.content);
      expect(serverIds.triggerId).toMatch(/^vase-ui-/);
      expect(serverIds.panelId).toMatch(/^vase-ui-/);
      expect(serverIds.controls).toBe(serverIds.panelId);
      expect(serverIds.labelledBy).toBe(serverIds.triggerId);

      const { container } = await hydrate(AccordionRootHydration, { serverHtml, props });

      expect(readAssociation(container)).toEqual(serverIds);
    });
  });

  describe('uncontrolled', () => {
    it.skipIf(isJSDOM)('open state', async () => {
      const { user } = await render(
        <Accordion.Root>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
    });

    describe('prop: defaultValue', () => {
      it('custom item value', async () => {
        await render(
          <Accordion.Root defaultValue={['first']}>
            <Accordion.Item value="first">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="second">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );

        expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
        expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

        expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);
      });
    });
  });

  describe('controlled', () => {
    it.skipIf(isJSDOM)('open state', async () => {
      const { setProps } = await render(
        <Accordion.Root value={[]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);

      await setProps({ value: [0] });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

      await setProps({ value: [] });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
    });

    describe('prop: value', () => {
      it('custom item value', async () => {
        await render(
          <Accordion.Root value={['one']}>
            <Accordion.Item value="one">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="second">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );

        expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
        expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

        expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);
      });

      it('VUE-114: reads a null value as an empty value, and stays controlled', async () => {
        const handleValueChange = vi.fn();
        await render(
          <Accordion.Root value={null} defaultValue={['b']} onValueChange={handleValueChange}>
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="b">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );
        const [trigger1, trigger2] = screen.getAllByRole('button');
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(trigger2).toHaveAttribute('aria-expanded', 'false');

        await fireEvent.click(trigger1);

        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      });

      it('VUE-114: reads a value that changes to null as an empty value, not as the default value', async () => {
        const { setProps } = await render(
          <Accordion.Root value={['a']} defaultValue={['b']}>
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="b">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );
        const [trigger1, trigger2] = screen.getAllByRole('button');
        expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        expect(trigger2).toHaveAttribute('aria-expanded', 'false');

        await setProps({ value: null });

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(trigger2).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('prop: disabled', () => {
    it('can disable the whole accordion', async () => {
      await render(
        <Accordion.Root defaultValue={[0]} disabled>
          <Accordion.Item data-testid="item1" value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item data-testid="item2" value={1}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const item1 = screen.getByTestId('item1');
      const panel1 = screen.queryByText(PANEL_CONTENT_1);
      const [header1, header2] = screen.getAllByRole('heading');
      const [trigger1, trigger2] = screen.getAllByRole('button');
      const item2 = screen.getByTestId('item2');

      [item1, header1, trigger1, panel1, item2, header2, trigger2].forEach((element) => {
        expect(element).toHaveAttribute('data-disabled');
      });
    });

    it('can disable one accordion item', async () => {
      await render(
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item data-testid="item1" value={0} disabled>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item data-testid="item2" value={1}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const item1 = screen.getByTestId('item1');
      const panel1 = screen.queryByText(PANEL_CONTENT_1);
      const [header1, header2] = screen.getAllByRole('heading');
      const [trigger1, trigger2] = screen.getAllByRole('button');
      const item2 = screen.getByTestId('item2');

      [item1, header1, trigger1, panel1].forEach((element) => {
        expect(element).toHaveAttribute('data-disabled');
      });
      [item2, header2, trigger2].forEach((element) => {
        expect(element).not.toHaveAttribute('data-disabled');
      });
    });

    it.each(['root', 'item'] as const)(
      'does not toggle or fire callbacks when the %s is disabled',
      async (disabledPart) => {
        const onValueChange = vi.fn();
        const onOpenChange = vi.fn();

        const { user } = await render(
          <Accordion.Root disabled={disabledPart === 'root'} onValueChange={onValueChange}>
            <Accordion.Item
              value={0}
              disabled={disabledPart === 'item'}
              onOpenChange={onOpenChange}
            >
              <Accordion.Header>
                <Accordion.Trigger disabled={false}>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value={1} onOpenChange={onOpenChange}>
              <Accordion.Header>
                <Accordion.Trigger disabled={false}>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );

        const [trigger1] = screen.getAllByRole('button');

        await user.pointer({ keys: '[MouseLeft]', target: trigger1 });
        trigger1.focus();
        await user.keyboard('[Space]');
        await user.keyboard('[Enter]');

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
        expect(onValueChange.mock.calls.length).toBe(0);
        expect(onOpenChange.mock.calls.length).toBe(0);
      },
    );
  });

  it('allows onMouseUp to call preventVaseUIHandler on the trigger', async () => {
    await render(
      <Accordion.Root>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger onMouseup={(event) => event.preventVaseUIHandler()}>
              Trigger 1
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger 1' });

    await fireEvent.mouseUp(trigger);
  });

  describe.skipIf(isJSDOM)('keyboard interactions', () => {
    it.each([
      { triggerKind: 'interactive', isNativeButton: true, key: 'Enter' },
      { triggerKind: 'interactive', isNativeButton: true, key: 'Space' },
      { triggerKind: 'non-interactive', isNativeButton: false, key: 'Enter' },
      { triggerKind: 'non-interactive', isNativeButton: false, key: 'Space' },
    ])(
      'key: $key toggles the Accordion open state with $triggerKind triggers',
      async ({ isNativeButton, key }) => {
        const { user } = await render(
          <Accordion.Root>
            <Accordion.Item>
              <Accordion.Header>
                <Accordion.Trigger
                  nativeButton={isNativeButton}
                  as={isNativeButton ? undefined : 'span'}
                >
                  Trigger 1
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );

        const trigger = screen.getByRole('button');

        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        await user.keyboard(`[${key}]`);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('data-panel-open');
        expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

        await user.keyboard(`[${key}]`);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      },
    );
  });

  describe('keyboard activation timing', () => {
    it.each([
      { triggerKind: 'interactive', isNativeButton: true },
      { triggerKind: 'non-interactive', isNativeButton: false },
    ])(
      'opens and closes on Space keyup when rendering $triggerKind triggers',
      async ({ isNativeButton }) => {
        const onOpenChange = vi.fn();

        const { user } = await render(
          <Accordion.Root>
            <Accordion.Item onOpenChange={onOpenChange}>
              <Accordion.Header>
                <Accordion.Trigger
                  nativeButton={isNativeButton}
                  as={isNativeButton ? undefined : 'span'}
                >
                  Trigger 1
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );

        const trigger = screen.getByRole('button');

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();

        await user.keyboard('[Space>]');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT_1)).not.toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();

        await user.keyboard('[/Space]');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText(PANEL_CONTENT_1)).toBeInTheDocument();
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());

        await user.keyboard('[Space>]');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText(PANEL_CONTENT_1)).toBeInTheDocument();
        expect(onOpenChange).toHaveBeenCalledTimes(1);

        await user.keyboard('[/Space]');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT_1)).not.toBeInTheDocument();
        expect(onOpenChange).toHaveBeenCalledTimes(2);
        expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
      },
    );
  });

  describe('VaseUIChangeEventDetails', () => {
    it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
      const onValueChange = vi.fn();

      await render(
        <Accordion.Root onValueChange={onValueChange}>
          <Accordion.Item
            value={0}
            onOpenChange={(nextOpen, eventDetails) => {
              if (nextOpen) {
                eventDetails.cancel();
              }
            }}
          >
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(0);
    });

    it('onValueChange cancel() prevents opening while uncontrolled', async () => {
      const onValueChange = vi.fn((_value, eventDetails) => {
        eventDetails.cancel();
      });

      await render(
        <Accordion.Root onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(1);
    });

    it('onValueChange cancel() prevents closing while uncontrolled', async () => {
      const onValueChange = vi.fn((_value, eventDetails) => {
        eventDetails.cancel();
      });

      await render(
        <Accordion.Root defaultValue={[0]} onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');
      expect(onValueChange).toHaveBeenCalledOnce();
      expect(onValueChange.mock.lastCall?.[0]).toEqual([]);
    });

    it('onOpenChange cancel() prevents onValueChange while controlled', async () => {
      const onValueChange = vi.fn();

      await render(
        <Accordion.Root value={[]} onValueChange={onValueChange}>
          <Accordion.Item
            value={0}
            onOpenChange={(nextOpen, eventDetails) => {
              if (nextOpen) {
                eventDetails.cancel();
              }
            }}
          >
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(0);
    });

    it('onValueChange cancel() prevents opening while controlled', async () => {
      const onValueChange = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<number[]>([]);

        return () => (
          <Accordion.Root
            value={value.value}
            onValueChange={(nextValue, eventDetails) => {
              onValueChange(nextValue, eventDetails);
              eventDetails.cancel();
              if (!eventDetails.isCanceled) {
                value.value = nextValue;
              }
            }}
          >
            <Accordion.Item value={0}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        );
      });

      await render(<App />);

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(1);
    });

    it('onValueChange cancel() prevents opening while multiple', async () => {
      const onValueChange = vi.fn((_value, eventDetails) => {
        eventDetails.cancel();
      });

      await render(
        <Accordion.Root multiple onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(1);
    });

    it('onValueChange cancel() prevents closing while multiple', async () => {
      const onValueChange = vi.fn((_value, eventDetails) => {
        eventDetails.cancel();
      });

      await render(
        <Accordion.Root defaultValue={[0]} multiple onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
      expect(onValueChange.mock.calls.length).toBe(1);
    });

    it('keeps an array item value intact while multiple', async () => {
      const itemValue = ['section', 'details'];
      const onValueChange = vi.fn();

      await render(
        <Accordion.Root multiple onValueChange={onValueChange}>
          <Accordion.Item value={itemValue}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(onValueChange.mock.calls[0][0]).toEqual([itemValue]);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('prop: multiple', () => {
    it('multiple items can be open when `multiple = true`', async () => {
      const { user } = await render(
        <Accordion.Root multiple>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(trigger1).not.toHaveAttribute('data-panel-open');
      expect(trigger2).not.toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);

      await user.pointer({ keys: '[MouseLeft]', target: trigger1 });
      await user.pointer({ keys: '[MouseLeft]', target: trigger2 });

      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');
      expect(screen.queryByText(PANEL_CONTENT_2)).toHaveAttribute('data-open');
      expect(trigger1).toHaveAttribute('data-panel-open');
      expect(trigger2).toHaveAttribute('data-panel-open');

      await user.pointer({ keys: '[MouseLeft]', target: trigger1 });

      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(screen.getByText(PANEL_CONTENT_2)).toHaveAttribute('data-open');
      expect(trigger1).not.toHaveAttribute('data-panel-open');
      expect(trigger2).toHaveAttribute('data-panel-open');
    });

    it('when false only one item can be open', async () => {
      const { user } = await render(
        <Accordion.Root multiple={false}>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);
      expect(trigger1).not.toHaveAttribute('data-panel-open');
      expect(trigger2).not.toHaveAttribute('data-panel-open');

      await user.pointer({ keys: '[MouseLeft]', target: trigger1 });

      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');
      expect(trigger1).toHaveAttribute('data-panel-open');

      await user.pointer({ keys: '[MouseLeft]', target: trigger2 });

      expect(screen.queryByText(PANEL_CONTENT_2)).toHaveAttribute('data-open');
      expect(trigger2).toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(trigger1).not.toHaveAttribute('data-panel-open');
    });
  });

  describe.skipIf(isJSDOM)('prop: onValueChange', () => {
    it('default item value', async () => {
      const onValueChange = vi.fn();

      const { user } = await render(
        <Accordion.Root onValueChange={onValueChange} multiple>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>1</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value={1}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>2</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await user.pointer({ keys: '[MouseLeft]', target: trigger1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toEqual([0]);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerPress);
      expect(onValueChange.mock.lastCall?.[1].event.type).not.toBe('vase-ui');

      trigger2.focus();
      await user.keyboard('[Space]');

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.lastCall?.[0]).toEqual([0, 1]);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerPress);
      expect(onValueChange.mock.lastCall?.[1].event.type).not.toBe('vase-ui');
    });

    it('custom item value', async () => {
      const onValueChange = vi.fn();

      const { user } = await render(
        <Accordion.Root onValueChange={onValueChange} multiple>
          <Accordion.Item value="one">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>1</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="two">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>2</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await user.pointer({ keys: '[MouseLeft]', target: trigger2 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['two']);

      await user.pointer({ keys: '[MouseLeft]', target: trigger1 });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two', 'one']);
    });

    it('`multiple` is false', async () => {
      const onValueChange = vi.fn();

      const { user } = await render(
        <Accordion.Root onValueChange={onValueChange} multiple={false}>
          <Accordion.Item value="one">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>1</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="two">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>2</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await user.pointer({ keys: '[MouseLeft]', target: trigger1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

      await user.pointer({ keys: '[MouseLeft]', target: trigger2 });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
    });
  });

  describe('v-model:value', () => {
    /**
     * An accordion with the items `a` and `b` and a parent that holds the value. `log` gets one
     * line for each emit.
     */
    async function renderModel(options: {
      multiple?: boolean;
      cancel?: 'openChange' | 'valueChange';
    }) {
      const log: string[] = [];
      const App = defineComponent(() => {
        const value = shallowRef<string[]>([]);

        return () => (
          <Accordion.Root
            multiple={options.multiple}
            value={value.value}
            onValueChange={(nextValue, eventDetails) => {
              log.push(`valueChange ${nextValue.join()}`);
              if (options.cancel === 'valueChange') {
                eventDetails.cancel();
              }
            }}
            onUpdate:value={(nextValue) => {
              log.push(`update:value ${nextValue.join()}`);
              value.value = nextValue;
            }}
          >
            {['a', 'b'].map((itemValue) => (
              <Accordion.Item
                key={itemValue}
                value={itemValue}
                onOpenChange={(open, eventDetails) => {
                  log.push(`openChange ${itemValue} ${open}`);
                  if (options.cancel === 'openChange') {
                    eventDetails.cancel();
                  }
                }}
              >
                <Accordion.Header>
                  <Accordion.Trigger>{itemValue}</Accordion.Trigger>
                </Accordion.Header>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        );
      });

      await render(<App />);
      const [triggerA, triggerB] = screen.getAllByRole('button');

      return { log, triggerA, triggerB };
    }

    it('emits openChange, then valueChange, then update:value', async () => {
      const { log, triggerA } = await renderModel({});

      await fireEvent.click(triggerA);

      expect(log).toEqual(['openChange a true', 'valueChange a', 'update:value a']);
      expect(triggerA).toHaveAttribute('aria-expanded', 'true');
      expect(triggerA).toHaveAttribute('data-panel-open');
    });

    it('does not emit update:value when a listener cancels valueChange', async () => {
      const { log, triggerA } = await renderModel({ cancel: 'valueChange' });

      await fireEvent.click(triggerA);

      expect(log).toEqual(['openChange a true', 'valueChange a']);
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not emit valueChange when a listener cancels openChange', async () => {
      const { log, triggerA } = await renderModel({ cancel: 'openChange' });

      await fireEvent.click(triggerA);

      expect(log).toEqual(['openChange a true']);
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
    });

    it('holds one value when multiple is false', async () => {
      const { log, triggerA, triggerB } = await renderModel({});

      await fireEvent.click(triggerA);
      await fireEvent.click(triggerB);

      expect(log.at(-1)).toBe('update:value b');
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
      expect(triggerB).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(triggerB);

      expect(log.at(-1)).toBe('update:value ');
      expect(triggerB).toHaveAttribute('aria-expanded', 'false');
    });

    it('adds and removes a value when multiple is true', async () => {
      const { log, triggerA, triggerB } = await renderModel({ multiple: true });

      await fireEvent.click(triggerA);
      await fireEvent.click(triggerB);

      expect(log.at(-1)).toBe('update:value a,b');

      await fireEvent.click(triggerA);

      expect(log.at(-1)).toBe('update:value b');
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
      expect(triggerB).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the open state when the parent does not write the controlled value', async () => {
      const onValueChange = vi.fn();

      await render(
        <Accordion.Root value={[]} onValueChange={onValueChange}>
          <Accordion.Item value="a">
            <Accordion.Header>
              <Accordion.Trigger>a</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(onValueChange.mock.lastCall?.[0]).toEqual(['a']);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('gives a generated value to an item that has no value', async () => {
      const onValueChange = vi.fn();

      await render(
        <Accordion.Root multiple onValueChange={onValueChange}>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>a</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>b</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const [triggerA, triggerB] = screen.getAllByRole('button');

      await fireEvent.click(triggerA);
      await fireEvent.click(triggerB);

      const value: string[] = onValueChange.mock.lastCall?.[0];
      expect(value).toHaveLength(2);
      expect(value[0]).toMatch(/^vase-ui-/);
      expect(value[1]).toMatch(/^vase-ui-/);
      expect(value[0]).not.toBe(value[1]);
      expect(triggerA).toHaveAttribute('aria-expanded', 'true');
      expect(triggerB).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('the index of an item', () => {
    it('follows a new order, a removal and an addition', async () => {
      const values = shallowRef(['a', 'b', 'c']);
      const hiddenValue = shallowRef<string | undefined>();

      const { container } = await render(() => (
        <AccordionRootList values={values.value} hiddenValue={hiddenValue.value} />
      ));

      expect(readTriggers(container)).toEqual(['a:0', 'b:1', 'c:2']);

      values.value = ['c', 'a', 'b'];

      await waitFor(() => {
        expect(readTriggers(container)).toEqual(['c:0', 'a:1', 'b:2']);
      });

      hiddenValue.value = 'a';

      await waitFor(() => {
        expect(readTriggers(container)).toEqual(['c:0', 'b:1']);
      });

      hiddenValue.value = undefined;

      await waitFor(() => {
        expect(readTriggers(container)).toEqual(['c:0', 'a:1', 'b:2']);
      });
    });
  });

  describe('elements that are not items', () => {
    it('VUE-87: join the composite around the root, in a panel and as a child of the root', async () => {
      await render(
        <Toolbar.Root>
          <Accordion.Root defaultValue={['a']}>
            <Accordion.Item value="a" data-testid="item-a">
              <Accordion.Header>
                <Accordion.Trigger>A</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>
                <Toolbar.Button data-testid="in-panel">In a panel</Toolbar.Button>
              </Accordion.Panel>
            </Accordion.Item>
            <Toolbar.Button data-testid="in-root">In the root</Toolbar.Button>
            <Accordion.Item value="b" data-testid="item-b">
              <Accordion.Header>
                <Accordion.Trigger>B</Accordion.Trigger>
              </Accordion.Header>
            </Accordion.Item>
          </Accordion.Root>
          <Toolbar.Button data-testid="after-root">After the root</Toolbar.Button>
        </Toolbar.Root>,
      );
      const inPanel = screen.getByTestId('in-panel');
      inPanel.focus();

      await fireEvent.keyDown(inPanel, { key: 'ArrowRight' });
      expect(screen.getByTestId('in-root')).toHaveFocus();

      await fireEvent.keyDown(screen.getByTestId('in-root'), { key: 'ArrowRight' });
      expect(screen.getByTestId('after-root')).toHaveFocus();
      expect(screen.getByTestId('item-a')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('item-b')).toHaveAttribute('data-index', '1');
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'closed items', props: {}, open: [false, false] },
      { name: 'an open item', props: { defaultValue: [0] }, open: [true, false] },
    ])('hydrates $name with no warning and no DOM difference', async ({ props, open }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      // The parse in a `<template>` element has no side effect.
      const server = document.createElement('template');
      server.innerHTML = serverHtml;
      const serverItems = [...server.content.firstElementChild!.children];
      const serverTriggers = [...server.content.querySelectorAll('button')];
      expect(readTriggers(server.content)).toEqual(['Trigger 1:0', 'Trigger 2:1']);
      expect(serverTriggers.map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual(
        open.map(String),
      );
      expect(serverItems.map((item) => item.hasAttribute('data-open'))).toEqual(open);
      expect(serverItems.map((item) => item.hasAttribute('data-hidden'))).toEqual(
        open.map((isOpen) => !isOpen),
      );
      // The value is state, and no part writes it as an attribute.
      expect(serverHtml).not.toContain('data-value');
      const serverIds = serverTriggers.map((trigger) => trigger.id);
      expect(serverIds[0]).toMatch(/^vase-ui-/);
      expect(serverIds[1]).toMatch(/^vase-ui-/);
      expect(serverIds[0]).not.toBe(serverIds[1]);

      const { container } = await hydrate(AccordionRootHydration, { serverHtml, props });

      expect([...container.querySelectorAll('button')].map((trigger) => trigger.id)).toEqual(
        serverIds,
      );
    });

    interface NamesRow {
      name: string;
      file: string;
      component: Component;
      props: Record<string, unknown>;
      /** The names in the server HTML, which are also the names after the hydration. */
      names: ReturnType<typeof readNames>;
    }

    it.each<NamesRow>([
      {
        name: 'an open item',
        file: HYDRATION_FIXTURE,
        component: AccordionRootHydration,
        props: { defaultValue: [0] },
        names: {
          controls: 'the generated panel id',
          labelledBy: 'the generated trigger id',
          hidden: false,
        },
      },
      {
        name: 'a closed item with keepMounted',
        file: HYDRATION_FIXTURE,
        component: AccordionRootHydration,
        props: { keepMounted: true },
        names: { controls: 'nothing', labelledBy: 'the generated trigger id', hidden: true },
      },
      {
        name: 'a closed item with hiddenUntilFound',
        file: HYDRATION_FIXTURE,
        component: AccordionRootHydration,
        props: { hiddenUntilFound: true },
        names: { controls: 'nothing', labelledBy: 'the generated trigger id', hidden: true },
      },
      {
        name: 'an open item with a trigger id',
        file: HYDRATION_FIXTURE,
        component: AccordionRootHydration,
        props: { defaultValue: [0], triggerId: 'my-trigger' },
        names: { controls: 'the generated panel id', labelledBy: 'my-trigger', hidden: false },
      },
      {
        name: 'an open item with a panel id',
        file: HYDRATION_FIXTURE,
        component: AccordionRootHydration,
        props: { defaultValue: [0], panelId: 'my-panel' },
        names: { controls: 'my-panel', labelledBy: 'the generated trigger id', hidden: false },
      },
      {
        name: 'an open item with the panel first',
        file: PANEL_FIRST_FIXTURE,
        component: AccordionRootPanelFirst,
        props: {},
        names: {
          controls: 'the generated panel id',
          labelledBy: 'the generated trigger id',
          hidden: false,
        },
      },
      {
        name: 'the panel first and a trigger id',
        file: PANEL_FIRST_FIXTURE,
        component: AccordionRootPanelFirst,
        props: { triggerId: 'my-trigger' },
        names: { controls: 'the generated panel id', labelledBy: 'my-trigger', hidden: false },
      },
    ])(
      'VUE-80: names the parts in the server HTML and after the hydration: $name',
      async ({ file, component, props, names }) => {
        const serverHtml = await renderOnServer(file, props);

        // The parse in a `<template>` element has no side effect.
        const template = document.createElement('template');
        template.innerHTML = serverHtml;
        expect(readNames(template.content)).toEqual(names);

        const { container } = await hydrate(component, { serverHtml, props });

        expect(readNames(container)).toEqual(names);
      },
    );

    it('has hidden="until-found" on a closed hiddenUntilFound panel after the hydration', async () => {
      const props = { hiddenUntilFound: true };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(AccordionRootHydration, { serverHtml, props });

      expect(container.querySelector('[role="region"]')!.getAttribute('hidden')).toBe(
        'until-found',
      );
    });
  });
});
