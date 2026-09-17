import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "House Recoloring — AI Wall Painter",
  description:
    "Upload a photo of your house, and instantly recolor its walls with AI segmentation — preserving real shadows, highlights, and textures.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
