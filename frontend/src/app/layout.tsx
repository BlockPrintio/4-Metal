import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "4-metal — Trade metal assets on Cardano",
  description: "4-metal — trade synthetic gold and silver on Cardano. Powered by Charli3 oracle. Built by Blockprint.",
  authors: [{ name: "Blockprint" }],
  openGraph: {
    title: "4-metal — Trade metal assets on Cardano",
    description: "Trade synthetic gold and silver on Cardano. Powered by Charli3 oracle.",
    type: "website",
  },
  twitter: {
    card: "summary",
  },

};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
