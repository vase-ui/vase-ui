import * as DatePicker from '../src/date-picker/index.parts';
import * as DateRangePicker from '../src/date-range-picker/index.parts';
import * as OTPField from '../src/otp-field/index.parts';
import * as Resizable from '../src/resizable/index.parts';
import * as Slider from '../src/slider/index.parts';
import * as TimePicker from '../src/time-picker/index.parts';

<DatePicker.Field aria-labelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DatePicker.Field aria-labelledby={5} />;

<DatePicker.TimeField aria-labelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DatePicker.TimeField aria-labelledby={5} />;

<DateRangePicker.StartField aria-labelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DateRangePicker.StartField aria-labelledby={5} />;

<DateRangePicker.EndField aria-labelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<DateRangePicker.EndField aria-labelledby={5} />;

<OTPField.Root length={6} aria-labelledby="id" />;
<OTPField.Root length={6} ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<OTPField.Root length={6} aria-labelledby={5} />;

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

<TimePicker.Field aria-labelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<TimePicker.Field aria-labelledby={5} />;
