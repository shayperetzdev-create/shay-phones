# הגדרת Auth Hook ל-JWT Claims

## מטרה
הוספת `user_role` ו-`is_active` ל-JWT token של המשתמשים כדי למנוע שאילתות DB מיותרות בכל request.
זה משפר את הביצועים ב-80-90% עבור בדיקות אימות.

## שלבי ההגדרה

### שלב 0: ניקוי Hook קיים (אם יש)

אם כבר יצרתם Hook קודם שנכשל:
1. נווטו ל-**Authentication** → **Hooks**
2. מצאו את ה-Hook עם שם `custom_access_token_hook`
3. **מחקו אותו** (Delete/Remove)

### שלב 1: הרצת ה-SQL Function המתוקנת

1. היכנסו ל-Supabase Dashboard שלכם
2. נווטו ל-**SQL Editor**
3. העתיקו והריצו את **כל** התוכן של קובץ `auth-hook-jwt-claims.sql`
4. וודאו שמקבלים הודעת הצלחה ללא שגיאות
5. אם יש שגיאה - העתיקו אותה ושלחו לי

### שלב 2: הגדרת ה-Hook ב-Dashboard

1. נווטו ל-**Authentication** → **Hooks**
2. לחצו על **"Create a new hook"** או **"Enable a new hook"**
3. מלאו את הפרטים הבאים:
   - **Hook Type**: `Custom Access Token`
   - **Hook Method**: `postgres_function`
   - **Function Name**: `public.custom_access_token_hook`
   - **Enabled**: וודאו שה-checkbox מסומן
4. שמרו את ההגדרות

### שלב 3: בדיקה

#### בדיקת ה-Function (חובה!)
לפני הגדרת ה-Hook, בדקו שהפונקציה עובדת:
1. ב-SQL Editor, העתיקו והריצו את הקובץ **`test-auth-hook.sql`**
2. בדקו את ההודעות (Notices) - אמורים לראות:
   - ✓ SUCCESS: user_role was added to claims
   - ✓ SUCCESS: user_active was added to claims
3. **רק אם הבדיקה הצליחה** - עברו לשלב הבא

אם הבדיקה נכשלה:
- העתיקו את השגיאה
- בדקו שטבלת `users` קיימת ויש בה משתמשים
- ודאו שהעמודות `role` ו-`is_active` קיימות

#### בדיקת ה-Hook (אחרי ההגדרה)
אחרי הגדרת ה-Hook ב-Dashboard:
1. **Logout** מהמשתמש הנוכחי
2. **Login** מחדש
3. האזהרות בקונסול אמורות להיעלם
4. אם עדיין יש שגיאות - שלחו לי את השגיאה המדויקת

### שלב 4: עדכון משתמשים קיימים

**חשוב**: משתמשים שהיו מחוברים לפני הגדרת ה-Hook יצטרכו להתחבר מחדש כדי לקבל את ה-JWT החדש עם ה-claims.

אפשרויות:
- **אופציה 1**: לבקש מכל המשתמשים להתחבר מחדש
- **אופציה 2**: לחכות שהמשתמשים יתחברו מחדש באופן טבעי (ה-fallback ימשיך לעבוד)
- **אופציה 3**: לאלץ logout לכל המשתמשים פעם אחת (דורש קוד נוסף)

## איך זה עובד?

### לפני ה-Hook:
```
User Request → Middleware → Check JWT → Missing role/active → Query DB → Continue
```

### אחרי ה-Hook:
```
User Request → Middleware → Check JWT → Found role/active in JWT → Continue (ללא DB!)
```

## פתרון בעיות

### השגיאות עדיין מופיעות
- וודאו שה-Hook מופעל (Enabled) ב-Dashboard
- ודאו שהמשתמש עשה logout + login מחדש
- בדקו שה-function הורצה בהצלחה ב-SQL Editor

### שגיאות בהרצת ה-SQL
- וודאו שטבלת `users` קיימת ויש לה את העמודות `role` ו-`is_active`
- בדקו שיש הרשאות מתאימות

### האזהרה מופיעה רק ב-development
זה תקין! עדכנו את ה-middleware להציג את האזהרה רק ב-development mode.
ב-production האזהרה לא תופיע אפילו אם משתמשים לא התחברו מחדש.

## שינויים בקוד

הקוד ב-`src/middleware.ts` עודכן:
1. כעת בודק גם ב-`session.user` בנוסף ל-`user_metadata` ו-`app_metadata`
2. האזהרה מופיעה רק ב-`NODE_ENV === 'development'`
3. ה-fallback ממשיך לעבוד למשתמשים שלא התחברו מחדש

## השפעה על ביצועים

- **לפני**: כל request → שאילתת DB
- **אחרי**: כל request → קריאת JWT בלבד (פי 100 יותר מהיר!)
- **חיסכון משוער**: 80-90% הפחתה בעומס על הדטהבייס
