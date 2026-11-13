<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderThumbState extends SliderRootState {}

export interface SliderThumbProps
  extends
    VaseUIComponentProps<SliderThumbState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<HTMLAttributes>,
      'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-valuetext' | 'tabindex'
    > {
  /**
   * Whether the thumb should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A string value forwarded to the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * Ignored when `getAriaValueText` is provided.
   */
  ariaValuetext?: string | undefined;
  /**
   * A string value forwarded to the `aria-label` attribute of the `input`.
   */
  ariaLabel?: string | undefined;
  /**
   * A string value forwarded to the `aria-labelledby` attribute of the `input`.
   */
  ariaLabelledby?: string | undefined;
  /**
   * A string value forwarded to the `aria-describedby` attribute of the `input`.
   */
  ariaDescribedby?: string | undefined;
  /**
   * A function which returns a string value for the [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) attribute of the `input`.
   */
  getAriaLabel?: ((index: number) => string) | null | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * This is important for screen reader users.
   */
  getAriaValueText?:
    ((formattedValue: string, value: number, index: number) => string) | null | undefined;
  /**
   * The index of the thumb which corresponds to the index of its value in the
   * `value` or `defaultValue` array.
   * A thumb with no `index` takes the index of its place among the thumbs.
   * Set `index` when the thumbs do not render in the order of their values, such as a thumb in an
   * async component.
   */
  index?: number | undefined;
  /**
   * Optional tab index attribute forwarded to the `input`.
   */
  tabindex?: number | string | undefined;
}
</script>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  provide,
  shallowRef,
  useAttrs,
  watch,
} from 'vue';
import type { Component } from 'vue';
import { clamp } from '../../common/clamp';
import { formatNumber } from '../../common/formatNumber';
import { useIsHydrating } from '../../common/hydration';
import { ownerWindow } from '../../common/owner';
import { contains } from '../../common/shadowDom';
import { visuallyHidden } from '../../common/visuallyHidden';
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  COMPOSITE_KEYS,
  END,
  HOME,
  PAGE_DOWN,
  PAGE_UP,
} from '../../internals/composite/composite';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useDeferredServerRender, useLabelableId } from '../../internals/labelable-provider';
import type { HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { mergeProps } from '../../merge-props';
import { matchesFocusVisible } from '../../utils/popups/element';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { valueToPercent } from '../../utils/valueToPercent';
import { useSliderRootContext } from '../root/SliderRootContext';
import type { ThumbMetadata } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { getMidpoint } from '../utils/getMidpoint';
import { getSliderValue } from '../utils/getSliderValue';
import { getDecimalPrecision, roundValueToStep } from '../utils/roundValueToStep';
import SliderThumbChildren from './SliderThumbChildren.vue';
import { SliderThumbContext } from './SliderThumbContext';
import * as SliderThumbDataAttributes from './SliderThumbDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderThumbProps>(), {
  as: 'div',
  disabled: false,
});

defineSlots<{
  default(props: { state: SliderThumbState }): unknown;
  render(props: { props: HTMLProps; state: SliderThumbState; children: Component }): unknown;
}>();

const ALL_KEYS = new Set([...COMPOSITE_KEYS, PAGE_UP, PAGE_DOWN]);

function getDefaultAriaValueText(
  values: readonly number[],
  index: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument | undefined,
): string | undefined {
  if (index < 0) {
    return undefined;
  }

  if (values.length === 2) {
    return `${formatNumber(values[index], locale, format)} ${index === 0 ? 'start' : 'end'} range`;
  }

  return format ? formatNumber(values[index], locale, format) : undefined;
}

function getNewValue(
  thumbValue: number,
  increment: number,
  direction: number,
  min: number,
  max: number,
): number {
  const value = thumbValue + increment * direction;
  const roundedValue = Number(
    value.toFixed(
      Math.max(
        getDecimalPrecision(thumbValue),
        getDecimalPrecision(increment),
        getDecimalPrecision(min),
      ),
    ),
  );
  return clamp(roundedValue, min, max);
}

type Handler = ((event: Event) => void) | Array<(event: Event) => void> | false | null | undefined;

function callHandler(handler: Handler, event: Event) {
  if (Array.isArray(handler)) {
    handler.forEach((item) => item(event));
  } else if (handler) {
    handler(event);
  }
}

const attrs = useAttrs();

const {
  active: activeIndex,
  lastUsedThumbIndex,
  controlElement,
  disabled: contextDisabled,
  validation,
  format,
  handleInputChange,
  inset,
  isArrayValue,
  labelId,
  largeStep,
  locale,
  max,
  min,
  minStepsBetweenValues,
  form,
  name,
  orientation,
  pressedThumbCenterOffsetRef,
  pressedThumbIndexRef,
  renderBeforeHydration,
  setActive,
  setIndicatorPosition,
  state: rootState,
  step,
  thumbRefs,
  values: sliderValues,
} = useSliderRootContext();

