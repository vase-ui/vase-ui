import { computed, shallowRef, watch } from 'vue';
import type { ComputedRef, ShallowRef } from 'vue';
import type { Orientation } from '../../internals/types';
import type {
  ResizableHandleRegistration,
  ResizablePanelRegistration,
} from '../root/ResizableRootContext';
import { getBoundaries, getEdgeAreas } from './edges';
import type { AxisBox } from './edges';
import type { Layout } from './layout';
import type { RootMeasurement } from './measure';

/**
 * The box of an edge node, in layout pixels from the padding edge of the root element.
 */
export interface EdgeBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A boundary of two panels that have no handle between them, with the boxes of its edge nodes.
 */
export interface EdgeBoundary {
  /**
   * The panel before the boundary. The id of the panel is the key of the boundary.
   */
  before: ResizablePanelRegistration;
  areas: readonly EdgeBox[];
}

interface EdgesOptions {
  /**
   * Whether the root has edges.
   */
  enabled: () => boolean;
  disabled: () => boolean;
  orientation: ComputedRef<Orientation>;
  hitAreaSize: ComputedRef<number>;
  panels: ComputedRef<readonly ResizablePanelRegistration[]>;
  handles: Readonly<ShallowRef<readonly ResizableHandleRegistration[]>>;
  measurement: Readonly<ShallowRef<RootMeasurement | undefined>>;
  shown: ComputedRef<Layout>;
}

function areBoxesEqual(a: EdgeBox, b: EdgeBox | undefined) {
  return a.left === b?.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function areEdgesEqual(a: readonly EdgeBoundary[], b: readonly EdgeBoundary[]) {
  return (
    a.length === b.length &&
    a.every((boundary, position) => {
      const other = b[position];
      return (
        boundary.before === other?.before &&
        boundary.areas.length === other.areas.length &&
        boundary.areas.every((area, areaPosition) => areBoxesEqual(area, other.areas[areaPosition]))
      );
    })
  );
}

/**
 * Finds the edges of the root: the boundaries of two panels that have no handle between them, with
 * the box of each node that takes a press. The result is empty until the root has a measurement.
 * The root reads the places of the panels again when a panel changes size, because a transition
 * moves a boundary for some frames after the layout changed.
 */
export function useEdges(options: EdgesOptions): Readonly<ShallowRef<readonly EdgeBoundary[]>> {
  const edges = shallowRef<readonly EdgeBoundary[]>([]);

  const boundaries = computed(() =>
    options.enabled()
      ? getBoundaries(
          options.panels.value.map((panel) => ({
            index: panel.index.value,
            disabled: panel.disabled(),
            registration: panel,
          })),
          options.handles.value
            .filter((handle) => !handle.deactivated.value)
            .map((handle) => handle.index.value),
          options.disabled(),
        )
      : [],
  );

  function readBox(panel: HTMLElement, horizontal: boolean): AxisBox {
    return horizontal
      ? { start: panel.offsetLeft, end: panel.offsetLeft + panel.offsetWidth }
      : { start: panel.offsetTop, end: panel.offsetTop + panel.offsetHeight };
  }

  function updateEdges() {
    const horizontal = options.orientation.value === 'horizontal';
    const next: EdgeBoundary[] = [];
    // The offsets of a panel are from the padding edge of the root, which is the offset parent.
    if (options.measurement.value !== undefined) {
      for (const { before, after } of boundaries.value) {
        const first = before.registration.element.value;
        const second = after.registration.element.value;
        if (first === null || second === null) {
          continue;
        }
        const areas = getEdgeAreas(
          readBox(first, horizontal),
          readBox(second, horizontal),
          options.hitAreaSize.value,
          first.nextElementSibling === second,
        ).map((area) =>
          horizontal
            ? {
                left: area.start,
                top: first.offsetTop,
                width: area.end - area.start,
                height: first.offsetHeight,
              }
            : {
                left: first.offsetLeft,
                top: area.start,
                width: first.offsetWidth,
                height: area.end - area.start,
              },
        );
        if (areas.length > 0) {
          next.push({ before: before.registration, areas });
        }
      }
    }
    if (!areEdgesEqual(edges.value, next)) {
      edges.value = next;
    }
  }

  watch(
    [boundaries, options.orientation, options.hitAreaSize, options.shown, options.measurement],
    updateEdges,
    { flush: 'post' },
  );

  watch(
    () =>
      boundaries.value.length > 0 ? options.panels.value.map((panel) => panel.element.value) : [],
    (elements, _previous, onCleanup) => {
      const observed = elements.filter((element) => element !== null);
      if (observed.length === 0 || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(updateEdges);
      for (const element of observed) {
        observer.observe(element);
      }
      onCleanup(() => {
        observer.disconnect();
      });
    },
    { flush: 'post' },
  );

  return edges;
}
