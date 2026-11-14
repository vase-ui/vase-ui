import { describe, expect, it, onTestFinished } from 'vitest';
import { KeepAlive, defineComponent, onScopeDispose, shallowRef, watch } from 'vue';
import type { PropType } from 'vue';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import * as Drawer from '../index.parts';
import { useDrawerRootContext } from './DrawerRootContext';
import type { DrawerSnapPoint } from './DrawerRootContext';
import { useDrawerSnapPoints } from './useDrawerSnapPoints';
import type { UseDrawerSnapPointsReturnValue } from './useDrawerSnapPoints';

const SnapPointProbe = defineComponent({
  setup() {
    const { resolvedSnapPoints, activeSnapPointOffset } = useDrawerSnapPoints();
    return () => (
      <output data-testid="snap-point-probe">
        {JSON.stringify({
          resolvedSnapPoints: resolvedSnapPoints.value,
          activeSnapPointOffset: activeSnapPointOffset.value,
        })}
      </output>
    );
  },
});

// The popup reports its height to the root, as `Drawer.Popup` does.
const PopupHeightReport = defineComponent({
  props: { height: { type: Number, required: true } },
  setup(props) {
    const { onPopupHeightChange } = useDrawerRootContext();
    watch(() => props.height, onPopupHeightChange, { immediate: true });
    return () => null;
  },
});

// Gives the store the element of the viewport, as `Drawer.Viewport` does.
const TestViewport = defineComponent({
  props: { height: { type: Number, required: true } },
  setup(props) {
    const store = useDialogRootContext();
    let ownElement: HTMLElement | null = null;
    function setViewportElement(element: unknown) {
      const viewport = element as HTMLElement | null;
      if (viewport === ownElement) {
        return;
      }
      ownElement = viewport;
      store.set('viewportElement', viewport);
    }
    onScopeDispose(() => {
      if (store.select('viewportElement') === ownElement) {
        store.set('viewportElement', null);
      }
    });

    return () => <div ref={setViewportElement} style={{ height: `${props.height}px` }} />;
  },
});

const TestSnapPointsCase = defineComponent({
  props: {
    snapPoints: { type: Array as PropType<DrawerSnapPoint[]>, required: true },
    snapPoint: {
      type: [Number, String] as PropType<DrawerSnapPoint | null>,
      default: undefined,
    },
    popupHeight: { type: Number, default: 300 },
    viewportHeight: { type: Number, default: 400 },
  },
  setup(props) {
    return () => (
      <Drawer.Root open modal={false} snapPoints={props.snapPoints} snapPoint={props.snapPoint}>
        <SnapPointProbe />
        <PopupHeightReport height={props.popupHeight} />
        <TestViewport height={props.viewportHeight} />
      </Drawer.Root>
    );
  },
});