// The input binds the id of the label, and the label can come after the thumb.
useDeferredServerRender();

// Resolved here rather than in Root, since this part can hydrate later, e.g. inside Suspense.
const formatLocale = useFormatLocale(locale);

const direction = useDirection();

const isDisabled = computed(() => props.disabled || contextDisabled.value);
const range = computed(() => sliderValues.value.length > 1);
const vertical = computed(() => orientation.value === 'vertical');
const rtl = computed(() => direction.value === 'rtl');

const { setTouched, validationMode } = useFieldRootContext();

const inputElement = shallowRef<HTMLInputElement | null>(null);
const setFocused = useSetFieldFocused(isDisabled, inputElement);
let restoringFocusVisible = false;

const thumbId = useVaseUiId();
const defaultInputId = useVaseUiId();
const labelableId = useLabelableId();
const inputId = computed(() => (range.value ? defaultInputId.value : labelableId.value));

const thumbMetadata = computed<ThumbMetadata>(() => ({ inputId: inputId.value }));

const { ref: listItemRef, index: compositeIndex } = useCompositeListItem<ThumbMetadata>({
  metadata: thumbMetadata,
});

const thumbIndex = computed(() => (!range.value ? 0 : (props.index ?? compositeIndex.value)));
const last = computed(() => thumbIndex.value === sliderValues.value.length - 1);
const thumbValue = computed(() => sliderValues.value[thumbIndex.value]);
const thumbValuePercent = computed(() => valueToPercent(thumbValue.value, min.value, max.value));

const positionPercent = shallowRef<number | undefined>();
const isHydrating = useIsHydrating();

const safeLastUsedThumbIndex = computed(() =>
  lastUsedThumbIndex.value >= 0 && lastUsedThumbIndex.value < sliderValues.value.length
    ? lastUsedThumbIndex.value
    : -1,
);

// The last position and indicator edge applied.
let appliedInset: [number | undefined, number] = [undefined, -1];

function getInsetPosition() {
  const control = controlElement.value;
  const thumb = element.value;
  if (!control || !thumb) {
    return;
  }

  const thumbRect = thumb.getBoundingClientRect();
  const controlRect = control.getBoundingClientRect();

  const side = vertical.value ? 'height' : 'width';

  // A hidden control measures 0, so keep the last position until it can be measured again.
  if (!controlRect[side]) {
    return;
  }

  // the total travel distance adjusted to account for the thumb size
  const controlSize = controlRect[side] - thumbRect[side];
  // px distance from the starting edge (inline-start or bottom) to the thumb center
  const thumbOffsetFromControlEdge =
    thumbRect[side] / 2 + (controlSize * thumbValuePercent.value) / 100;
  const nextPositionPercent = (thumbOffsetFromControlEdge / controlRect[side]) * 100;
  // `min === max` has no valid position, which hides the thumb.
  const nextInsetPosition = Number.isFinite(nextPositionPercent) ? nextPositionPercent : undefined;

  // The indicator edge this thumb drives: 0 = start, 1 = end, -1 = none.
  let indicatorEdge = -1;
  if (thumbIndex.value === 0) {
    indicatorEdge = 0;
  } else if (last.value) {
    indicatorEdge = 1;
  }

  const [appliedPosition, appliedEdge] = appliedInset;
  if (nextInsetPosition === appliedPosition && indicatorEdge === appliedEdge) {
    return;
  }

  appliedInset = [nextInsetPosition, indicatorEdge];

  positionPercent.value = nextInsetPosition;

  if (indicatorEdge === 0 || indicatorEdge === 1) {
    setIndicatorPosition(indicatorEdge, nextInsetPosition);
  }
}

function measureWhenInset() {
  if (inset.value) {
    getInsetPosition();
  }
}

onMounted(measureWhenInset);
// `index` and `last` decide which indicator edge this thumb drives.
watch([inset, thumbValuePercent, thumbIndex, last], measureWhenInset, { flush: 'post' });

const zIndex = computed(() => {
  if (range.value) {
    if (activeIndex.value === thumbIndex.value) {
      return 2;
    }
    if (safeLastUsedThumbIndex.value === thumbIndex.value) {
      return 1;
    }
  } else if (activeIndex.value === thumbIndex.value) {
    return 1;
  }
  return undefined;
});

