import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
  fallback: ["Inter", "sans-serif"],
});

const body = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains",
  weight: "400 500",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "Thinklessly — Record once. Run anywhere.",
    template: "%s | Thinklessly",
  },
  description:
    "Thinklessly records your clicks in a real browser, captures tables and lists as clean JSON, then runs the whole flow on demand from your dashboard or a single API call.",
  applicationName: "Thinklessly",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}