// The case gives the heights in CSS. The browser lays them out, so each part measures them at its
// mount.
const SnapPointsCase = defineComponent({
  props: {
    snapPoints: { type: Array as PropType<DrawerSnapPoint[]>, required: true },
    snapPoint: {
      type: [Number, String] as PropType<DrawerSnapPoint | null>,
      default: undefined,
    },
    popupHeight: { type: Number, default: 300 },
    viewportHeight: { type: Number, default: 400 },
  },
  setup(props) {
    return () => (
      <Drawer.Root open modal={false} snapPoints={props.snapPoints} snapPoint={props.snapPoint}>
        <SnapPointProbe />
        <Drawer.Portal>
          <Drawer.Viewport style={{ height: `${props.viewportHeight}px` }}>
            <Drawer.Popup data-testid="popup" style={{ height: `${props.popupHeight}px` }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  },
});

function readProbe() {
  return JSON.parse(screen.getByTestId('snap-point-probe').textContent || '{}') as {
    resolvedSnapPoints: { value: DrawerSnapPoint; height: number; offset: number }[];
    activeSnapPointOffset: number | null;
  };
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('Drawer snap point composition', () => {
  const { render } = createRenderer();

  it('resolves supported units, filters invalid values, clamps heights, and keeps the last duplicate', async () => {
    const previousFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = '20px';
    onTestFinished(() => {
      document.documentElement.style.fontSize = previousFontSize;
    });

    await render(
      <SnapPointsCase
        snapPoints={[
          Number.NaN,
          'invalid',
          'invalidpx',
          'invalidrem',
          -1,
          '2rem',
          '100px',
          200,
          200.5,
          800,
        ]}
        snapPoint={200}
      />,
    );

    await waitFor(() => {
      expect(readProbe().resolvedSnapPoints).toEqual([
        { value: -1, height: 0, offset: 300 },
        { value: '2rem', height: 40, offset: 260 },
        { value: '100px', height: 100, offset: 200 },
        { value: 200.5, height: 200.5, offset: 99.5 },
        { value: 800, height: 300, offset: 0 },
      ]);
    });
    expect(readProbe().activeSnapPointOffset).toBe(99.5);
    expect(screen.getByTestId('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe(
      '99.5px',
    );
  });

  it('uses fractional and pixel snap points and resolves null or invalid active values as closed', async () => {
    const { setProps } = await render(
      <SnapPointsCase snapPoints={[0.5, 200, '2rem']} snapPoint={200} />,
    );

    await waitFor(() => {
      expect(readProbe().activeSnapPointOffset).toBe(100);
    });

    await setProps({ snapPoints: [0.5, 200, '2rem'], snapPoint: null });
    expect(readProbe().activeSnapPointOffset).toBeNull();
    expect(screen.getByTestId('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe(
      '0px',
    );

    await setProps({ snapPoints: [0.5, 200, '2rem'], snapPoint: 'invalid' });
    expect(readProbe().activeSnapPointOffset).toBeNull();
  });

  it('produces no resolved snap point when the list is empty', async () => {
    await render(<SnapPointsCase snapPoints={[]} />);

    expect(readProbe().resolvedSnapPoints).toEqual([]);
    expect(readProbe().activeSnapPointOffset).toBeNull();
  });

  it('resolves a single snap point without a deduplication pass', async () => {
    await render(<SnapPointsCase snapPoints={['100px']} snapPoint="100px" />);

    await waitFor(() => {
      expect(readProbe().resolvedSnapPoints).toEqual([
        { value: '100px', height: 100, offset: 200 },
      ]);
    });
    expect(readProbe().activeSnapPointOffset).toBe(200);
  });

  it('gives no snap point for an empty list, or before the popup reports its height', async () => {
    const { setProps } = await render(<TestSnapPointsCase snapPoints={[]} snapPoint={null} />);
    await flushMicrotasks();

    expect(readProbe().resolvedSnapPoints).toEqual([]);
    expect(readProbe().activeSnapPointOffset).toBeNull();

    await setProps({ snapPoints: ['100px'], snapPoint: '100px', popupHeight: 0 });
    expect(readProbe().resolvedSnapPoints).toEqual([]);
    expect(readProbe().activeSnapPointOffset).toBeNull();
  });

  it('measures the viewport again when it resizes', async () => {
    const { setProps } = await render(
      <TestSnapPointsCase snapPoints={[0.5]} snapPoint={0.5} viewportHeight={400} />,
    );

    await waitFor(() => {
      expect(readProbe().activeSnapPointOffset).toBe(100);
    });

    await setProps({ snapPoints: [0.5], snapPoint: 0.5, viewportHeight: 200 });

    await waitFor(() => {
      expect(readProbe().activeSnapPointOffset).toBe(200);
    });
  });

  it('uses the height of the document when the drawer has no viewport', async () => {
    await render(
      <Drawer.Root open modal={false} snapPoints={[0.5]}>
        <SnapPointProbe />
        <PopupHeightReport height={100_000} />
      </Drawer.Root>,
    );

    const height = document.documentElement.clientHeight / 2;
    await waitFor(() => {
      expect(readProbe().resolvedSnapPoints).toEqual([
        { value: 0.5, height, offset: 100_000 - height },
      ]);
    });
  });

  it('measures a viewport that mounts after the part, and the document again when the viewport unmounts', async () => {
    const shown = shallowRef(false);
    await render(() => (
      <Drawer.Root open modal={false} snapPoints={[0.5]}>
        <SnapPointProbe />
        <PopupHeightReport height={100_000} />
        {shown.value && <TestViewport height={120} />}
      </Drawer.Root>
    ));

    const documentHeight = document.documentElement.clientHeight / 2;
    await waitFor(() => {
      expect(readProbe().resolvedSnapPoints).toEqual([
        { value: 0.5, height: documentHeight, offset: 100_000 - documentHeight },
      ]);
    });
    await flushMicrotasks();

    shown.value = true;
    await waitFor(() => {
      expect(readProbe().resolvedSnapPoints).toEqual([{ value: 0.5, height: 60, offset: 99_940 }]);
    });
    await flushMicrotasks();

    shown.value = false;
    await waitFor(() => {
      expect(readProbe().resolvedSnapPoints).toEqual([
        { value: 0.5, height: documentHeight, offset: 100_000 - documentHeight },
      ]);
    });
  });

  it('VUE-5: stops measuring the viewport while KeepAlive holds the part, and measures it again at the activation', async () => {
    const shown = shallowRef(true);
    const viewportHeight = shallowRef(400);
    let snapPoints!: UseDrawerSnapPointsReturnValue;
    const Held = defineComponent({
      name: 'Held',
      setup() {
        snapPoints = useDrawerSnapPoints();
        return () => <p>held</p>;
      },
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
    await render(() => (
      <Drawer.Root open modal={false} snapPoints={[0.5]}>
        <PopupHeightReport height={300} />
        <TestViewport height={viewportHeight.value} />
        <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
      </Drawer.Root>
    ));

    await waitFor(() => {
      expect(snapPoints.viewportHeight.value).toBe(400);
    });

    shown.value = false;
    await flushMicrotasks();
    viewportHeight.value = 200;
    await flushMicrotasks();
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(snapPoints.viewportHeight.value).toBe(400);

    shown.value = true;
    await flushMicrotasks();
    expect(snapPoints.viewportHeight.value).toBe(200);

    viewportHeight.value = 300;
    await waitFor(() => {
      expect(snapPoints.viewportHeight.value).toBe(300);
    });
  });
});