function getThumbStyle() {
  if (!inset.value && !Number.isFinite(thumbValuePercent.value)) {
    return visuallyHidden;
  }

  const startEdge = vertical.value ? 'bottom' : 'insetInlineStart';
  const crossOffsetProperty = vertical.value ? 'left' : 'top';

  return {
    position: 'absolute',
    [startEdge]: inset.value ? 'var(--position)' : `${thumbValuePercent.value}%`,
    [crossOffsetProperty]: '50%',
    translate: `${(vertical.value || !rtl.value ? -1 : 1) * 50}% ${(vertical.value ? 1 : -1) * 50}%`,
    zIndex: zIndex.value,
    ...(inset.value && {
      '--position': `${positionPercent.value ?? 0}%`,
      visibility:
        (renderBeforeHydration.value && isHydrating.value) || positionPercent.value === undefined
          ? 'hidden'
          : undefined,
    }),
  };
}

function setInputElement(value: unknown) {
  const input = value as HTMLInputElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (input === inputElement.value) {
    return;
  }
  // Another thumb can hold the ref of the field. Only this thumb clears its own input.
  if (input || validation.inputRef.value === inputElement.value) {
    validation.inputRef.value = input;
  }
  inputElement.value = input;
}

// The value that the input had after the last `input` or `change` event that the thumb handled.
// A `change` event with that value is the second event of one user action.
let handledInputValue: number | undefined;

function onNativeChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const inputValue = input.valueAsNumber;
  if (event.type === 'change' && inputValue === handledInputValue) {
    return;
  }
  handledInputValue = inputValue;

  handleInputChange(inputValue, thumbIndex.value, event);

  // A listener can cancel the change, and a parent that controls the slider can keep its value.
  // Vue writes the value only when the thumb renders again.
  void nextTick(() => {
    handledInputValue = undefined;
    if (thumbValue.value !== undefined && input.valueAsNumber !== thumbValue.value) {
      input.value = String(thumbValue.value);
    }
  });
}

function inputProps() {
  const value = thumbValue.value;
  const ariaLabel =
    typeof props.getAriaLabel === 'function'
      ? props.getAriaLabel(thumbIndex.value)
      : props.ariaLabel;

  let cssWritingMode: 'vertical-rl' | 'vertical-lr' | undefined;
  if (vertical.value) {
    cssWritingMode = rtl.value ? 'vertical-rl' : 'vertical-lr';
  }

  return mergeProps<'input'>(
    {
      'aria-label': ariaLabel,
      'aria-labelledby': props.ariaLabelledby ?? (ariaLabel == null ? labelId.value : undefined),
      'aria-describedby': props.ariaDescribedby,
      'aria-orientation': orientation.value,
      'aria-valuenow': value,
      'aria-valuetext':
        typeof props.getAriaValueText === 'function'
          ? props.getAriaValueText(
              formatNumber(value, formatLocale.value, format.value),
              value,
              thumbIndex.value,
            )
          : (props.ariaValuetext ??
            getDefaultAriaValueText(
              sliderValues.value,
              thumbIndex.value,
              format.value,
              formatLocale.value,
            )),
      disabled: isDisabled.value,
      form: form.value,
      id: inputId.value,
      max: max.value,
      min: min.value,
      name: name.value,
      onInput: onNativeChange,
      onChange: onNativeChange,
      onFocusin(event: FocusEvent) {
        const isRestoringFocusVisible = restoringFocusVisible;
        restoringFocusVisible = false;
        setActive(thumbIndex.value);
        setFocused(true);

        if (isRestoringFocusVisible) {
          event.stopPropagation();
        }
      },
      onFocusout(event: FocusEvent) {
        if (restoringFocusVisible) {
          event.stopPropagation();
          return;
        }

        setActive(-1);

        // Keep field-level blur logic from running while focus moves to another thumb
        // of the same slider, so validation doesn't commit mid-interaction.
        if (
          thumbRefs.value.some((thumb) => contains(thumb, event.relatedTarget as Element | null))
        ) {
          return;
        }

        setTouched(true);
        setFocused(false);

        if (validationMode.value === 'onBlur') {
          void validation.commit(
            getSliderValue(
              thumbValue.value,
              thumbIndex.value,
              min.value,
              max.value,
              isArrayValue.value,
              sliderValues.value,
            ),
          );
        }
      },
      onKeydown(event: KeyboardEvent) {
        if (event.defaultPrevented) {
          return;
        }

        if (!ALL_KEYS.has(event.key)) {
          return;
        }

        if (COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }

        let newValue = null;
        let keyDirection = 0;
        let increment = event.shiftKey ? largeStep.value : step.value;
        const roundedValue = roundValueToStep(thumbValue.value, step.value, min.value);
        switch (event.key) {
          case ARROW_UP:
            keyDirection = 1;
            break;
          case ARROW_RIGHT:
            keyDirection = rtl.value ? -1 : 1;
            break;
          case ARROW_DOWN:
            keyDirection = -1;
            break;
          case ARROW_LEFT:
            keyDirection = rtl.value ? 1 : -1;
            break;
          case PAGE_UP:
            increment = largeStep.value;
            keyDirection = 1;
            break;
          case PAGE_DOWN:
            increment = largeStep.value;
            keyDirection = -1;
            break;
          case END:
            newValue =
              range.value && Number.isFinite(sliderValues.value[thumbIndex.value + 1])
                ? sliderValues.value[thumbIndex.value + 1] -
                  step.value * minStepsBetweenValues.value
                : max.value;
            break;
          case HOME:
            newValue =
              range.value && Number.isFinite(sliderValues.value[thumbIndex.value - 1])
                ? sliderValues.value[thumbIndex.value - 1] +
                  step.value * minStepsBetweenValues.value
                : min.value;
            break;
          default:
            break;
        }

        if (keyDirection !== 0) {
          newValue = getNewValue(roundedValue, increment, keyDirection, min.value, max.value);
        }

        if (newValue !== null) {
          const input = event.currentTarget as HTMLInputElement;

          if (!matchesFocusVisible(input)) {
            restoringFocusVisible = true;
            input.blur();
            input.focus({
              preventScroll: true,
              // Show `:focus-visible` after keyboard interaction, even if the
              // thumb was previously focused by a pointer.
              focusVisible: true,
            } as FocusOptions);
          }

          handleInputChange(newValue, thumbIndex.value, event);
          event.preventDefault();
        }
      },
      step: step.value,
      style: {
        ...visuallyHidden,
        // So that VoiceOver's focus indicator matches the thumb's dimensions
        width: '100%',
        height: '100%',
        writingMode: cssWritingMode,
      },
      tabindex: props.tabindex,
      type: 'range',
      value: value ?? '',
    },
    (merged) => validation.getValidationProps(isDisabled.value, merged),
    {
      // The listeners of the consumer go to the input, so that `event.currentTarget` is the input.
      // The blur and the focus that restore `:focus-visible` are internal.
      onFocusin(event: FocusEvent) {
        if (!restoringFocusVisible) {
          callHandler(attrs.onFocusin as Handler, event);
        }
      },
      onFocusout(event: FocusEvent) {
        if (!restoringFocusVisible) {
          callHandler(attrs.onFocusout as Handler, event);
        }
      },
      onKeydown(event: KeyboardEvent) {
        callHandler(attrs.onKeydown as Handler, event);
      },
      ref: setInputElement,
    },
  );
}

