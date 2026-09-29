import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FlowHRMS by Flowacord",
    template: "%s · FlowHRMS",
  },
  description:
    "Workforce, tasks, attendance and payroll inputs in one phone-first system.",
  icons: {
    icon: "/brand/flowhrms-favicon.svg",
    // Points at src/app/apple-icon.tsx, which renders a real PNG — Safari
    // will not take the SVG that used to be named here. Declared rather
    // than left to the file convention: naming `icons` at all disables
    // that convention, so the route would exist with nothing linking it.
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  // iOS ignores the manifest's `display` and keys off this instead. Without
  // it an installed FlowHRMS still opens inside Safari, address bar and all.
  appleWebApp: {
    capable: true,
    title: "FlowHRMS",
    // "default" keeps the status bar legible over our own header rather
    // than letting the page run underneath it.
    statusBarStyle: "default",
  },
  other: {
    // Next emits only the standardised `mobile-web-app-capable`, which iOS
    // did not honour until Safari 17.4. Pilot phones are not all new, and
    // on an older one the omission means the app installs and then opens
    // with an address bar anyway. One extra tag is cheaper than that.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#010123",
  // Lets the page reach the edges of a notched screen — and, less obviously,
  // is what makes `env(safe-area-inset-*)` report anything but 0. The
  // employee layout and --fh-layout-bottom-nav-safe-area already consume
  // those, so this is what finally engages padding we had already written.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
