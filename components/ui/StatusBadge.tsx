type StatusBadgeProps = {
  label: string;
};

export default function StatusBadge({
  label,
}: StatusBadgeProps) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
      {label}
    </span>
  );
}