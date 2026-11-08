type CardProps = {
  children: React.ReactNode;
};

export default function Card({
  children,
}: CardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
      {children}
    </div>
  );
}