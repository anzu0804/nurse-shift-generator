type PrimaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
};

export default function PrimaryButton({
  children,
  onClick,
  type = "button",
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
    >
      {children}
    </button>
  );
}