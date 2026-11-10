import { Suspense } from 'react';
import AdminDashboard from './dashboard-client-page';
import { DashboardSkeleton } from '@/components/ui/loading-skeletons';

export default function Page() {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <AdminDashboard />
        </Suspense>
    )
}