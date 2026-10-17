import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Trivu — Code debugger",
  description: "Understand and repair code errors with evidence-based validation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
