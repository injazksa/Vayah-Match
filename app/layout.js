import './globals.css';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'وَيَّاه · Vayah - منصة الزواج الفاخرة',
  description: 'منصة زواج حصرية للارتباط الجدي',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton dir="rtl" toastOptions={{ style: { fontFamily: 'Tajawal' } }} />
      </body>
    </html>
  );
}
