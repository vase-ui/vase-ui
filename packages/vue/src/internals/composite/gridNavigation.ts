import { toValue } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import type { DisabledIndices } from './listIndex';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT } from './listIndex';
import {
  createGridCellMap,
  getGridCellIndexOfCorner,
  getGridCellIndices,
  getGridColumns,
  getGridNavigatedIndex,
  isListIndexDisabled,
  isIndexOutOfListBounds,
} from './listIndex';

type CompositeGridElementsRef = Readonly<Ref<readonly (HTMLElement | null)[]>>;
type CompositeGridOnLoop = (event: KeyboardEvent, prevIndex: number, nextIndex: number) => number;

/** The number of columns (`width`) and of rows (`height`) that an item covers. */
export interface CompositeGridItemSize {
  /**
   * A width that is not a finite number counts as 1. A width above the number of columns counts as
   * the number of columns.
   */
  width: number;
  /** A height that is not a finite number counts as 1. */
  height: number;
}

export interface CompositeGridConfig {
  /**
   * The number of columns. A whole number, 1 or more.
   * A fraction counts as its whole part. A value below 1, or a value that is not a finite number,
   * counts as 1.
   */
  cols: number;
  dense?: boolean | undefined;
  itemSizes?: CompositeGridItemSize[] | undefined;
}

export interface CompositeGridNavigationState {
  event: KeyboardEvent;
  elementsRef: CompositeGridElementsRef;
  highlightedIndex: number;
  minIndex: number;
  maxIndex: number;
  orientation: 'horizontal' | 'vertical' | 'both';
  loopFocus: boolean;
  onLoop?: CompositeGridOnLoop | undefined;
  disabledIndices?: DisabledIndices | undefined;
  rtl: boolean;
}

export type CompositeGridNavigator = (state: CompositeGridNavigationState) => number;

/**
 * Makes the navigator that a root part gives to `useCompositeRoot` as `grid`.
 * A root part with no grid does not import this file. A bundler can then remove the grid code.
 * `config` is a value, a ref or a getter. The navigator reads it when a key comes.
 */
export function gridNavigation(
  config: MaybeRefOrGetter<CompositeGridConfig>,
): CompositeGridNavigator {
  return (state) => {
    const { cols: configuredCols, dense = false, itemSizes } = toValue(config);
    // The steps below use `cols` as a divisor and as a step size, so it must be a whole number,
    // 1 or more.
    const cols = getGridColumns(configuredCols);
    const {
      disabledIndices,
      elementsRef,
      event,
      highlightedIndex,
      loopFocus,
      maxIndex,
      minIndex,
      onLoop,
      orientation,
      rtl,
    } = state;

    const sizes =
      itemSizes ??
      Array.from({ length: elementsRef.value.length }, () => ({
        width: 1,
        height: 1,
      }));
    // The navigation works in cell indexes, and it gives back an item index.
    const cellMap = createGridCellMap(sizes, cols, dense);
    const minGridIndex = cellMap.findIndex(
      (index) => index != null && !isListIndexDisabled(elementsRef.value, index, disabledIndices),
    );
    const maxGridIndex = cellMap.reduce(
      (foundIndex: number, index, cellIndex) =>
        index != null && !isListIndexDisabled(elementsRef.value, index, disabledIndices)
          ? cellIndex
          : foundIndex,
      -1,
    );
    const cellIndex = getGridNavigatedIndex(
      cellMap.map((itemIndex) =>
        itemIndex != null ? (elementsRef.value[itemIndex] ?? null) : null,
      ),
      {
        event,
        orientation,
        loopFocus,
        onLoop,
        cols,
        // An empty cell is disabled, so the navigation cannot land in it.
        disabledIndices: getGridCellIndices(
          [
            ...elementsRef.value.map((_, index) =>
              isListIndexDisabled(elementsRef.value, index, disabledIndices) ? index : undefined,
            ),
            undefined,
          ],
          cellMap,
        ),
        minIndex: minGridIndex,
        maxIndex: maxGridIndex,
        prevIndex: getGridCellIndexOfCorner(
          highlightedIndex > maxIndex ? minIndex : highlightedIndex,
          sizes,
          cellMap,
          cols,
          // The start cell is the corner of the item that is nearest to the direction of the key.
          // An item that spans cells then does not navigate to itself.
          event.key === ARROW_DOWN
            ? 'bl'
            : event.key === (rtl ? ARROW_LEFT : ARROW_RIGHT)
              ? 'tr'
              : 'tl',
        ),
        rtl,
      },
    );

    return cellMap[cellIndex] ?? highlightedIndex;
  };
}

/**
 * Positional arguments are deliberate: property names of an options object
 * don't minify, and the signature is locked to the caller via `typeof` on the
 * `grid` option of `useListNavigation`.
 *
 * The injected grid navigator only ever operates on a uniform 1x1 grid (sizes are
 * always `1x1` and packing is never dense), so the cell-map machinery that supports
 * multi-cell items collapses to an identity transform over the item list. Calling
 * `getGridNavigatedIndex` directly keeps the cell-map helpers
 * (`createGridCellMap`/`getGridCellIndexOfCorner`/`getGridCellIndices`) out of
 * grid-combobox bundles.
 */
export function navigateUniformGrid(
  event: KeyboardEvent,
  prevIndex: number,
  listRef: Readonly<Ref<(HTMLElement | null)[]>>,
  orientation: 'horizontal' | 'vertical' | 'both',
  loopFocus: boolean,
  rtl: boolean,
  disabledIndices: DisabledIndices | undefined,
  minIndex: number,
  maxIndex: number,
  cols = 2,
): number | undefined {
  const nextIndex = getGridNavigatedIndex(listRef.value, {
    event,
    orientation,
    loopFocus,
    rtl,
    cols,
    disabledIndices,
    minIndex,
    maxIndex,
    // An out-of-range previous index falls back to the first enabled item.
    prevIndex: prevIndex > maxIndex ? minIndex : prevIndex,
    stopEvent: true,
  });

  // `getGridNavigatedIndex` can return an out-of-bounds sentinel (e.g. `-1` when there is no
  // previous item to move from); surface that as `undefined` so the caller treats it as
  // "no navigation" rather than highlighting index `-1`.
  return isIndexOutOfListBounds(listRef.value, nextIndex) ? undefined : nextIndex;
}
