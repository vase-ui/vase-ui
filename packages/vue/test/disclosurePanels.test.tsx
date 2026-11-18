import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, nextTick, onActivated, onDeactivated, shallowRef } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { createRenderer, screen, waitFor } from '#test-utils';
import { reset } from '../src/common/warn';

describe('searchable disclosure panels', () => {
  const { render } = createRenderer();

  it.each(['item', 'root'] as const)(
    'restores the accordion panel after the %s veto',
    async (veto) => {
      let refuse = true;
      const model = shallowRef<string[]>([]);
      const calls: string[] = [];
      await render(() => (
        <Accordion.Root
          hiddenUntilFound
          v-model={model.value}
          onValueChange={(_value, details) => {
            calls.push('root');
            if (refuse && veto === 'root') details.cancel();
          }}
        >
          <Accordion.Item
            value="delivery"
            onOpenChange={(_open, details) => {
              calls.push('item');
              if (refuse && veto === 'item') details.cancel();
            }}
          >
            <Accordion.Header>
              <Accordion.Trigger>Delivery</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Shipping times</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Delivery' });
      const panel = screen.getByText('Shipping times');

      panel.dispatchEvent(new Event('beforematch'));
      panel.removeAttribute('hidden');
      await waitFor(() => expect(panel).toHaveAttribute('hidden', 'until-found'));

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(model.value).toEqual([]);
      expect(calls).toEqual(veto === 'item' ? ['item'] : ['item', 'root']);

      refuse = false;
      calls.length = 0;
      panel.dispatchEvent(new Event('beforematch'));
      await nextTick();
      expect(calls).toEqual(['item', 'root']);
      expect(model.value).toEqual(['delivery']);
      expect(screen.getByRole('region', { name: 'Delivery' })).toBe(panel);
      expect(trigger).toHaveAttribute('aria-controls', panel.id);
    },
  );

  it('restores the inline duration when a searchable panel unmounts after a match', async () => {
    const { unmount } = await render(() => (
      <Collapsible.Root>
        <Collapsible.Panel hiddenUntilFound style={{ transitionDuration: '123ms !important' }}>
          Details
        </Collapsible.Panel>
      </Collapsible.Root>
    ));
    const panel = screen.getByText('Details');
    panel.dispatchEvent(new Event('beforematch'));
    await nextTick();
    expect(panel.style.transitionDuration).toBe('0s');
    unmount();
    expect(panel.style.transitionDuration).toBe('123ms');
    expect(panel.style.getPropertyPriority('transition-duration')).toBe('important');
  });

  it('restores the inline duration before the parent reads a cached panel', async () => {
    const shown = shallowRef(true);
    let durationAtDeactivation: string | undefined;
    const Content = defineComponent(() => {
      onDeactivated(() => {
        durationAtDeactivation = panel.style.transitionDuration;
      });
      return () => (
        <Collapsible.Root>
          <Collapsible.Panel hiddenUntilFound>Details</Collapsible.Panel>
        </Collapsible.Root>
      );
    });
    await render(() => <KeepAlive>{shown.value ? <Content /> : null}</KeepAlive>);
    const panel = screen.getByText('Details');
    panel.style.setProperty('transition-duration', '123ms', 'important');
    panel.dispatchEvent(new Event('beforematch'));
    await nextTick();
    expect(panel.style.transitionDuration).toBe('0s');

    shown.value = false;
    await nextTick();
    expect(durationAtDeactivation).toBe('123ms');
    expect(panel.style.transitionDuration).toBe('123ms');
    expect(panel.style.getPropertyPriority('transition-duration')).toBe('important');
    shown.value = true;
    await nextTick();
    expect(screen.getByText('Details')).toBe(panel);
    expect(panel.style.transitionDuration).toBe('123ms');
  });

  it('restores the inline duration when the panel element changes', async () => {
    const tag = shallowRef<'div' | 'section'>('div');
    const { unmount } = await render(() => (
      <Collapsible.Root>
        <Collapsible.Panel
          as={tag.value}
          hiddenUntilFound
          style={{ transitionDuration: '123ms !important' }}
        >
          Details
        </Collapsible.Panel>
      </Collapsible.Root>
    ));
    const previous = screen.getByText('Details');
    previous.dispatchEvent(new Event('beforematch'));
    await nextTick();
    expect(previous.style.transitionDuration).toBe('0s');

    tag.value = 'section';
    await nextTick();
    const current = screen.getByText('Details');
    expect(current).not.toBe(previous);
    expect(previous.style.transitionDuration).toBe('123ms');
    expect(previous.style.getPropertyPriority('transition-duration')).toBe('important');
    expect(current.style.transitionDuration).toBe('123ms');
    unmount();
    expect(current.style.getPropertyPriority('transition-duration')).toBe('important');
  });

  it('restores a duration set on the element before the first close', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Collapsible.Root v-model:open={open.value}>
        <Collapsible.Panel hiddenUntilFound>Details</Collapsible.Panel>
      </Collapsible.Root>
    ));
    const panel = screen.getByText('Details');
    panel.style.setProperty('transition-duration', '123ms', 'important');
    panel.dispatchEvent(new Event('beforematch'));
    await nextTick();
    expect(panel.style.transitionDuration).toBe('0s');
    open.value = false;
    await nextTick();
    expect(panel.style.transitionDuration).toBe('123ms');
    expect(panel.style.getPropertyPriority('transition-duration')).toBe('important');
  });

  it.each(['0s', undefined])(
    'uses the updated duration %s on the first close after a match',
    async (nextDuration) => {
      const duration = shallowRef<string | undefined>('123ms');
      const open = shallowRef(false);
      await render(() => (
        <Collapsible.Root v-model:open={open.value}>
          <Collapsible.Panel hiddenUntilFound style={{ transitionDuration: duration.value }}>
            Details
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      const panel = screen.getByText('Details');
      panel.dispatchEvent(new Event('beforematch'));
      await nextTick();
      expect(panel.style.transitionDuration).toBe('0s');

      duration.value = nextDuration;
      open.value = false;
      await nextTick();
      expect(panel).toHaveAttribute('hidden', 'until-found');
      expect(panel.style.transitionDuration).toBe(nextDuration ?? '');
    },
  );

  it('restores the matched element when the panel renders a replacement', async () => {
    const tag = shallowRef<'div' | 'section'>('div');
    await render(() => (
      <Collapsible.Root open={false}>
        <Collapsible.Panel hiddenUntilFound as={tag.value}>
          Details
        </Collapsible.Panel>
      </Collapsible.Root>
    ));
    const previous = screen.getByText('Details');
    previous.dispatchEvent(new Event('beforematch'));
    previous.removeAttribute('hidden');
    tag.value = 'section';
    await nextTick();

    const current = screen.getByText('Details');
    expect(current).not.toBe(previous);
    expect(current).toHaveAttribute('hidden', 'until-found');
    await waitFor(() => expect(previous).toHaveAttribute('hidden', 'until-found'));
    expect(previous).toHaveAttribute('data-starting-style');
  });

  it('restores a refused match before the parent activation hook reads the panel', async () => {
    const shown = shallowRef(true);
    const atActivation: [string | null, boolean][] = [];
    const Content = defineComponent(() => {
      onActivated(() => {
        const panel = screen.getByText('Details');
        atActivation.push([
          panel.getAttribute('hidden'),
          panel.hasAttribute('data-starting-style'),
        ]);
      });
      return () => (
        <Collapsible.Root open={false}>
          <Collapsible.Panel hiddenUntilFound>Details</Collapsible.Panel>
        </Collapsible.Root>
      );
    });
    await render(() => <KeepAlive>{shown.value ? <Content /> : null}</KeepAlive>);
    const panel = screen.getByText('Details');

    vi.useFakeTimers();
    try {
      panel.dispatchEvent(new Event('beforematch'));
      panel.removeAttribute('hidden');
      await nextTick();
      shown.value = false;
      await nextTick();
      shown.value = true;
      await nextTick();
      expect(atActivation).toEqual([
        ['until-found', true],
        ['until-found', true],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('warns when a prop update conflicts with searchable panels', async () => {
    const searchable = shallowRef(false);
    const keep = shallowRef(true);
    const shown = shallowRef(true);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const Panels = defineComponent(() => () => (
        <div>
          <Accordion.Root hiddenUntilFound={searchable.value} keepMounted={keep.value}>
            <Accordion.Item>
              <Accordion.Panel keepMounted={keep.value} />
            </Accordion.Item>
          </Accordion.Root>
          <Collapsible.Root>
            <Collapsible.Panel hiddenUntilFound={searchable.value} keepMounted={keep.value} />
          </Collapsible.Root>
        </div>
      ));
      await render(() => <KeepAlive>{shown.value ? <Panels /> : null}</KeepAlive>);
      expect(warnings).not.toHaveBeenCalled();

      keep.value = false;
      searchable.value = true;
      await nextTick();
      for (const part of ['Accordion.Root', 'Accordion.Panel', 'Collapsible.Panel']) {
        expect(warnings).toHaveBeenCalledWith(expect.stringContaining(`prop of \`${part}\``));
      }
      expect(warnings).toHaveBeenCalledTimes(3);

      reset();
      warnings.mockClear();
      shown.value = false;
      await nextTick();
      shown.value = true;
      await nextTick();
      searchable.value = false;
      await nextTick();
      expect(warnings).not.toHaveBeenCalled();
    } finally {
      warnings.mockRestore();
    }
  });
});
