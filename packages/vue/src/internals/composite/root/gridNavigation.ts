import { toValue } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT } from '../composite';
import {
  createGridCellMap,
  getGridCellIndexOfCorner,
  getGridCellIndices,
  getGridColumns,
  getGridNavigatedIndex,
  isListIndexDisabled,
} from '../listIndex';

type CompositeGridElementsRef = Readonly<Ref<ReadonlyArray<HTMLElement | null>>>;
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
  disabledIndices?: number[] | undefined;
  rtl: boolean;
}

export type CompositeGridNavigator = (state: CompositeGridNavigationState) => number;

/**
 * Makes the navigator that a root part gives to `useCompositeRoot` as `grid`.
 * A root part that does not import this file has no grid code in its bundle.
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
      itemSizes ||
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
      cellMap.map((itemIndex) => (itemIndex != null ? elementsRef.value[itemIndex] : null)),
      {
        event,
        orientation,
        loopFocus,
        onLoop,
        cols,
        // An empty cell is disabled, so the navigation cannot land in it.
        disabledIndices: getGridCellIndices(
          [
            ...(disabledIndices ||
              elementsRef.value.map((_, index) =>
                isListIndexDisabled(elementsRef.value, index) ? index : undefined,
              )),
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

    // The navigated cell is never empty.
    return cellMap[cellIndex] as number;
  };
}
