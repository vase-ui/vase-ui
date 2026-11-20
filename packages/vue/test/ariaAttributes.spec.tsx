import * as DateField from '../src/date-field/index.parts';
import * as DatePicker from '../src/date-picker/index.parts';
import * as DateRangePicker from '../src/date-range-picker/index.parts';
import * as Resizable from '../src/resizable/index.parts';
import * as Slider from '../src/slider/index.parts';
import * as TimeClock from '../src/time-clock/index.parts';
import * as TimeField from '../src/time-field/index.parts';
import * as TimePicker from '../src/time-picker/index.parts';

<DateField.Root aria-labelledby="id" />;
<DateField.Root ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DateField.Root aria-labelledby={5} />;

<DatePicker.Field aria-labelledby="id" />;
<DatePicker.Field ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DatePicker.Field aria-labelledby={5} />;

<DatePicker.TimeField aria-labelledby="id" />;
<DatePicker.TimeField ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DatePicker.TimeField aria-labelledby={5} />;

<DateRangePicker.StartField aria-labelledby="id" />;
<DateRangePicker.StartField ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DateRangePicker.StartField aria-labelledby={5} />;

<DateRangePicker.EndField aria-labelledby="id" />;
<DateRangePicker.EndField ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DateRangePicker.EndField aria-labelledby={5} />;

<Slider.Root aria-labelledby="id" />;
<Slider.Root ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<Slider.Root aria-labelledby={5} />;

<Slider.Thumb aria-label="x" aria-labelledby="id" aria-describedby="id" aria-valuetext="x" />;
<Slider.Thumb ariaLabel="x" ariaLabelledby="id" ariaDescribedby="id" ariaValuetext="x" />;
// @ts-expect-error `aria-label` is a string
<Slider.Thumb aria-label={5} />;
// @ts-expect-error `aria-labelledby` is a string
<Slider.Thumb aria-labelledby={5} />;
// @ts-expect-error `aria-describedby` is a string
<Slider.Thumb aria-describedby={5} />;
// @ts-expect-error `aria-valuetext` is a string
<Slider.Thumb aria-valuetext={5} />;

<Resizable.Handle aria-valuetext="x" />;
<Resizable.Handle ariaValuetext="x" />;
// @ts-expect-error `aria-valuetext` is a string
<Resizable.Handle aria-valuetext={5} />;

<TimeClock.Face aria-label="x" aria-labelledby="id" aria-describedby="id" />;
<TimeClock.Face ariaLabel="x" ariaLabelledby="id" ariaDescribedby="id" />;
// @ts-expect-error `aria-label` is a string
<TimeClock.Face aria-label={5} />;
// @ts-expect-error `aria-labelledby` is a string
<TimeClock.Face aria-labelledby={5} />;
// @ts-expect-error `aria-describedby` is a string
<TimeClock.Face aria-describedby={5} />;

<TimeField.Root aria-labelledby="id" />;
<TimeField.Root ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<TimeField.Root aria-labelledby={5} />;

<TimePicker.Field aria-labelledby="id" />;
<TimePicker.Field ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<TimePicker.Field aria-labelledby={5} />;
