import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "React Component Visual Editor",
  description: "Paste React JSX, preview it, edit visually, and save.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full flex flex-col font-sans text-neutral-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
