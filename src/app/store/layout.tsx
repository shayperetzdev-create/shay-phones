import { StoreSidebar } from '@/components/store/sidebar';
import { StoreHeader } from '@/components/store/header';
import { ErrorBoundary } from '@/components/error-boundary';

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
      <StoreSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <StoreHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}