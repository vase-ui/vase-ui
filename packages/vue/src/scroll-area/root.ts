import { inject, type InjectionKey } from 'vue';
import type { ScrollAreaRootState } from './types';

export type Orientation = 'vertical' | 'horizontal';

/** A part that `ScrollArea.Root` reads. The properties are reactive. */
export interface ScrollAreaPart {
  readonly element: HTMLElement | null;
}

/** A scrollbar or a thumb. The properties are reactive. */
export interface ScrollAreaAxisPart extends ScrollAreaPart {
  readonly orientation: Orientation;
}

/** A press of the main button on a thumb or on a track. */
export interface ScrollAreaPress {
  readonly pointerId: number;
  readonly vertical: boolean;
  /** The client coordinate of the press on the axis. */
  readonly start: number;
  /** The scroll position at the press, and after the jump of a press on the track. */
  startPosition: number;
}

/** What `ScrollArea.Root` gives to its parts. The properties are reactive, except `touch`. */
export interface ScrollAreaForParts {
  readonly state: ScrollAreaRootState;
  readonly scrollingX: boolean;
  readonly scrollingY: boolean;
  /** The root measured its viewport one time or more. */
  readonly measured: boolean;
  /** The length of the vertical and of the horizontal thumb, in pixels. */
  readonly thumbLengths: { readonly x: number; readonly y: number };
  /** The last pointer that moved over or pressed the root is a touch. */
  readonly touch: boolean;
  readonly press: ScrollAreaPress | null;
  /** The parts that serve: the last that each list got. */
  readonly viewport: HTMLElement | null;
  scrollbar(vertical: boolean): HTMLElement | null;
  thumb(vertical: boolean): HTMLElement | null;
  /** Reads the viewport and the tracks, and writes the state, the variables and the thumbs. */
  measure(): void;
  /** Measures when the size of `element` changes. Returns the function that stops it. */
  observe(element: Element): () => void;
  /** Makes the axis scrolling until 500 ms pass with no other call. */
  scroll(vertical: boolean): void;
  /** Scrolls the viewport on the axis, and makes the axis scrolling when its position changes. */
  scrollTo(vertical: boolean, position: number): void;
  /** Starts a press and gives the pointer capture to the thumb. Returns `false` when it does not. */
  startPress(event: PointerEvent, vertical: boolean): boolean;
  endPress(): void;
  /** Each `add*` function adds a part and returns the function that removes it. */
  addViewport(part: ScrollAreaPart): () => void;
  addScrollbar(part: ScrollAreaAxisPart): () => void;
  addThumb(part: ScrollAreaAxisPart): () => void;
  addCorner(): () => void;
}

export const scrollAreaKey: InjectionKey<ScrollAreaForParts> = Symbol('scroll area');
/** What a scrollbar gives to its thumb. */
export const scrollbarKey: InjectionKey<{ readonly orientation: Orientation }> =
  Symbol('scroll area scrollbar');
/** The mark that a viewport gives to its content. */
export const viewportKey: InjectionKey<true> = Symbol('scroll area viewport');

export function injectScrollArea(part: string) {
  const root = inject(scrollAreaKey, null);
  if (!root) {
    throw new Error(`Vase UI ScrollArea: <ScrollArea.${part}> must be inside <ScrollArea.Root>.`);
  }
  return root;
}

export function injectScrollbar() {
  const scrollbar = inject(scrollbarKey, null);
  if (!scrollbar) {
    throw new Error(
      'Vase UI ScrollArea: <ScrollArea.Thumb> must be inside <ScrollArea.Scrollbar>.',
    );
  }
  return scrollbar;
}

export function injectViewport() {
  if (!inject(viewportKey, false)) {
    throw new Error(
      'Vase UI ScrollArea: <ScrollArea.Content> must be inside <ScrollArea.Viewport>.',
    );
  }
}

const present = (value: boolean) => (value ? '' : undefined);

/** The data attributes of the state of the root, the viewport, the content and a scrollbar. */
export function stateAttributes(state: ScrollAreaRootState) {
  return {
    'data-scrolling': present(state.scrolling),
    'data-has-overflow-x': present(state.hasOverflowX),
    'data-has-overflow-y': present(state.hasOverflowY),
    'data-overflow-x-start': present(state.overflowXStart),
    'data-overflow-x-end': present(state.overflowXEnd),
    'data-overflow-y-start': present(state.overflowYStart),
    'data-overflow-y-end': present(state.overflowYEnd),
  };
}

/**
 * The free length of a track: its length on its axis, less its padding and the margins of its
 * thumb. `start` is the distance from the start edge of the track to the start of the free length.
 */
export function readTrack(scrollbar: HTMLElement, thumb: HTMLElement, vertical: boolean) {
  const track = getComputedStyle(scrollbar);
  const margins = getComputedStyle(thumb);
  const px = (value: string) => parseFloat(value) || 0;
  if (vertical) {
    const start = px(track.paddingTop) + px(margins.marginTop);
    const end = px(track.paddingBottom) + px(margins.marginBottom);
    return { start, length: scrollbar.offsetHeight - start - end };
  }
  // A thumb with a set width has an over-constrained inline axis. In right-to-left, WebKit then
  // gives the used value of the end margin, so the start margin counts two times.
  const margin = px(margins.marginInlineStart);
  return {
    start: px(track.paddingInlineStart) + margin,
    length: scrollbar.offsetWidth - px(track.paddingLeft) - px(track.paddingRight) - 2 * margin,
  };
}
