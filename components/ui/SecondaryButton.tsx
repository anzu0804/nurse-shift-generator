type SecondaryButtonProps = {
  children: React.ReactNode;
};

export default function SecondaryButton({
  children,
}: SecondaryButtonProps) {
  return (
    <button className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium hover:bg-slate-100 transition">
      {children}
    </button>
  );
}