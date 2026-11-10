import type { Metadata } from 'next';
import { Inter, Heebo, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';


const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const heebo = Heebo({ 
  subsets: ['hebrew'],
  variable: '--font-heebo',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'מערכת ניהול אחריות יבואן',
  description: 'מערכת מקיפה לניהול אחריות מכשירים',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="he" 
      dir="rtl" 
      suppressHydrationWarning
      className={`${inter.variable} ${heebo.variable} ${jetbrainsMono.variable}`}
    >
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}