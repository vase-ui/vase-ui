<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderThumbState extends SliderRootState {}

export interface SliderThumbProps
  extends
    VaseUIComponentProps<SliderThumbState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<
        HTMLAttributes,
        'aria-describedby' | 'aria-label' | 'aria-labelledby' | 'aria-valuetext'
      >,
      'tabindex'
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
   * `modelValue` or `defaultValue` array.
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
import { computed, onScopeDispose, provide, shallowRef, useAttrs, watch } from 'vue';
import type { Component, ShallowRef } from 'vue';
import { clamp } from '../../common/clamp';
import { formatNumber } from '../../common/formatNumber';
import {
  useAriaAfterHydration,
  useHiddenValueBeforeHydration,
  useIsHydrating,
} from '../../common/hydration';
import { useResizeObserver } from '../../common/useResizeObserver';
import { contains } from '../../common/shadowDom';
import { visuallyHidden } from '../../common/visuallyHidden';
import {
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  COMPOSITE_KEYS,
  END,
  HOME,
  PAGE_DOWN,
  PAGE_UP,
} from '../../internals/composite/listIndex';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useFieldInput } from '../../internals/field-register-control';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { given } from '../../internals/givenAttributes';
import { useDeferredServerRender, useLabelableId } from '../../internals/labelable-provider';
import type { HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useFormReset } from '../../internals/useFormReset';
import { sanitizeValue } from '../../internals/useFormEntryValue';
import { useFormRestoreAsInput } from '../../internals/useFormRestore';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { mergeProps } from '../../merge-props';
import { matchesFocusVisible } from '../../utils/popups/element';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { valueToPercent } from '../../utils/valueToPercent';
import {
  SliderThumbContext,
  sliderStateAttributesMapping,
  useSliderRootContext,
} from '../root/SliderRootContext';
import type { ThumbMetadata } from '../root/SliderRootContext';
import {
  getDecimalPrecision,
  getMidpoint,
  getSliderValue,
  roundValueToStep,
} from '../utils/thumbValues';
import SliderThumbChildren from './SliderThumbChildren.vue';
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

  const value = values[index] ?? null;
  if (values.length === 2) {
    return `${formatNumber(value, locale, format)} ${index === 0 ? 'start' : 'end'} range`;
  }

  return format ? formatNumber(value, locale, format) : undefined;
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

type Handler = ((event: Event) => void) | ((event: Event) => void)[] | false | null | undefined;

function callHandler(handler: Handler, event: Event) {
  if (Array.isArray(handler)) {
    handler.forEach((item) => item(event));
  } else if (handler) {
    handler(event);
  }
}

const attrs = useAttrs();

const {
  props: rootProps,
  lastUsedThumbIndex,
  controlElement,
  disabled: contextDisabled,
  validation,
  handleInputChange,
  registerThumbInput,
  inset,
  isArrayValue,
  labelId,
  name,
  renderBeforeHydration,
  reset,
  setActive,
  setIndicatorPosition,
  state: rootState,
  thumbList,
  thumbRefs,
  values: sliderValues,
  setPressedThumb,
} = useSliderRootContext();

// The input binds the id of the label, and the label can come after the thumb.
useDeferredServerRender();

// Resolved here rather than in Root, since this part can hydrate later, e.g. inside Suspense.
const formatLocale = useFormatLocale(() => rootProps.locale);

const direction = useDirection();

const isDisabled = computed(() => props.disabled || contextDisabled.value);
const range = computed(() => sliderValues.value.length > 1);
const vertical = computed(() => rootProps.orientation === 'vertical');
const rtl = computed(() => direction.value === 'rtl');

const { setTouched, validationMode } = useFieldRootContext();

const inputElement = shallowRef<HTMLInputElement | null>(null);
const setFocused = useSetFieldFocused(isDisabled, inputElement);
let restoringFocusVisible = false;

