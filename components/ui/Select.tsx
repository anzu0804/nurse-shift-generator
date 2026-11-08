type SelectProps = {
  children: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

export default function Select({
  children,
  value,
  onChange,
}: SelectProps) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
    >
      {children}
    </select>
  );
}