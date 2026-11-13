import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useUnmountAfterClose } from './useUnmountAfterClose';

describe('useUnmountAfterClose', () => {
  it('renders the popup only for an open host, and calls no callback and no setter', async () => {
    const onUnmount = vi.fn();
    const setPreventUnmountOnClose = vi.fn();

    const Host = defineComponent(
      (props: { open: boolean; animateInitialOpen?: boolean | undefined }) => {
        const element = shallowRef<HTMLDivElement | null>(null);
        const { mounted, transitionStatus } = useUnmountAfterClose({
          open: () => props.open,
          ref: element,
          preventUnmountOnClose: false,
          setPreventUnmountOnClose,
          onUnmount,
          animateInitialOpen: props.animateInitialOpen,
        });

        return () =>
          mounted.value ? (
            <div
              ref={element}
              data-testid="popup"
              data-starting-style={transitionStatus.value === 'starting' ? '' : undefined}
            />
          ) : null;
      },
      { props: ['open', 'animateInitialOpen'] },
    );

    expect(typeof requestAnimationFrame).toBe('undefined');

    const open = await renderToString(<Host open />);
    const closed = await renderToString(<Host open={false} />);
    const animated = await renderToString(<Host open animateInitialOpen />);

    expect(open).toBe('<div data-testid="popup"></div>');
    expect(closed).toBe('<!---->');
    expect(animated).toBe('<div data-testid="popup" data-starting-style></div>');
    expect(onUnmount).not.toHaveBeenCalled();
    expect(setPreventUnmountOnClose).not.toHaveBeenCalled();
  });
});