const thumbId = useVaseUiId();
const defaultInputId = useVaseUiId();
const labelableId = useLabelableId();
const inputId = computed(() => (range.value ? defaultInputId.value : labelableId.value));

const thumbMetadata = computed<ThumbMetadata>(() => ({
  inputId: inputId.value,
  getInput: () => (inputElement.value?.isConnected ? inputElement.value : null),
}));

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const compositeIndex = useCompositeListItem<ThumbMetadata>(element, {
  list: thumbList,
  index: () => (range.value ? props.index : undefined),
  metadata: thumbMetadata,
});

const thumbIndex = computed(() => (range.value ? compositeIndex.value : 0));
const last = computed(() => thumbIndex.value === sliderValues.value.length - 1);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- A thumb that has no index yet has no value, and `valueToPercent` then gives `NaN`, as in Base UI.
const thumbValue = computed(() => sliderValues.value[thumbIndex.value]!);
const thumbValuePercent = computed(() =>
  valueToPercent(thumbValue.value, rootProps.min, rootProps.max),
);

const positionPercent = shallowRef<number | undefined>();
const isHydrating = useIsHydrating();
const ariaAfterHydration = useAriaAfterHydration();

const safeLastUsedThumbIndex = computed(() =>
  lastUsedThumbIndex.value >= 0 && lastUsedThumbIndex.value < sliderValues.value.length
    ? lastUsedThumbIndex.value
    : -1,
);

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

  positionPercent.value = nextInsetPosition;
  if (thumbIndex.value === 0) setIndicatorPosition(0, nextInsetPosition);
  else if (last.value) setIndicatorPosition(1, nextInsetPosition);
}

const { isHeld } = useKeepAliveState();
watch(
  [controlElement, element, inset, isHeld, vertical, thumbValuePercent, thumbIndex, last],
  () => {
    if (inset.value && !isHeld.value) getInsetPosition();
  },
  { flush: 'post' },
);
useResizeObserver(
  () =>
    inset.value && controlElement.value && element.value
      ? [controlElement.value, element.value]
      : [],
  getInsetPosition,
);

