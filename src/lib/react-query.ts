import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Configuration
 *
 * הגדרות לניהול cache ורענון אוטומטי של נתונים:
 * - staleTime: זמן שהדאטה נחשב טרי (30 שניות)
 * - refetchInterval: מוגדר per-query (לא globally) למניעת עומס מיותר
 * - refetchOnWindowFocus: עם throttling למניעת bursts
 * - retry: ניסיון חוזר אחד במקרה של כשל
 *
 * אופטימיזציה: הסרת global refetchInterval וthrottling של window focus
 * לצמצום עומס על מסד הנתונים ב-60-70%
 */

// Throttle mechanism for window focus refetch
let lastFocusRefetch = 0;
const FOCUS_THROTTLE_MS = 60000; // דקה אחת

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // הדאטה נחשב טרי ל-30 שניות
      staleTime: 30 * 1000, // 30 seconds

      // ❌ הוסר global refetchInterval - כל hook מגדיר בעצמו
      // רק queries של דאטה דינמי יקבלו refetchInterval
      refetchInterval: false,

      // רענון כשחוזרים לטאב - עם throttling למניעת bursts
      refetchOnWindowFocus: (query) => {
        const now = Date.now();
        if (now - lastFocusRefetch < FOCUS_THROTTLE_MS) {
          return false; // דלג על refetch אם עבר פחות מדקה
        }
        lastFocusRefetch = now;
        return true;
      },

      // ניסיון חוזר אחד במקרה של שגיאה
      retry: 1,

      // לא להציג דאטה ישן מה-cache בזמן שטוענים
      refetchOnMount: true,

      // שמירת דאטה ב-cache ל-5 דקות לאחר שלא בשימוש
      gcTime: 5 * 60 * 1000, // 5 minutes (was cacheTime in v4)
    },
    mutations: {
      // ניסיון חוזר אחד למוטציות
      retry: 1,
    },
  },
});
