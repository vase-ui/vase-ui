import { expectType } from '#test-utils';
import { Avatar, type AvatarRootState, type ImageLoadingStatus } from '@vase-ui/vue/avatar';

// TSX cannot infer the parameter of a `v-slots` function, so the types come from the slots.
type ScopeOf<Slot> = NonNullable<Slot> extends (scope: infer Scope) => unknown ? Scope : never;
type Slots<Part extends abstract new (...args: never) => { $slots: unknown }> =
  InstanceType<Part>['$slots'];

const root = null as unknown as Slots<typeof Avatar.Root>;
const image = null as unknown as Slots<typeof Avatar.Image>;
const fallback = null as unknown as Slots<typeof Avatar.Fallback>;
expectType<{ state: AvatarRootState }, ScopeOf<typeof root.default>>(
  null as unknown as ScopeOf<typeof root.default>,
);
for (const scope of [
  null as unknown as ScopeOf<typeof root.element>,
  null as unknown as ScopeOf<typeof image.element>,
  null as unknown as ScopeOf<typeof fallback.element>,
]) {
  expectType<Record<string, unknown>, typeof scope.props>(scope.props);
  expectType<(target: unknown) => void, typeof scope.elementRef>(scope.elementRef);
  expectType<ImageLoadingStatus, typeof scope.state.imageLoadingStatus>(
    scope.state.imageLoadingStatus,
  );
}
const part = null as unknown as InstanceType<typeof Avatar.Image>;
expectType<HTMLImageElement | null, typeof part.element>(part.element);

export const imageProps = (
  <Avatar.Image
    src="avatar.png"
    srcset="avatar.png 1x, avatar@2x.png 2x"
    sizes="48px"
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
    keepMounted
    alt="Jane Doe"
    loading="lazy"
    onLoadingStatusChange={(status) => {
      expectType<ImageLoadingStatus, typeof status>(status);
    }}
  />
);

// @ts-expect-error `referrerpolicy` takes a policy of the DOM.
export const wrongPolicy = <Avatar.Image referrerpolicy="nobody" />;

// @ts-expect-error The status of `loadingStatusChange` is a string.
export const wrongListener = <Avatar.Image onLoadingStatusChange={(status: number) => status} />;

export const delay = <Avatar.Fallback delay={600} />;

// @ts-expect-error `delay` is a number of milliseconds.
export const wrongDelay = <Avatar.Fallback delay="600" />;
