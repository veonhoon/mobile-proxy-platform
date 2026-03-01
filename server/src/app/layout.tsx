import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mobile Proxy Platform',
  description: 'Mobile proxy management dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
