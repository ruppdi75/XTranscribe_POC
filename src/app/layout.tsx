
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import {cn} from '@/lib/utils';
// Removed incorrect GenkitProvider import
import {Toaster} from '@/components/ui/toaster';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'XTranscribe', // Updated title
  description: 'Enhanced transcription and summarization tool with AI-powered prompt suggestions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          `${geistSans.variable} ${geistMono.variable} font-sans antialiased flex flex-col min-h-screen bg-background` // Apply base background directly
        )}
      >
        {/* Removed GenkitProvider wrapper */}
        {/* Main content area */}
        <main className="flex-grow container mx-auto px-4 py-8">
        {children}
        </main>
        <Toaster />
        {/* Footer */}
        <footer className="text-center text-muted-foreground text-sm py-4 border-t mt-auto"> {/* mt-auto pushes footer down */}
            XTranscribe - Powered by AI
        </footer>
        {/* Removed closing GenkitProvider tag */}
      </body>
    </html>
  );
}
