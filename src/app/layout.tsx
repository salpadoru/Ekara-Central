import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ekara Central | Project Knowledge Hub",
  description: "Customer, project and intelligent knowledge management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
