type InputProps = {
  type?: string;
  placeholder?: string;
  value?: string;
  min?: string;
  max?: string;
  step?: string;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function Input({
  type = "text",
  placeholder,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: InputProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={onChange}
      className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}