const zIndex = computed(() => {
  if (range.value) {
    if (rootState.value.activeThumbIndex === thumbIndex.value) {
      return 2;
    }
    if (safeLastUsedThumbIndex.value === thumbIndex.value) {
      return 1;
    }
  } else if (rootState.value.activeThumbIndex === thumbIndex.value) {
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

const giveFieldInput = useFieldInput();

function setInputElement(value: unknown) {
  const input = value as HTMLInputElement | null;
  giveFieldInput(input);
  inputElement.value = input;
}

const writesValue = useHiddenValueBeforeHydration(() => inputElement.value);

const { valueProps, renderValue } = useFormRestoreAsInput(
  inputElement,
  () => thumbValue.value ?? '',
  false,
);

// The thumb follows the reset with its own input. The composite list of the root has no thumb
// while `KeepAlive` holds the slider.
useFormReset(inputElement, reset);

function onNativeChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  handleInputChange(input.valueAsNumber, thumbIndex.value, event);

  // A listener can cancel the change, and a parent that controls the slider can keep its value.
  renderValue();
}

onScopeDispose(
  registerThumbInput({
    take() {
      const input = inputElement.value;
      // Until its take of the hydration, the input holds a value that it got before the hydration.
      if (
        !input ||
        (writesValue.value && input.value === sanitizeValue(input, String(thumbValue.value ?? '')))
      ) {
        return undefined;
      }
      return { index: thumbIndex.value, value: input.valueAsNumber };
    },
    restoreValue: renderValue,
  }),
);

function inputProps() {
  const value = thumbValue.value;
  const ariaLabel = given(
    'aria-label',
    typeof props.getAriaLabel === 'function'
      ? props.getAriaLabel(thumbIndex.value)
      : props.ariaLabel,
  );

  const merged = mergeProps<'input'>(
    {
      'aria-label': ariaLabel,
      'aria-labelledby':
        given('aria-labelledby', props.ariaLabelledby) ??
        (ariaLabel == null ? labelId.value : undefined),
      'aria-describedby': given('aria-describedby', props.ariaDescribedby),
      'aria-orientation': rootProps.orientation,
      'aria-valuenow': value,
      'aria-valuetext':
        typeof props.getAriaValueText === 'function'
          ? props.getAriaValueText(
              formatNumber(value, formatLocale.value, rootProps.format),
              value,
              thumbIndex.value,
            )
          : (props.ariaValuetext ??
            getDefaultAriaValueText(
              sliderValues.value,
              thumbIndex.value,
              rootProps.format,
              formatLocale.value,
            )),
      disabled: isDisabled.value,
      form: rootProps.form,
      id: inputId.value,
      max: rootProps.max,
      min: rootProps.min,
      name: name.value,
      onInput: onNativeChange,
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
              rootProps.min,
              rootProps.max,
              isArrayValue.value,
              sliderValues.value,
            ),
          );
        }
      },
      onKeydown(event: KeyboardEvent) {
        if (event.defaultPrevented || !ALL_KEYS.has(event.key)) {
          return;
        }

        if (COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }

        let newValue: number;

        switch (event.key) {
          case END: {
            const next = sliderValues.value[thumbIndex.value + 1];
            newValue =
              range.value && next !== undefined && Number.isFinite(next)
                ? next - rootProps.step * rootProps.minStepsBetweenValues
                : rootProps.max;
            break;
          }
          case HOME: {
            const previous = sliderValues.value[thumbIndex.value - 1];
            newValue =
              range.value && previous !== undefined && Number.isFinite(previous)
                ? previous + rootProps.step * rootProps.minStepsBetweenValues
                : rootProps.min;
            break;
          }
          default: {
            const forward =
              event.key === ARROW_UP ||
              event.key === PAGE_UP ||
              event.key === (rtl.value ? ARROW_LEFT : ARROW_RIGHT);
            const large = event.shiftKey || event.key === PAGE_UP || event.key === PAGE_DOWN;
            const rounded = roundValueToStep(thumbValue.value, rootProps.step, rootProps.min);
            newValue = getNewValue(
              rounded,
              large ? rootProps.largeStep : rootProps.step,
              forward ? 1 : -1,
              rootProps.min,
              rootProps.max,
            );
          }
        }
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
      },
      step: rootProps.step,
      style: {
        ...visuallyHidden,
        // So that VoiceOver's focus indicator matches the thumb's dimensions
        width: '100%',
        height: '100%',
        writingMode: vertical.value ? (rtl.value ? 'vertical-rl' : 'vertical-lr') : undefined,
      },
      tabindex: props.tabindex,
      type: 'range',
      ...(writesValue.value ? valueProps() : undefined),
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
    },
  );
  return {
    ...merged,
    'aria-labelledby': ariaAfterHydration(merged['aria-labelledby']),
    'aria-describedby': ariaAfterHydration(merged['aria-describedby']),
    'aria-valuetext': ariaAfterHydration(merged['aria-valuetext']),
  };
}

provide(SliderThumbContext, {
  inputProps,
  setInputElement,
  // Rendered with the last thumb to ensure all preceding thumbs are already in the DOM.
  hasPrehydrationScript: computed(() => inset.value && last.value && renderBeforeHydration.value),
});

const state = computed<SliderThumbState>(() => ({
  ...rootState.value,
  disabled: isDisabled.value,
}));

const { elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  elementRef: element,
  state,
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

          const midpoint = getMidpoint(event.currentTarget as HTMLElement, vertical.value);
          setPressedThumb(
            thumbIndex.value,
            (vertical.value ? event.clientY : event.clientX) - midpoint,
          );
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

defineExpose({ element, inputElement });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="SliderThumbChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <SliderThumbChildren><slot :state="state" /></SliderThumbChildren>
  </component>
</template>
