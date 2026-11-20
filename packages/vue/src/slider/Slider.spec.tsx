import { expectType } from '#test-utils';
import {
  Slider,
  type SliderRootChangeEventDetails,
  type SliderRootCommitEventDetails,
  type SliderRootProps,
  type SliderThumbState,
} from '@vase-ui/vue/slider';

const value: number = 25;
const array = [25];

export const single = (
  <Slider.Root modelValue={value} onValueChange={(v) => expectType<number, typeof v>(v)} />
);
export const singleDefault = (
  <Slider.Root defaultValue={25} onValueCommitted={(v) => expectType<number, typeof v>(v)} />
);
export const range = (
  <Slider.Root modelValue={array} onValueChange={(v) => expectType<number[], typeof v>(v)} />
);
export const rangeDefault = (
  <Slider.Root defaultValue={[25]} onValueCommitted={(v) => expectType<number[], typeof v>(v)} />
);
export const explicitSingle = (
  <Slider.Root<number> onValueChange={(v) => expectType<number, typeof v>(v)} />
);
export const explicitRange = (
  <Slider.Root<number[]> onValueChange={(v) => expectType<number[], typeof v>(v)} />
);

// The reason narrows the event.
export function onChange(details: SliderRootChangeEventDetails) {
  expectType<number, typeof details.activeThumbIndex>(details.activeThumbIndex);
  if (details.reason === 'keyboard') expectType<KeyboardEvent, typeof details.event>(details.event);
  if (details.reason === 'drag') expectType<PointerEvent, typeof details.event>(details.event);
  if (details.reason === 'track-press') {
    // @ts-expect-error A press gives no keyboard event.
    const event: KeyboardEvent = details.event;
    void event;
  }
}

export function onCommit(details: SliderRootCommitEventDetails) {
  if (details.reason === 'input-change') expectType<Event, typeof details.event>(details.event);
  // @ts-expect-error The details of a commit cannot cancel it.
  details.cancel();
}

// A template ref has the element of each part, and the input of a thumb.
const thumb = null as unknown as InstanceType<typeof Slider.Thumb>;
expectType<HTMLElement | null, typeof thumb.element>(thumb.element);
expectType<HTMLInputElement | null, typeof thumb.input>(thumb.input);

// The types of a part are on the part too, with the type parameter of the props.
const rangeProps = null as unknown as Slider.Root.Props<number[]>;
const thumbState = null as unknown as Slider.Thumb.State;
const changeDetails = null as unknown as Slider.Root.ChangeEventDetails;
const commitDetails = null as unknown as Slider.Root.CommitEventDetails;
expectType<SliderRootProps<number[]>, typeof rangeProps>(rangeProps);
expectType<SliderThumbState, typeof thumbState>(thumbState);
expectType<SliderRootChangeEventDetails, typeof changeDetails>(changeDetails);
expectType<SliderRootCommitEventDetails, typeof commitDetails>(commitDetails);
