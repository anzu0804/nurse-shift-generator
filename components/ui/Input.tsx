type InputProps = {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function Input({
  type = "text",
  placeholder,
  value,
  onChange,
}: InputProps) {

  return (
    <input
  type={type}
  placeholder={placeholder}
  value={value}
  onChange={onChange}
  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
/>
  );
}