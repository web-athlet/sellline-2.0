import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NextGen CRM',
  description: 'AI-natives B2B-CRM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
