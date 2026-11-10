import { LabSidebar } from '@/components/lab/sidebar';
import { LabHeader } from '@/components/lab/header';
import { ErrorBoundary } from '@/components/error-boundary';

export default function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
      <LabSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <LabHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}