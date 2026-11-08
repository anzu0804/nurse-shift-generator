import { ReactNode } from "react";
import Sidebar from "./Sidebar";

type Props = {
  children: ReactNode;
};

export default function MainLayout({
  children,
}: Props) {
  return (
    <div className="flex">
      <Sidebar />

      <main className="flex-1 p-8 bg-gray-100 min-h-screen">
        {children}
      </main>
    </div>
  );
}