provide(SliderThumbContext, {
  inputProps,
  // Rendered with the last thumb to ensure all preceding thumbs are already in the DOM.
  hasPrehydrationScript: computed(() => inset.value && last.value && renderBeforeHydration.value),
});

const state = computed<SliderThumbState>(() => ({
  ...rootState.value,
  disabled: isDisabled.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [listItemRef],
  props: (consumerAttrs) => {
    // The input has these listeners.
    const { onFocusin, onFocusout, onKeydown, ...elementAttrs } = consumerAttrs;
    return [
      {
        [SliderThumbDataAttributes.index]: thumbIndex.value,
        id: thumbId.value,
        onPointerdown(event: PointerEvent) {
          // Keep disabled thumbs from writing transient pointer state.
          if (isDisabled.value) {
            return;
          }

          pressedThumbIndexRef.value = thumbIndex.value;
          const midpoint = getMidpoint(event.currentTarget as HTMLElement, vertical.value);
          pressedThumbCenterOffsetRef.value =
            (vertical.value ? event.clientY : event.clientX) - midpoint;
        },
        style: getThumbStyle(),
        // The script of the server HTML writes the position to the style.
        'data-allow-mismatch':
          renderBeforeHydration.value && isHydrating.value ? 'style' : undefined,
      },
      elementAttrs,
    ];
  },
  stateAttributesMapping: sliderStateAttributesMapping,
  children: true,
});

// `KeepAlive` takes the thumb out of the document. The thumb then has no layout, so the observer
// stops until the thumb is active again.
const isDeactivated = shallowRef(false);

onDeactivated(() => {
  isDeactivated.value = true;
});

onActivated(() => {
  isDeactivated.value = false;
});

watch(
  [controlElement, element, inset, isDeactivated],
  ([control, thumb, isInset, deactivated], _previous, onCleanup) => {
    if (!isInset || !control || !thumb || deactivated) {
      return;
    }

    const ResizeObserverCtor = ownerWindow(control).ResizeObserver;
    if (typeof ResizeObserverCtor === 'function') {
      // An observer callback runs before the paint, and Vue renders in the microtask after it.
      const resizeObserver = new ResizeObserverCtor(getInsetPosition);
      resizeObserver.observe(control);
      resizeObserver.observe(thumb);
      onCleanup(() => resizeObserver.disconnect());
    }

    getInsetPosition();
  },
  { flush: 'post' },
);

defineExpose({ element, inputElement });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="SliderThumbChildren" />
  <component :is="as" v-else v-bind="elementProps()"><SliderThumbChildren><slot :state="state" /></SliderThumbChildren></component>
</template>
