import { inject, type InjectionKey } from 'vue';
import { fieldStateAttributes } from '../field/control';
import type { SliderRootState } from './types';

/** A thumb, from its setup to its unmount. The properties are reactive. */
export interface SliderThumbEntry {
  /** The `index` prop. */
  readonly index: number | undefined;
  readonly element: HTMLElement | null;
  readonly input: HTMLInputElement | null;
  /** The id of its input. */
  readonly id: string;
  /** By each cause. */
  readonly disabled: boolean;
}

/** What `Slider.Root` gives to its parts. The properties are reactive. */
export interface SliderForParts {
  readonly state: SliderRootState;
  /** The thumbs, each at the index of its value. */
  readonly thumbs: readonly (SliderThumbEntry | undefined)[];
  /** The thumb whose input had the focus last. */
  readonly lastActive: SliderThumbEntry | undefined;
  readonly edge: boolean;
  readonly largeStep: number;
  readonly name: string | undefined;
  readonly form: string | undefined;
  /** The id of the input of the first thumb, when that thumb has no `id` prop. */
  readonly controlId: string;
  /** The id that names an input with no name of its own. */
  readonly labelId: string | undefined;
  readonly hasFormat: boolean;
  /** The text direction of the thumbs. */
  readonly rtl: boolean;
  /** The value as text. */
  text(value: number): string;
  /** Reads the text direction of `element` for the thumbs, and returns it. */
  readDirection(element: Element): boolean;
  /** Adds a thumb. Returns the function that removes it. */
  addThumb(thumb: SliderThumbEntry): () => void;
  /** Adds a label. Returns the function that removes it. */
  addLabel(label: { readonly id: string }): () => void;
  /**
   * A key or an `input` event: the thumb goes to `target`, to its limit at most. Commits. Returns
   * `true` when the value changed.
   */
  moveTo(index: number, target: number, reason: 'keyboard' | 'input-change', event: Event): boolean;
  /** A press or a move, by `thumbCollisionBehavior`. Returns the thumb that the press goes on with. */
  dragTo(
    index: number,
    target: number,
    reason: 'track-press' | 'drag',
    event: PointerEvent,
  ): number;
  startPress(): void;
  /** Commits the last accepted change of the press when `event` is given. */
  endPress(event?: PointerEvent): void;
  onFocus(thumb: SliderThumbEntry): void;
  onBlur(event: FocusEvent): void;
  /** A native reset of the form of an input. The root acts one time for each reset. */
  onReset(event: Event): void;
}

export const sliderKey: InjectionKey<SliderForParts> = Symbol('slider');

export function injectSlider(part: string) {
  const slider = inject(sliderKey, null);
  if (!slider) throw new Error(`Vase UI Slider: <Slider.${part}> must be inside <Slider.Root>.`);
  return slider;
}

/** The data attributes of the state, on the element of each part. */
export function stateAttributes(state: SliderRootState) {
  return {
    'data-orientation': state.orientation,
    ...fieldStateAttributes(state, state.disabled),
    // A slider always has a value.
    'data-filled': undefined,
    'data-dragging': state.dragging ? '' : undefined,
  };
}
