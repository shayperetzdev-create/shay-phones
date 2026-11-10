# מיפוי מלא של קריאות מסד נתונים - מערכת ניהול אחריות

## תוכן עניינים

### קריאות מהקוד (Client-side)
1. [API Routes - Admin](#api-routes---admin)
2. [API Routes - Lab](#api-routes---lab)
3. [דפי Admin](#דפי-admin)
4. [דפי Store (חנות)](#דפי-store-חנות)
5. [דפי Lab (מעבדה)](#דפי-lab-מעבדה)
6. [Authentication](#authentication)

### פונקציות במסד הנתונים (Server-side)
7. [קריאות RPC](#קריאות-rpc)
   - activate_warranty, approve_replacement, reject_replacement
   - search_device_by_imei, create_replacement_request
   - get_lab_dashboard_stats, get_store_device_count
   - store_check_imei_exists, lab_check_imei_exists
8. [פונקציות עזר](#פונקציות-עזר-helper-functions)
   - get_my_role, is_admin, is_store, is_lab
   - current_user_role, get_lab_device_count
   - get_user_notification_preference, notify_admins
9. [טריגרים ופונקציות טריגר](#טריגרים-ופונקציות-טריגר)
   - קטגוריה 1: עדכון updated_at (9 טריגרים)
   - קטגוריה 2: אכיפת כללים עסקיים (4 טריגרים)
   - קטגוריה 3: התראות (5 טריגרים)
   - קטגוריה 4: ביקורת (1 טריגר)

### סיכום ותבניות
10. [סיכום כללי](#סיכום-כללי)
11. [המלצות לתחזוקה](#המלצות-לתחזוקה)

---

## API Routes - Admin

### 1. `/api/admin/labs/[id]/route.ts`

#### GET - קריאת פרטי מעבדה
**מיקום**: `src/app/api/admin/labs/[id]/route.ts:17-22`
```typescript
supabase.from('users')
  .select('id, email, full_name, phone, role, is_active')
  .eq('id', id)
  .eq('role', 'lab')
  .single()
```
- **מטרה**: קריאת פרטי מעבדה ספציפית
- **ערכים נקראים**: id, email, full_name, phone, role, is_active
- **מי מבצע**: Admin
- **תנאים**: רק משתמשים עם role='lab'

---

### 2. `/api/admin/labs/[id]/repair-prices/route.ts`

#### GET - קריאת מחירי תיקונים למעבדה
**מיקום**: `src/app/api/admin/labs/[id]/repair-prices/route.ts:17-28`
```typescript
supabase.from('lab_repair_prices')
  .select(`
    *,
    repair_types (
      id,
      name,
      description
    )
  `)
  .eq('lab_id', id)
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל מחירי התיקונים של מעבדה ספציפית
- **ערכים נקראים**: כל השדות מ-lab_repair_prices + פרטי סוג התיקון (repair_types)
- **מי מבצע**: Admin
- **יחסים**: JOIN עם טבלת repair_types

#### POST - יצירת מחיר תיקון חדש למעבדה
**מיקום**: `src/app/api/admin/labs/[id]/repair-prices/route.ts:57-68`
```typescript
supabase.from('lab_repair_prices')
  .insert({
    lab_id: id,
    repair_type_id,
    price,
    notes,
    is_active: true
  })
  .select()
  .single()
```
- **מטרה**: הוספת מחיר תיקון חדש למעבדה
- **ערכים נכתבים**: lab_id, repair_type_id, price, notes, is_active
- **מי מבצע**: Admin
- **ערכים ברירת מחדל**: is_active=true

#### PUT - עדכון מחיר תיקון קיים
**מיקום**: `src/app/api/admin/labs/[id]/repair-prices/route.ts:96-102`
```typescript
supabase.from('lab_repair_prices')
  .update({ price, is_active, notes })
  .eq('id', id)
  .eq('lab_id', labId)
  .select()
  .single()
```
- **מטרה**: עדכון פרטי מחיר תיקון קיים
- **ערכים מתעדכנים**: price, is_active, notes
- **מי מבצע**: Admin
- **תנאים**: רק מחירים השייכים למעבדה הספציפית

#### DELETE - מחיקת מחיר תיקון
**מיקום**: `src/app/api/admin/labs/[id]/repair-prices/route.ts:135-139`
```typescript
supabase.from('lab_repair_prices')
  .delete()
  .eq('id', priceId)
  .eq('lab_id', labId)
```
- **מטרה**: מחיקת מחיר תיקון של מעבדה
- **מי מבצע**: Admin
- **תנאים**: רק מחירים השייכים למעבדה הספציפית

---

### 3. `/api/admin/repair-types/route.ts`

#### GET - קריאת כל סוגי התיקונים
**מיקום**: `src/app/api/admin/repair-types/route.ts:13-16`
```typescript
supabase.from('repair_types')
  .select('*')
  .order('name')
```
- **מטרה**: שליפת כל סוגי התיקונים במערכת
- **ערכים נקראים**: כל השדות מ-repair_types
- **מי מבצע**: Admin
- **מיון**: לפי שם

#### POST - יצירת סוג תיקון חדש
**מיקום**: `src/app/api/admin/repair-types/route.ts:41-49`
```typescript
supabase.from('repair_types')
  .insert({
    name,
    description,
    is_active: true
  })
  .select()
  .single()
```
- **מטרה**: הוספת סוג תיקון חדש למערכת
- **ערכים נכתבים**: name, description, is_active
- **מי מבצע**: Admin
- **ערכים ברירת מחדל**: is_active=true

#### PUT - עדכון סוג תיקון
**מיקום**: `src/app/api/admin/repair-types/route.ts:74-79`
```typescript
supabase.from('repair_types')
  .update({ name, description, is_active })
  .eq('id', id)
  .select()
  .single()
```
- **מטרה**: עדכון פרטי סוג תיקון קיים
- **ערכים מתעדכנים**: name, description, is_active
- **מי מבצע**: Admin

#### DELETE - מחיקת סוג תיקון
**מיקום**: `src/app/api/admin/repair-types/route.ts:108-111`
```typescript
supabase.from('repair_types')
  .delete()
  .eq('id', id)
```
- **מטרה**: מחיקת סוג תיקון מהמערכת
- **מי מבצע**: Admin

---

### 4. `/api/admin/users/route.ts` - יצירת משתמש חדש

#### POST - יצירת משתמש במערכת האימות
**מיקום**: `src/app/api/admin/users/route.ts:18-27`
```typescript
supabaseService.auth.admin.createUser({
  email: data.email,
  password: data.password,
  email_confirm: true,
  user_metadata: {
    full_name: data.full_name,
    phone: data.phone,
    role: data.role,
  }
})
```
- **מטרה**: יצירת משתמש חדש במערכת האימות של Supabase
- **ערכים נכתבים**: email, password, metadata (full_name, phone, role)
- **מי מבצע**: Admin
- **הערות**: משתמש ב-service client עם הרשאות מנהל

#### POST - הוספת רשומת משתמש לטבלה הציבורית
**מיקום**: `src/app/api/admin/users/route.ts:34-46`
```typescript
supabaseService.from('users')
  .upsert({
    id: authData.user!.id,
    email: data.email,
    full_name: data.full_name,
    phone: data.phone,
    role: data.role,
    is_active: true,
  }, {
    onConflict: 'id',
    ignoreDuplicates: false
  })
```
- **מטרה**: יצירת/עדכון רשומת משתמש בטבלה הציבורית
- **ערכים נכתבים**: id, email, full_name, phone, role, is_active
- **מי מבצע**: Admin
- **הערות**: משתמש ב-upsert למניעת כפילויות אם הטריגר כבר יצר את הרשומה

---

### 5. `/api/admin/users/reset-password/route.ts`

#### POST - איפוס סיסמת משתמש
**מיקום**: `src/app/api/admin/users/reset-password/route.ts:18-24`
```typescript
supabaseService.auth.admin.updateUserById(
  userId,
  {
    password: newPassword,
    email_confirm: true
  }
)
```
- **מטרה**: שינוי סיסמת משתמש על ידי מנהל
- **ערכים מתעדכנים**: password
- **מי מבצע**: Admin
- **הערות**: משתמש ב-service client, מאשר אימייל אוטומטית

#### POST - עדכון זמן עדכון המשתמש
**מיקום**: `src/app/api/admin/users/reset-password/route.ts:30-34`
```typescript
supabaseClient.from('users')
  .update({
    updated_at: new Date().toISOString()
  })
  .eq('id', userId)
```
- **מטרה**: עדכון חותמת זמן של עדכון המשתמש
- **ערכים מתעדכנים**: updated_at
- **מי מבצע**: Admin

---

### 6. `/api/admin/users/delete/route.ts`

#### POST - מחיקת משתמש
**מיקום**: `src/app/api/admin/users/delete/route.ts:21`
```typescript
supabaseService.auth.admin.deleteUser(userId)
```
- **מטרה**: מחיקת משתמש ממערכת האימות
- **מי מבצע**: Admin
- **הערות**:
  - משתמש ב-service client
  - הרשומה בטבלת users נמחקת אוטומטית בזכות ON DELETE CASCADE

---

### 7. `/api/admin/search/route.ts` - חיפוש גלובלי

#### GET - חיפוש מכשירים
**מיקום**: `src/app/api/admin/search/route.ts:26-30`
```typescript
supabase.from('devices')
  .select('id, imei, imei2, device_models!model_id(model_name)')
  .or(`imei.ilike.%${query}%,imei2.ilike.%${query}%`)
  .limit(5)
```
- **מטרה**: חיפוש מכשירים לפי IMEI
- **ערכים נקראים**: id, imei, imei2, model_name
- **מי מבצע**: Admin
- **הגבלה**: 5 תוצאות

#### GET - חיפוש משתמשים
**מיקום**: `src/app/api/admin/search/route.ts:31-35`
```typescript
supabase.from('users')
  .select('id, full_name, email, role')
  .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
  .limit(5)
```
- **מטרה**: חיפוש משתמשים לפי שם או אימייל
- **ערכים נקראים**: id, full_name, email, role
- **מי מבצע**: Admin
- **הגבלה**: 5 תוצאות

#### GET - חיפוש תיקונים
**מיקום**: `src/app/api/admin/search/route.ts:36-40`
```typescript
supabase.from('repairs')
  .select('id, device_id')
  .ilike('id', `%${query}%`)
  .limit(5)
```
- **מטרה**: חיפוש תיקונים לפי מזהה
- **ערכים נקראים**: id, device_id
- **מי מבצע**: Admin
- **הגבלה**: 5 תוצאות

---

## API Routes - Lab

### 1. `/api/lab/repair-prices/route.ts`

#### GET - קריאת מחירי התיקונים של המעבדה
**מיקום**: `src/app/api/lab/repair-prices/route.ts:13-24`
```typescript
supabase.from('lab_repair_prices')
  .select(`
    *,
    repair_types (
      id,
      name,
      description
    )
  `)
  .eq('lab_id', auth.user.id)
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת מחירי התיקונים של המעבדה המחוברת
- **ערכים נקראים**: כל השדות + פרטי סוג התיקון
- **מי מבצע**: Lab (מעבדה)
- **הגבלה**: רק מחירים של המעבדה המחוברת

#### POST - הוספת מחיר תיקון חדש
**מיקום**: `src/app/api/lab/repair-prices/route.ts:49-59`
```typescript
supabase.from('lab_repair_prices')
  .insert({
    lab_id: auth.user.id,
    repair_type_id,
    price,
    notes,
    is_active: true
  })
  .select()
  .single()
```
- **מטרה**: הוספת מחיר תיקון חדש למעבדה המחוברת
- **ערכים נכתבים**: lab_id, repair_type_id, price, notes, is_active
- **מי מבצע**: Lab
- **הערות**: lab_id נלקח מהמשתמש המחובר

#### PUT - עדכון מחיר תיקון
**מיקום**: `src/app/api/lab/repair-prices/route.ts:84-90`
```typescript
supabase.from('lab_repair_prices')
  .update({ price, is_active, notes })
  .eq('id', id)
  .eq('lab_id', auth.user.id)
  .select()
  .single()
```
- **מטרה**: עדכון מחיר תיקון קיים
- **ערכים מתעדכנים**: price, is_active, notes
- **מי מבצע**: Lab
- **הגבלה**: רק מחירים של המעבדה המחוברת

#### DELETE - מחיקת מחיר תיקון
**מיקום**: `src/app/api/lab/repair-prices/route.ts:119-123`
```typescript
supabase.from('lab_repair_prices')
  .delete()
  .eq('id', id)
  .eq('lab_id', auth.user.id)
```
- **מטרה**: מחיקת מחיר תיקון
- **מי מבצע**: Lab
- **הגבלה**: רק מחירים של המעבדה המחוברת

---

### 2. `/api/lab/repair-types/route.ts`

#### GET - קריאת סוגי תיקונים פעילים
**מיקום**: `src/app/api/lab/repair-types/route.ts:13-17`
```typescript
supabase.from('repair_types')
  .select('*')
  .eq('is_active', true)
  .order('name')
```
- **מטרה**: שליפת סוגי תיקונים פעילים בלבד
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Lab
- **הגבלה**: רק סוגי תיקונים פעילים (is_active=true)

---

## דפי Admin

### 1. `/admin/dashboard/dashboard-client-page.tsx`

#### קריאת סטטיסטיקות מכשירים
**מיקום**: `src/app/admin/dashboard/dashboard-client-page.tsx:117`
```typescript
supabase.from('devices_with_status').select('warranty_status')
```
- **מטרה**: קריאת סטטוס אחריות של כל המכשירים
- **ערכים נקראים**: warranty_status
- **מי מבצע**: Admin
- **הערות**: משתמש ב-view מותאם

#### קריאת תיקונים פעילים
**מיקום**: `src/app/admin/dashboard/dashboard-client-page.tsx:118-121`
```typescript
supabase.from('repairs')
  .select('device_id', { count: 'exact', head: true })
  .in('status', ['received', 'in_progress'])
```
- **מטרה**: ספירת תיקונים פעילים
- **ערכים נקראים**: ספירה בלבד (count)
- **מי מבצע**: Admin
- **תנאים**: רק תיקונים בסטטוס 'received' או 'in_progress'

---

### 2. `/admin/devices/page.tsx` - ניהול מכשירים

#### קריאת סטטיסטיקות מכשירים לפי סטטוס
**מיקום**: `src/app/admin/devices/page.tsx:172-197`
```typescript
// 5 קריאות מקבילות לספירת מכשירים לפי סטטוס
supabase.from('devices_with_status')
  .select('*', { count: 'exact', head: true })
  .eq('warranty_status', 'new')  // וכן עבור כל סטטוס אחר
```
- **מטרה**: ספירת מכשירים לפי סטטוס אחריות
- **ערכים נקראים**: ספירה בלבד
- **מי מבצע**: Admin
- **סטטוסים**: new, active, expired, replaced

#### קריאת דגמי מכשירים פעילים
**מיקום**: `src/app/admin/devices/page.tsx:214-218`
```typescript
supabase.from('device_models')
  .select('model_name')
  .eq('is_active', true)
  .order('model_name')
```
- **מטרה**: שליפת רשימת דגמים פעילים לסינון
- **ערכים נקראים**: model_name
- **מי מבצע**: Admin

#### קריאת מכשירים עם סינון ו-pagination
**מיקום**: `src/app/admin/devices/page.tsx:239-276`
```typescript
supabase.from('devices_with_status')
  .select('*')
  .or(`imei.ilike.%${searchQuery}%,imei2.ilike.%${searchQuery}%,import_batch.ilike.%${searchQuery}%`)
  .eq('warranty_status', filterStatus)  // אם יש סינון
  .eq('model_id', modelId)  // אם יש סינון דגם
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת מכשירים עם סינונים
- **ערכים נקראים**: כל השדות מה-view
- **מי מבצע**: Admin
- **סינונים אופציונליים**: חיפוש טקסט, סטטוס אחריות, דגם מכשיר

#### קריאת תיקונים למכשירים
**מיקום**: `src/app/admin/devices/page.tsx:285-288`
```typescript
supabase.from('repairs')
  .select('device_id, id, status, fault_type')
  .in('device_id', deviceIds)
```
- **מטרה**: שליפת תיקונים למכשירים שהוצגו
- **ערכים נקראים**: device_id, id, status, fault_type
- **מי מבצע**: Admin
- **אופטימיזציה**: קריאה אחת לכל התיקונים במקום N קריאות

#### בדיקת IMEI כפול
**מיקום**: `src/app/admin/devices/page.tsx:451-456`
```typescript
supabase.from('devices_with_status')
  .select('*')
  .or(`imei.eq.${imei},imei2.eq.${imei2},...`)
  .limit(1)
```
- **מטרה**: בדיקה אם IMEI כבר קיים במערכת
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Admin
- **הערות**: בודק גם IMEI1 וגם IMEI2

#### חיפוש או יצירת דגם מכשיר
**מיקום**: `src/app/admin/devices/page.tsx:486-504`
```typescript
// חיפוש דגם קיים
supabase.from('device_models')
  .select('id')
  .eq('model_name', data.model.trim())
  .single()

// אם לא נמצא - יצירת דגם חדש
supabase.from('device_models')
  .insert({
    model_name: data.model.trim(),
    warranty_months: data.warranty_months,
    is_active: true
  })
  .select('id')
  .single()
```
- **מטרה**: חיפוש דגם קיים או יצירת דגם חדש
- **ערכים נכתבים**: model_name, warranty_months, is_active
- **מי מבצע**: Admin

#### הוספת מכשיר חדש
**מיקום**: `src/app/admin/devices/page.tsx:517-520`
```typescript
supabase.from('devices')
  .insert([{
    imei: data.imei,
    imei2: data.imei2 || null,
    model_id: modelId,
    import_batch: data.import_batch || null,
  }])
  .select('id')
  .single()
```
- **מטרה**: הוספת מכשיר חדש למערכת
- **ערכים נכתבים**: imei, imei2, model_id, import_batch
- **מי מבצע**: Admin

#### הוספת רשומת audit log
**מיקום**: `src/app/admin/devices/page.tsx:527-537`
```typescript
supabase.from('audit_log').insert({
  actor_user_id: user.id,
  action: 'device.create',
  entity_type: 'device',
  entity_id: newDevice.id,
  meta: {
    imei: data.imei,
    model: data.model,
    source: 'manual'
  }
})
```
- **מטרה**: רישום פעולה ביומן ביקורת
- **ערכים נכתבים**: actor_user_id, action, entity_type, entity_id, meta
- **מי מבצע**: Admin
- **הערות**: לא חוסם את הפעולה אם נכשל

#### עדכון מכשיר
**מיקום**: `src/app/admin/devices/page.tsx:606-608`
```typescript
supabase.from('devices')
  .update({
    imei: data.imei,
    imei2: data.imei2 || null,
    model_id: modelId,
    import_batch: data.import_batch || null,
  })
  .eq('id', selectedDevice.id)
```
- **מטרה**: עדכון פרטי מכשיר קיים
- **ערכים מתעדכנים**: imei, imei2, model_id, import_batch
- **מי מבצע**: Admin

#### מחיקת מכשיר
**מיקום**: `src/app/admin/devices/page.tsx:653-656`
```typescript
supabase.from('devices')
  .delete()
  .eq('id', id)
```
- **מטרה**: מחיקת מכשיר מהמערכת
- **מי מבצע**: Admin

#### ייצוא מכשירים ל-CSV
**מיקום**: `src/app/admin/devices/page.tsx:696-726`
```typescript
supabase.from('devices')
  .select(`*, device_models(*), warranties(*)`)
  .or(`imei.ilike.%${searchQuery}%,...`)
  .eq('model_id', modelData.id)  // אם יש סינון
```
- **מטרה**: ייצוא כל המכשירים (עם סינונים) לקובץ CSV
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Admin
- **הערות**: לא משתמש ב-pagination - קורא הכל

#### ייבוא מכשירים מ-CSV
**מיקום**: `src/app/admin/devices/page.tsx:936-938`
```typescript
supabase.from('devices')
  .insert(devicesToInsert)
  .select('id, imei')
```
- **מטרה**: ייבוא מרובה של מכשירים
- **ערכים נכתבים**: רשימת מכשירים (model_id, imei, imei2, import_batch)
- **מי מבצע**: Admin
- **הערות**: יכול לכלול עשרות או מאות מכשירים בבת אחת

---

### 3. `/admin/labs/page.tsx` - ניהול מעבדות

#### קריאת כל המעבדות
**מיקום**: `src/app/admin/labs/page.tsx:123-127`
```typescript
supabase.from('users')
  .select('*')
  .eq('role', 'lab')
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל המעבדות במערכת
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Admin
- **תנאים**: רק משתמשים עם role='lab'

#### קריאת סטטיסטיקות מעבדה
**מיקום**: `src/app/admin/labs/page.tsx:173-189`
```typescript
// ספירת תיקונים כוללת
supabase.from('repairs')
  .select('*', { count: 'exact', head: true })
  .eq('lab_id', lab.id)

// ספירת תיקונים פעילים
supabase.from('repairs')
  .select('*', { count: 'exact', head: true })
  .eq('lab_id', lab.id)
  .in('status', ['received', 'in_progress'])

// ספירת תיקונים שהושלמו החודש
supabase.from('repairs')
  .select('*', { count: 'exact', head: true })
  .eq('lab_id', lab.id)
  .eq('status', 'completed')
  .gte('completed_at', startOfMonth.toISOString())
```
- **מטרה**: קבלת סטטיסטיקות תיקונים למעבדה
- **ערכים נקראים**: ספירות בלבד
- **מי מבצע**: Admin
- **הערות**: 3 קריאות מקבילות למדדים שונים

#### עדכון פרטי מעבדה
**מיקום**: `src/app/admin/labs/page.tsx:252-254`
```typescript
supabase.from('users')
  .update({
    full_name: data.full_name,
    phone: data.phone,
    is_active: data.is_active,
  })
  .eq('id', selectedLab.id)
```
- **מטרה**: עדכון פרטי מעבדה
- **ערכים מתעדכנים**: full_name, phone, is_active
- **מי מבצע**: Admin

#### שינוי סטטוס מעבדה
**מיקום**: `src/app/admin/labs/page.tsx:315-317`
```typescript
supabase.from('users')
  .update({ is_active: !currentStatus })
  .eq('id', labId)
```
- **מטרה**: הפעלה/השעיה של מעבדה
- **ערכים מתעדכנים**: is_active
- **מי מבצע**: Admin

---

### 4. `/admin/stores/page.tsx` - ניהול חנויות

#### קריאת כל החנויות
**מיקום**: `src/app/admin/stores/page.tsx:125-129`
```typescript
supabase.from('users')
  .select('*')
  .eq('role', 'store')
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל החנויות במערכת
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Admin
- **תנאים**: רק משתמשים עם role='store'

#### קריאת סטטיסטיקות חנות
**מיקום**: `src/app/admin/stores/page.tsx:183-199`
```typescript
// ספירת אחריות כוללת
supabase.from('warranties')
  .select('*', { count: 'exact', head: true })
  .eq('store_id', store.id)

// ספירת אחריות פעילות
supabase.from('warranties')
  .select('*', { count: 'exact', head: true })
  .eq('store_id', store.id)
  .eq('is_active', true)
  .gt('expiry_date', now.toISOString())

// ספירת הפעלות החודש
supabase.from('warranties')
  .select('*', { count: 'exact', head: true })
  .eq('store_id', store.id)
  .gte('activation_date', startOfMonth.toISOString())
```
- **מטרה**: קבלת סטטיסטיקות אחריות לחנות
- **ערכים נקראים**: ספירות בלבד
- **מי מבצע**: Admin
- **הערות**: 3 קריאות מקבילות למדדים שונים

#### עדכון פרטי חנות
**מיקום**: `src/app/admin/stores/page.tsx:262-264`
```typescript
supabase.from('users')
  .update({
    full_name: data.full_name,
    phone: data.phone,
    is_active: data.is_active,
  })
  .eq('id', selectedStore.id)
```
- **מטרה**: עדכון פרטי חנות
- **ערכים מתעדכנים**: full_name, phone, is_active
- **מי מבצע**: Admin

---

### 5. `/admin/users/page.tsx` - ניהול משתמשים

#### אופטימיזציה - קריאת כל סטטיסטיקות חנויות בבת אחת
**מיקום**: `src/app/admin/users/page.tsx:156-159`
```typescript
supabase.from('warranties')
  .select('store_id, is_active, expiry_date, activation_date')
```
- **מטרה**: שליפת כל האחריות למניעת N+1 queries
- **ערכים נקראים**: store_id, is_active, expiry_date, activation_date
- **מי מבצע**: Admin
- **הערות**: חישוב הסטטיסטיקות נעשה בזיכרון לאחר מכן

#### אופטימיזציה - קריאת כל סטטיסטיקות מעבדות בבת אחת
**מיקום**: `src/app/admin/users/page.tsx:195-197`
```typescript
supabase.from('repairs')
  .select('lab_id, status, completed_at')
```
- **מטרה**: שליפת כל התיקונים למניעת N+1 queries
- **ערכים נקראים**: lab_id, status, completed_at
- **מי מבצע**: Admin
- **הערות**: חישוב הסטטיסטיקות נעשה בזיכרון לאחר מכן

#### קריאת כל המשתמשים
**מיקום**: `src/app/admin/users/page.tsx:242-245`
```typescript
supabase.from('users')
  .select('*')
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל המשתמשים במערכת
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Admin
- **הערות**: ללא pagination - כל המשתמשים

---

### 6. `/admin/warranties/page.tsx` - ניהול אחריות

#### קריאת כל האחריות עם יחסים
**מיקום**: `src/app/admin/warranties/page.tsx:105-115`
```typescript
supabase.from('warranties')
  .select(`
    *,
    device:devices(
      imei,
      device_model:device_models!devices_model_id_fkey(model_name)
    ),
    store:users!warranties_store_id_fkey(full_name, email)
  `)
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל האחריות עם פרטי מכשיר וחנות
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Admin
- **יחסים**: מכשיר (IMEI, דגם) וחנות (שם, אימייל)

#### קריאת מכשירים ללא אחריות
**מיקום**: `src/app/admin/warranties/page.tsx:122-125`
```typescript
supabase.from('devices_with_status')
  .select('*')
  .eq('warranty_status', 'new')
```
- **מטרה**: שליפת מכשירים זמינים להפעלת אחריות
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Admin
- **תנאים**: רק מכשירים בסטטוס 'new'

#### קריאת חנויות
**מיקום**: `src/app/admin/warranties/page.tsx:128-132`
```typescript
supabase.from('users')
  .select('id, full_name, email')
  .eq('role', 'store')
  .order('full_name', { ascending: true, nullsFirst: false })
```
- **מטרה**: שליפת רשימת חנויות לבחירה
- **ערכים נקראים**: id, full_name, email
- **מי מבצע**: Admin
- **תנאים**: רק משתמשים עם role='store'

---

### 7. `/admin/repairs/page.tsx` - ניהול תיקונים

#### קריאת כל התיקונים עם יחסים
**מיקום**: `src/app/admin/repairs/page.tsx:80-88`
```typescript
supabase.from('repairs')
  .select(`
    *,
    device:devices(imei, device_model:device_models(model_name)),
    lab:users!repairs_lab_id_fkey(full_name, email),
    warranty:warranties(customer_name, customer_phone, store:users!warranties_store_id_fkey(full_name, email))
  `)
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל התיקונים עם כל הפרטים
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Admin
- **יחסים**: מכשיר, מעבדה, אחריות (כולל חנות)

#### קריאת מעבדות
**מיקום**: `src/app/admin/repairs/page.tsx:95-98`
```typescript
supabase.from('users')
  .select('id, full_name, email')
  .eq('role', 'lab')
```
- **מטרה**: שליפת רשימת מעבדות להקצאה
- **ערכים נקראים**: id, full_name, email
- **מי מבצע**: Admin

#### הקצאת תיקון למעבדה
**מיקום**: `src/app/admin/repairs/page.tsx:199-204`
```typescript
supabase.from('repairs')
  .update({
    lab_id: selectedLabId,
    status: 'received'
  })
  .eq('id', selectedRepair.id)
```
- **מטרה**: הקצאת תיקון למעבדה
- **ערכים מתעדכנים**: lab_id, status
- **מי מבצע**: Admin

#### עדכון סטטוס תיקון
**מיקום**: `src/app/admin/repairs/page.tsx:235-238`
```typescript
supabase.from('repairs')
  .update({
    status: newStatus,
    completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined
  })
  .eq('id', repairId)
```
- **מטרה**: עדכון סטטוס תיקון
- **ערכים מתעדכנים**: status, completed_at (אם הושלם)
- **מי מבצע**: Admin

---

## דפי Store (חנות)

### 1. `/store/dashboard/page.tsx` - דשבורד חנות

#### קריאת נתוני משתמש
**מיקום**: `src/app/store/dashboard/page.tsx:105-109`
```typescript
supabase.from('users')
  .select('*')
  .eq('id', user.id)
  .single()
```
- **מטרה**: שליפת פרטי המשתמש המחובר
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Store

#### ספירת אחריות פעילות
**מיקום**: `src/app/store/dashboard/page.tsx:127-132`
```typescript
supabase.from('warranties')
  .select('*', { count: 'exact' })
  .eq('store_id', storeId)
  .eq('is_active', true)
  .gte('expiry_date', new Date().toISOString())
```
- **מטרה**: ספירת אחריות פעילות של החנות
- **ערכים נקראים**: ספירה בלבד
- **מי מבצע**: Store
- **תנאים**: רק אחריות פעילה ולא פגה

#### קריאת device_ids של החנות
**מיקום**: `src/app/store/dashboard/page.tsx:135-139`
```typescript
supabase.from('warranties')
  .select('device_id')
  .eq('store_id', storeId)
```
- **מטרה**: שליפת מזהי מכשירים שהחנות הפעילה להם אחריות
- **ערכים נקראים**: device_id
- **מי מבצע**: Store

#### ספירת בקשות החלפה ממתינות
**מיקום**: `src/app/store/dashboard/page.tsx:143-146`
```typescript
supabase.from('replacement_requests')
  .select('*', { count: 'exact' })
  .in('device_id', deviceIds)
  .eq('status', 'pending')
```
- **מטרה**: ספירת בקשות החלפה ממתינות
- **ערכים נקראים**: ספירה בלבד
- **מי מבצע**: Store
- **תנאים**: רק בקשות למכשירים של החנות ובסטטוס pending

#### ספירת הפעלות אחריות החודש
**מיקום**: `src/app/store/dashboard/page.tsx:154-158`
```typescript
supabase.from('warranties')
  .select('*', { count: 'exact' })
  .eq('store_id', storeId)
  .gte('activation_date', startOfMonth.toISOString())
```
- **מטרה**: ספירת הפעלות אחריות בחודש הנוכחי
- **ערכים נקראים**: ספירה בלבד
- **מי מבצע**: Store

#### קריאת מכשירים עם אחריות פעילה
**מיקום**: `src/app/store/dashboard/page.tsx:183-201`
```typescript
supabase.from('devices')
  .select(`
    *,
    device_models(*),
    warranties!inner(
      id,
      store_id,
      customer_name,
      customer_phone,
      activation_date,
      expiry_date,
      is_active
    )
  `)
  .eq('warranties.store_id', storeId)
  .eq('warranties.is_active', true)
  .gte('warranties.expiry_date', new Date().toISOString().split('T')[0])
```
- **מטרה**: שליפת מכשירים עם אחריות פעילה של החנות
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Store
- **תנאים**: רק מכשירים עם אחריות פעילה ולא פגה

#### קריאת בקשות החלפה
**מיקום**: `src/app/store/dashboard/page.tsx:233-240`
```typescript
supabase.from('replacement_requests')
  .select(`
    *,
    device:devices(*, device_models(*), warranties(*))
  `)
  .in('device_id', deviceIds)
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת בקשות החלפה של מכשירי החנות
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Store
- **תנאים**: רק בקשות למכשירי החנות

---

### 2. `/store/replacements/page.tsx` - בקשות החלפה

#### קריאת בקשות החלפה של החנות
**מיקום**: `src/app/store/replacements/page.tsx` (דומה לדשבורד)
```typescript
supabase.from('replacement_requests')
  .select(`
    *,
    device:devices(*, device_models(*), warranty:warranties(*)),
    repair:repairs(*, lab:users(full_name, email)),
    resolver:users(full_name)
  `)
  .in('device_id', deviceIds)
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל בקשות ההחלפה עם כל הפרטים
- **ערכים נקראים**: כל השדות + יחסים מורכבים
- **מי מבצע**: Store
- **יחסים**: מכשיר, אחריות, תיקון, מעבדה, מטפל

---

## דפי Lab (מעבדה)

### 1. `/lab/dashboard/page.tsx` - דשבורד מעבדה

#### קריאת סטטיסטיקות מעבדה באמצעות RPC
**מיקום**: `src/app/lab/dashboard/page.tsx:68`
```typescript
supabase.rpc('get_lab_dashboard_stats')
```
- **מטרה**: שליפת כל הסטטיסטיקות בקריאה אחת
- **ערכים נקראים**: כל הסטטיסטיקות (ראה פירוט ב-RPC)
- **מי מבצע**: Lab
- **הערות**: פונקציית RPC מחזירה אובייקט עם כל המדדים

#### קריאת תיקונים אחרונים
**מיקום**: `src/app/lab/dashboard/page.tsx:90-95`
```typescript
supabase.from('repairs')
  .select('*, device:devices(imei, model), warranty:warranties(customer_name, customer_phone)')
  .eq('lab_id', user.id)
  .order('created_at', { ascending: false })
  .limit(5)
```
- **מטרה**: שליפת 5 התיקונים האחרונים
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Lab
- **הגבלה**: 5 תוצאות

#### קריאת תיקונים דחופים
**מיקום**: `src/app/lab/dashboard/page.tsx:103-110`
```typescript
supabase.from('repairs')
  .select('*, device:devices(imei, model), warranty:warranties(customer_name, customer_phone)')
  .eq('lab_id', user.id)
  .in('status', ['received', 'in_progress'])
  .lt('created_at', twoDaysAgo.toISOString())
  .order('created_at', { ascending: true })
  .limit(5)
```
- **מטרה**: שליפת תיקונים דחופים (מעל 48 שעות)
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Lab
- **תנאים**: רק תיקונים פעילים ישנים מ-2 ימים
- **הגבלה**: 5 תוצאות

---

### 2. `/lab/repairs/page.tsx` - ניהול תיקונים

#### קריאת נתוני משתמש
**מיקום**: `src/app/lab/repairs/page.tsx:134-138`
```typescript
supabase.from('users')
  .select('*')
  .eq('id', user.id)
  .single()
```
- **מטרה**: שליפת פרטי המעבדה המחוברת
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Lab

#### קריאת תיקונים של המעבדה
**מיקום**: `src/app/lab/repairs/page.tsx` (דומה לדשבורד)
```typescript
supabase.from('repairs')
  .select('*, device:devices(*, device_models(*)), warranty:warranties(*, store:users(*)), repair_type:repair_types(*)')
  .eq('lab_id', labId)
  .order('created_at', { ascending: false })
```
- **מטרה**: שליפת כל התיקונים של המעבדה
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Lab
- **יחסים**: מכשיר, דגם, אחריות, חנות, סוג תיקון

#### קריאת סוגי תיקונים ומחירים
**מיקום**: `src/app/lab/repairs/page.tsx` (דומה ל-API)
```typescript
supabase.from('lab_repair_prices')
  .select('*, repair_types(*)')
  .eq('lab_id', labId)
  .eq('is_active', true)
```
- **מטרה**: שליפת מחירי התיקונים הפעילים של המעבדה
- **ערכים נקראים**: כל השדות + פרטי סוג תיקון
- **מי מבצע**: Lab

#### עדכון סטטוס תיקון
**מיקום**: `src/app/lab/repairs/page.tsx` (דומה לקוד Admin)
```typescript
supabase.from('repairs')
  .update({
    status: newStatus,
    repair_type_id: repairTypeId,
    cost: cost,
    completed_at: newStatus === 'completed' ? new Date().toISOString() : null
  })
  .eq('id', repairId)
  .eq('lab_id', currentUserId)  // וידוא שהתיקון שייך למעבדה
```
- **מטרה**: עדכון סטטוס ופרטי תיקון
- **ערכים מתעדכנים**: status, repair_type_id, cost, completed_at
- **מי מבצע**: Lab
- **הגבלה**: רק תיקונים של המעבדה הנוכחית

---

### 3. `/lab/financial/page.tsx` - דוחות כספיים

#### קריאת נתוני משתמש
**מיקום**: `src/app/lab/financial/page.tsx:91-95`
```typescript
supabase.from('users')
  .select('*')
  .eq('id', user.id)
  .single()
```
- **מטרה**: שליפת פרטי המעבדה
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Lab

#### קריאת תיקונים שהושלמו
**מיקום**: `src/app/lab/financial/page.tsx` (מעבר על חודשים)
```typescript
supabase.from('repairs')
  .select(`
    *,
    device:devices(imei, device_models(model_name)),
    warranty:warranties(customer_name, customer_phone, store:users(full_name, email))
  `)
  .eq('lab_id', labId)
  .eq('status', 'completed')
  .gte('completed_at', monthStart)
  .lt('completed_at', monthEnd)
```
- **מטרה**: שליפת תיקונים שהושלמו בחודש מסוים
- **ערכים נקראים**: כל השדות + יחסים
- **מי מבצע**: Lab
- **תנאים**: רק תיקונים שהושלמו בטווח תאריכים מסוים

#### קריאת תשלומים
**מיקום**: `src/app/lab/financial/page.tsx`
```typescript
supabase.from('payments')
  .select('*')
  .eq('lab_id', labId)
  .gte('payment_date', monthStart)
  .lt('payment_date', monthEnd)
```
- **מטרה**: שליפת תשלומים שהתקבלו בחודש
- **ערכים נקראים**: כל השדות
- **מי מבצע**: Lab

---

## קריאות RPC (Stored Procedures)

### 1. `search_device_by_imei`

**שימוש**: חיפוש מכשיר לפי IMEI עם הגבלת קצב
**מיקום דוגמה**: `src/app/admin/warranties/page.tsx:212-214`
```typescript
supabase.rpc('search_device_by_imei', {
  p_imei: trimmedIMEI,
  p_user_ip: null  // Admin ללא הגבלה
})
```

**מי מבצע**:
- Admin: ללא הגבלה (p_user_ip=null)
- Store: הגבלה של 50 חיפושים ליום לפי IP

**מה הפונקציה עושה**:
1. בודקת הגבלת קצב (rate limiting) לחנויות
2. מחפשת מכשיר לפי IMEI או IMEI2
3. מחזירה מידע מלא על המכשיר, אחריות, סטטוס
4. רושמת את החיפוש לטבלת imei_search_log

**ערכים מוחזרים**:
- success (boolean)
- message (string)
- device_data (object) - כולל את כל פרטי המכשיר, אחריות, סטטוס

---

### 2. `activate_warranty`

**שימוש**: הפעלת אחריות למכשיר
**מיקום דוגמה**: `src/app/store/dashboard/page.tsx:400-408`
```typescript
supabase.rpc('activate_warranty', {
  p_device_id: device.id,
  p_customer_name: data.customer_name,
  p_customer_phone: data.customer_phone,
  p_store_id: storeId
})
```

**מי מבצע**: Store

**מה הפונקציה עושה**:
1. בודקת שהמכשיר קיים ולא הוחלף
2. בודקת שאין אחריות פעילה למכשיר
3. יוצרת רשומת אחריות חדשה
4. מחשבת תאריך תפוגה לפי warranty_months של הדגם
5. מחזירה את מזהה האחריות שנוצרה

**ערכים נכתבים לטבלת warranties**:
- device_id
- customer_name
- customer_phone
- store_id
- activation_date (תאריך נוכחי)
- expiry_date (מחושב)
- is_active (true)

---

### 3. `create_replacement_request`

**שימוש**: יצירת בקשת החלפה למכשיר
**מיקום דוגמה**:
- Store: `src/app/store/dashboard/page.tsx:463-468`
- Lab: `src/app/lab/repairs/page.tsx:765-770`
```typescript
supabase.rpc('create_replacement_request', {
  p_device_id: deviceId,
  p_reason: reason,
  p_repair_id: repairId  // אופציונלי - רק למעבדה
})
```

**מי מבצע**:
- Store: יוצר בקשה ללא repair_id
- Lab: יוצר בקשה עם repair_id

**מה הפונקציה עושה**:
1. בודקת שהמכשיר קיים
2. בודקת שאין בקשה ממתינה קיימת
3. יוצרת רשומת replacement_request
4. מחזירה את מזהה הבקשה

**ערכים נכתבים לטבלת replacement_requests**:
- device_id
- repair_id (אם צוין)
- reason
- status ('pending')
- created_at

---

### 4. `approve_replacement`

**שימוש**: אישור בקשת החלפה
**מיקום דוגמה**: `src/app/admin/replacements/page.tsx:196-199`
```typescript
supabase.rpc('approve_replacement', {
  p_request_id: requestId,
  p_resolver_id: currentUserId
})
```

**מי מבצע**: Admin

**מה הפונקציה עושה**:
1. מעדכנת את סטטוס הבקשה ל-'approved'
2. מסמנת את המכשיר כהוחלף (is_replaced=true)
3. מבטלת את האחריות (is_active=false)
4. רושמת מי אישר ומתי

**ערכים מתעדכנים**:
- **replacement_requests**: status='approved', resolved_at, resolver_id
- **devices**: is_replaced=true, replaced_at
- **warranties**: is_active=false (לכל האחריות של המכשיר)

---

### 5. `reject_replacement`

**שימוש**: דחיית בקשת החלפה
**מיקום דוגמה**: `src/app/admin/replacements/page.tsx:224-227`
```typescript
supabase.rpc('reject_replacement', {
  p_request_id: requestId,
  p_resolver_id: currentUserId,
  p_rejection_reason: reason
})
```

**מי מבצע**: Admin

**מה הפונקציה עושה**:
1. מעדכנת את סטטוס הבקשה ל-'rejected'
2. רושמת את סיבת הדחייה
3. רושמת מי דחה ומתי

**ערכים מתעדכנים ב-replacement_requests**:
- status='rejected'
- resolved_at
- resolver_id
- rejection_reason

---

### 6. `get_lab_dashboard_stats`

**שימוש**: קבלת סטטיסטיקות מעבדה
**מיקום דוגמה**: `src/app/lab/dashboard/page.tsx:68`
```typescript
supabase.rpc('get_lab_dashboard_stats')
```

**מי מבצע**: Lab

**מה הפונקציה עושה**:
1. סופרת תיקונים פעילים (received + in_progress)
2. סופרת תיקונים שהושלמו היום
3. סופרת תיקונים שהושלמו החודש
4. מחשבת הכנסות חודשיות
5. מחשבת זמן תיקון ממוצע
6. מוצאת את סוג התקלה הנפוץ ביותר
7. מחשבת אחוז השלמה

**ערכים מוחזרים** (אובייקט):
```typescript
{
  pendingRepairs: number,
  inProgressRepairs: number,
  completedToday: number,
  monthlyCompleted: number,
  monthlyRevenue: number,
  averageRepairTime: number,
  topFaultType: string,
  completionRate: number
}
```

---

### 7. `get_store_device_count`

**שימוש**: ספירת מכשירים של חנות
**מיקום דוגמה**: `src/app/store/dashboard/page.tsx:162`
```typescript
supabase.rpc('get_store_device_count')
```

**מי מבצע**: Store

**מה הפונקציה עושה**:
- סופרת מכשירים ייחודיים שהחנות הפעילה להם אחריות

**ערך מוחזר**: מספר (number)

---

### 8. `store_check_imei_exists`

**שימוש**: בדיקה אם IMEI שייך לחנות
**תיאור**: פונקציה ייעודית לחנויות לבדיקת קיום IMEI

```typescript
supabase.rpc('store_check_imei_exists', {
  p_imei: imeiValue
})
```

**מי מבצע**: Store

**מה הפונקציה עושה**:
1. בודקת אם IMEI קיים במערכת (בשדה imei או imei2)
2. בודקת אם המכשיר שייך לחנות הנוכחית (יש לה warranty)
3. מחזירה מידע על הקשר של החנות למכשיר

**ערכים מוחזרים**:
```typescript
{
  device_exists: boolean,
  device_id: UUID | null,
  is_mine: boolean,
  message: string
}
```

**הודעות אפשריות**:
- "מכשיר לא נמצא במערכת"
- "מכשיר נמצא - שייך לחנות שלך"
- "מכשיר קיים במערכת אך לא שייך לחנות שלך"
- "אין הרשאה" (אם לא store)

---

### 9. `lab_check_imei_exists`

**שימוש**: בדיקה אם IMEI קיים וזמין לתיקון
**תיאור**: פונקציה ייעודית למעבדות לבדיקת קיום IMEI ומצב אחריות

```typescript
supabase.rpc('lab_check_imei_exists', {
  p_imei: imeiValue
})
```

**מי מבצע**: Lab

**מה הפונקציה עושה**:
1. בודקת אם IMEI קיים במערכת
2. מחזירה שם דגם ומצב אחריות
3. בודקת אם כבר קיים תיקון פעיל למכשיר
4. מחזירה מידע מפורט למעבדה

**ערכים מוחזרים**:
```typescript
{
  device_exists: boolean,
  device_id: UUID | null,
  model_name: string | null,
  has_active_warranty: boolean,
  message: string
}
```

**הודעות אפשריות**:
- "מכשיר לא נמצא"
- "כבר קיים תיקון פעיל למכשיר זה"
- "למכשיר אין אחריות פעילה"
- "מכשיר נמצא ותקין"
- "אין הרשאה" (אם לא lab)

---

## פונקציות עזר (Helper Functions)

פונקציות אלו משמשות את המערכת באופן פנימי ואינן נקראות ישירות מהקוד.
הן משמשות ב-RLS Policies, בפונקציות RPC אחרות, ובלוגיקה עסקית.

### 1. `get_my_role()`

**תיאור**: מחזירה את התפקיד של המשתמש המחובר

**חתימה**:
```sql
RETURNS TEXT
SECURITY DEFINER
```

**שימוש**:
- RLS Policies
- בדיקות הרשאות בתוך פונקציות

**דוגמה**:
```sql
SELECT get_my_role(); -- מחזיר 'admin', 'store', או 'lab'
```

**מימוש**:
```sql
SELECT role::TEXT FROM public.users WHERE id = auth.uid();
```

---

### 2. `is_admin()`

**תיאור**: בודקת אם המשתמש המחובר הוא admin

**חתימה**:
```sql
RETURNS BOOLEAN
SECURITY DEFINER
```

**שימוש**:
- RLS Policies
- בדיקות הרשאות בכל הפונקציות המוגבלות למנהל

**מימוש**:
```sql
RETURN EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()
  AND role = 'admin'
  AND is_active = true
);
```

---

### 3. `is_store()`

**תיאור**: בודקת אם המשתמש המחובר הוא store (חנות)

**חתימה**:
```sql
RETURNS BOOLEAN
SECURITY DEFINER
```

**שימוש**:
- RLS Policies עבור חנויות
- בדיקות הרשאות בפונקציות

---

### 4. `is_lab()`

**תיאור**: בודקת אם המשתמש המחובר הוא lab (מעבדה)

**חתימה**:
```sql
RETURNS BOOLEAN
SECURITY DEFINER
```

**שימוש**:
- RLS Policies עבור מעבדות
- בדיקות הרשאות בפונקציות

---

### 5. `current_user_role()`

**תיאור**: מחזירה את התפקיד של המשתמש המחובר (אלטרנטיבה ל-get_my_role)

**חתימה**:
```sql
RETURNS user_role
STABLE SECURITY DEFINER
```

**הבדל מ-get_my_role**: מחזירה טיפוס ENUM במקום TEXT

---

### 6. `get_lab_device_count()`

**תיאור**: סופרת מכשירים ייחודיים שהמעבדה תיקנה

**חתימה**:
```sql
RETURNS INTEGER
SECURITY DEFINER
```

**מי יכול להריץ**: Lab בלבד (מחזיר 0 לאחרים)

**מימוש**:
```sql
SELECT COUNT(DISTINCT r.device_id)
FROM public.repairs r
WHERE r.lab_id = auth.uid();
```

---

### 7. `get_user_notification_preference()`

**תיאור**: מחזירה העדפת התראה ספציפית של משתמש

**חתימה**:
```sql
get_user_notification_preference(
  p_user_id UUID,
  p_preference_key TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
```

**פרמטרים**:
- `p_user_id` - מזהה המשתמש
- `p_preference_key` - מפתח ההעדפה (למשל: 'emailOnRepairAssigned')

**אבטחה**:
- משתמשים יכולים לגשת רק להעדפות שלהם
- Admins יכולים לגשת להעדפות של כל משתמש

**ברירת מחדל**: true (אם ההעדפה לא נמצאה)

**שימוש**: במערכת התראות לפני שליחת אימייל

---

### 8. `notify_admins()`

**תיאור**: שולחת התראה לכל המנהלים במערכת

**חתימה**:
```sql
notify_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_excluded_user_id UUID DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
```

**פרמטרים**:
- `p_type` - סוג ההתראה
- `p_title` - כותרת ההתראה
- `p_message` - תוכן ההודעה
- `p_data` - מידע נוסף (JSON)
- `p_excluded_user_id` - מנהל שלא יקבל את ההתראה (אופציונלי)

**שימוש**: נקראת על ידי טריגרים בלבד
- ⚠️ **הרשאת EXECUTE בוטלה ממשתמשים רגילים**
- רק טריגרים ופונקציות מערכת יכולים לקרוא לה

**דוגמה**:
```sql
PERFORM notify_admins(
  'repair_new',
  'תיקון חדש נוצר',
  'תיקון חדש נוצר על ידי מעבדה למכשיר ' || v_device_imei,
  jsonb_build_object('repair_id', NEW.id, 'device_id', NEW.device_id)
);
```

---

## טריגרים ופונקציות טריגר

### סקירה כללית

המערכת משתמשת ב-18 טריגרים שמתחלקים ל-4 קטגוריות:

1. **טריגרי עדכון זמן** (9 טריגרים)
2. **טריגרי אכיפת כללים עסקיים** (4 טריגרים)
3. **טריגרי התראות** (4 טריגרים)
4. **טריגרי ביקורת** (1 טריגר)

---

### קטגוריה 1: טריגרי עדכון updated_at

#### פונקציית טריגר: `update_updated_at()`

**תיאור**: מעדכנת אוטומטית את שדה updated_at לזמן הנוכחי

**חתימה**:
```sql
RETURNS TRIGGER
LANGUAGE plpgsql
```

**מימוש**:
```sql
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
```

**טריגרים המשתמשים בפונקציה זו** (9):

| טריגר | טבלה | אירוע |
|-------|------|-------|
| `update_users_updated_at` | users | BEFORE UPDATE |
| `update_device_models_updated_at` | device_models | BEFORE UPDATE |
| `update_devices_updated_at` | devices | BEFORE UPDATE |
| `update_repair_types_updated_at` | repair_types | BEFORE UPDATE |
| `update_lab_repair_prices_updated_at` | lab_repair_prices | BEFORE UPDATE |
| `update_warranties_updated_at` | warranties | BEFORE UPDATE |
| `update_repairs_updated_at` | repairs | BEFORE UPDATE |
| `update_replacement_requests_updated_at` | replacement_requests | BEFORE UPDATE |
| `update_payments_updated_at` | payments | BEFORE UPDATE |

**דוגמת הגדרת טריגר**:
```sql
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

### קטגוריה 2: טריגרי אכיפת כללים עסקיים

#### 1. `validate_repair_cost()` + טריגר `enforce_repair_cost_trigger`

**טבלה**: repairs
**אירוע**: BEFORE INSERT OR UPDATE OF repair_type_id, lab_id, status

**תיאור**: מחשבת ומעדכנת אוטומטית את עלות התיקון

**לוגיקה**:
1. **תיקון מוגדר מראש**: אם `repair_type_id` מוגדר:
   - מחפשת מחיר ב-`lab_repair_prices` לשילוב lab_id + repair_type_id
   - מעדכנת את `cost` אוטומטית

2. **תיקון מותאם אישית**: אם `custom_repair_description` מוגדר:
   - משתמשת ב-`custom_repair_price` כ-`cost`
   - אם אין מחיר מותאם - `cost` נשאר NULL

**דוגמה**:
```sql
-- תיקון מוגדר מראש
INSERT INTO repairs (device_id, lab_id, repair_type_id, ...)
-- cost יחושב אוטומטית מ-lab_repair_prices

-- תיקון מותאם אישית
INSERT INTO repairs (device_id, lab_id, custom_repair_description, custom_repair_price, ...)
-- cost = custom_repair_price
```

**הודעות LOG**:
- `Auto-set cost to X for predefined repair_type_id Y`
- `Set cost to custom price X for custom repair "Y"`
- `No price found for repair_type_id X at lab_id Y` (WARNING)

---

#### 2. `populate_replacement_customer_details()` + טריגר

**טבלה**: replacement_requests
**אירוע**: BEFORE INSERT

**תיאור**: ממלאת אוטומטית פרטי לקוח מ-repair או warranty

**לוגיקה**:
1. אם `customer_name` או `customer_phone` חסרים:
2. מנסה למלא מ-`repairs` (אם `repair_id` מוגדר)
3. אם לא נמצא - מנסה למלא מ-`warranties` (אם `warranty_id` מוגדר)
4. משתמשת ב-COALESCE לשמירת ערכים קיימים

**דוגמה**:
```sql
-- המשתמש מספק רק device_id ו-reason
INSERT INTO replacement_requests (device_id, reason, repair_id)
VALUES (uuid_val, 'Device broken', repair_uuid);

-- הטריגר ממלא אוטומטית:
-- customer_name מה-repair
-- customer_phone מה-repair
```

---

#### 3. `prevent_warranty_date_change()` + טריגר

**טבלה**: warranties
**אירוע**: BEFORE UPDATE

**תיאור**: מונעת שינוי תאריכי אחריות לאחר יצירה

**כללים**:
1. **activation_date**: אסור לשנות בכלל
2. **expiry_date**: רק admin יכול לשנות

**חריגות שנזרקות**:
```sql
-- שינוי תאריך הפעלה
'Cannot change warranty activation date after creation'

-- שינוי תאריך תפוגה שלא על ידי admin
'Only admin can change warranty expiry date'
```

---

#### 4. `prevent_unreplace_device()` + טריגר

**טבלה**: devices
**אירוע**: BEFORE UPDATE

**תיאור**: מונעת ביטול סימון "הוחלף"

**כלל**:
- אם `is_replaced` שונה מ-TRUE ל-FALSE → חריגה

**חריגה**:
```sql
'Cannot unreplace a device that has been marked as replaced'
```

**הגיון**: אחרי שמכשיר הוחלף, אי אפשר "לבטל" את זה - זה record היסטורי

---

### קטגוריה 3: טריגרי התראות

#### 1. `handle_new_user()` + טריגר `on_auth_user_created`

**טבלה**: auth.users (טבלת Supabase Auth)
**אירוע**: AFTER INSERT

**תיאור**: יוצרת רשומה ב-public.users אוטומטית כשנוצר משתמש חדש

**לוגיקה**:
```sql
INSERT INTO public.users (id, email, full_name, phone, role, is_active, created_by)
VALUES (
  NEW.id,
  NEW.email,
  NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
  NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
  COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'store'),
  true,
  NULL
);
```

**ברירות מחדל**:
- role: 'store' (אם לא צוין)
- is_active: true

**טיפול בשגיאות**:
- הטריגר לא נכשל גם אם ההוספה נכשלת (EXCEPTION WHEN OTHERS)
- רק כותב WARNING ללוג
- זה מבטיח שיצירת המשתמש ב-auth לא תיכשל

---

#### 2. `notify_on_new_repair()` + טריגר `trigger_notify_new_repair`

**טבלה**: repairs
**אירוע**: AFTER INSERT

**תיאור**: שולחת התראה לכל המנהלים על תיקון חדש

**מידע שנשלח**:
```typescript
{
  type: 'repair_new',
  title: 'תיקון חדש נוצר',
  message: 'תיקון חדש נוצר על ידי [שם מעבדה] למכשיר [IMEI]',
  data: {
    repair_id: UUID,
    device_id: UUID,
    device_imei: string,
    lab_id: UUID,
    lab_name: string,
    fault_type: string
  }
}
```

---

#### 3. `notify_on_new_payment()` + טריגר `trigger_notify_new_payment`

**טבלה**: payments
**אירוע**: AFTER INSERT

**תיאור**: שולחת התראה לכל המנהלים על תשלום חדש

**מידע שנשלח**:
```typescript
{
  type: 'payment_new',
  title: 'תשלום חדש התקבל',
  message: 'תשלום בסך [סכום] ₪ התקבל מ-[שם מעבדה]',
  data: {
    payment_id: UUID,
    lab_id: UUID,
    lab_name: string,
    amount: number,
    payment_date: date
  }
}
```

**אופטימיזציה**: מחריג את המשתמש שיצר את התשלום (p_excluded_user_id)

---

#### 4. `notify_on_replacement_request()` + טריגר `trigger_notify_replacement_request`

**טבלה**: replacement_requests
**אירוע**: AFTER INSERT

**תיאור**: שולחת התראה לכל המנהלים על בקשת החלפה חדשה

**מידע שנשלח**:
```typescript
{
  type: 'replacement_request_new',
  title: 'בקשת החלפה חדשה',
  message: 'בקשת החלפה חדשה מ-[שם מבקש] למכשיר [IMEI]',
  data: {
    request_id: UUID,
    device_id: UUID,
    device_imei: string,
    requester_id: UUID,
    requester_name: string
  }
}
```

---

#### 5. `notify_on_replacement_status_change()` + טריגר `trigger_notify_replacement_status`

**טבלה**: replacement_requests
**אירוע**: AFTER UPDATE

**תיאור**: שולחת התראה למבקש כש-status משתנה מ-pending

**תנאי**: `OLD.status = 'pending' AND NEW.status != 'pending'`

**מידע שנשלח** (למבקש בלבד, לא למנהלים):
```typescript
{
  type: 'replacement_request_updated',
  title: 'עדכון בקשת החלפה',
  message: 'בקשת ההחלפה למכשיר [IMEI] [אושרה/נדחתה]',
  data: {
    request_id: UUID,
    device_id: UUID,
    device_imei: string,
    status: 'approved' | 'rejected',
    admin_notes: string | null
  }
}
```

**תרגום סטטוס**:
```sql
v_status_text := CASE NEW.status::TEXT
  WHEN 'approved' THEN 'אושרה'
  WHEN 'rejected' THEN 'נדחתה'
  ELSE NEW.status::TEXT
END;
```

---

### קטגוריה 4: טריגרי ביקורת

#### `audit_replacement_request_creation()` + טריגר `on_replacement_request_created`

**טבלה**: replacement_requests
**אירוע**: AFTER INSERT

**תיאור**: רושמת יצירת בקשת החלפה ביומן הביקורת

**רשומה ב-audit_log**:
```sql
INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, meta)
VALUES (
  NEW.requester_id,
  'replacement.create',
  'replacement_request',
  NEW.id,
  jsonb_build_object(
    'device_id', NEW.device_id,
    'reason', NEW.reason,
    'requester_id', NEW.requester_id
  )
);
```

**שימוש**: מעקב אחר מי יצר בקשות החלפה ומתי

---

## סיכום טריגרים

### טבלת סיכום - כל הטריגרים

| # | טריגר | טבלה | אירוע | פונקציה | מטרה |
|---|--------|------|--------|---------|------|
| 1 | on_auth_user_created | auth.users | AFTER INSERT | handle_new_user | סנכרון משתמשים |
| 2-10 | update_*_updated_at | 9 טבלאות | BEFORE UPDATE | update_updated_at | עדכון זמן |
| 11 | enforce_repair_cost_trigger | repairs | BEFORE INSERT/UPDATE | validate_repair_cost | חישוב עלות |
| 12 | populate_replacement_customer_details_trigger | replacement_requests | BEFORE INSERT | populate_replacement_customer_details | מילוי פרטי לקוח |
| 13 | prevent_warranty_date_change_trigger | warranties | BEFORE UPDATE | prevent_warranty_date_change | הגנה על תאריכים |
| 14 | prevent_unreplace_device_trigger | devices | BEFORE UPDATE | prevent_unreplace_device | מניעת ביטול החלפה |
| 15 | trigger_notify_new_repair | repairs | AFTER INSERT | notify_on_new_repair | התראה על תיקון |
| 16 | trigger_notify_new_payment | payments | AFTER INSERT | notify_on_new_payment | התראה על תשלום |
| 17 | trigger_notify_replacement_request | replacement_requests | AFTER INSERT | notify_on_replacement_request | התראה על בקשה |
| 18 | trigger_notify_replacement_status | replacement_requests | AFTER UPDATE | notify_on_replacement_status_change | התראה על עדכון |
| 19 | on_replacement_request_created | replacement_requests | AFTER INSERT | audit_replacement_request_creation | רישום ביקורת |

### זרימת אירועים - דוגמאות

#### דוגמה 1: יצירת תיקון חדש

```sql
INSERT INTO repairs (device_id, lab_id, repair_type_id, ...)
```

**טריגרים שרצים**:
1. ✅ `enforce_repair_cost_trigger` (BEFORE INSERT)
   - מחשב את cost מ-lab_repair_prices

2. ✅ `trigger_notify_new_repair` (AFTER INSERT)
   - שולח התראה לכל המנהלים

**תוצאה**: תיקון נוצר עם עלות מחושבת + מנהלים מקבלים התראה

---

#### דוגמה 2: יצירת בקשת החלפה

```sql
INSERT INTO replacement_requests (device_id, reason, repair_id)
```

**טריגרים שרצים**:
1. ✅ `populate_replacement_customer_details_trigger` (BEFORE INSERT)
   - ממלא customer_name ו-customer_phone מה-repair

2. ✅ `trigger_notify_replacement_request` (AFTER INSERT)
   - שולח התראה לכל המנהלים

3. ✅ `on_replacement_request_created` (AFTER INSERT)
   - רושם ביומן ביקורת

**תוצאה**: בקשה נוצרת עם פרטי לקוח + מנהלים מקבלים התראה + רישום ביומן

---

#### דוגמה 3: אישור בקשת החלפה (דרך RPC)

```sql
SELECT approve_replacement(request_id, admin_notes);
```

**מה קורה בפונקציה**:
```sql
UPDATE replacement_requests SET status='approved', ...
UPDATE devices SET is_replaced=true, ...
UPDATE warranties SET is_active=false ...
```

**טריגרים שרצים**:
1. ✅ `update_replacement_requests_updated_at` (BEFORE UPDATE)
2. ✅ `trigger_notify_replacement_status` (AFTER UPDATE)
   - שולח התראה **למבקש** על האישור
3. ✅ `update_devices_updated_at` (BEFORE UPDATE)
4. ✅ `prevent_unreplace_device_trigger` (BEFORE UPDATE)
   - אוכף שלא ניתן לבטל is_replaced=true
5. ✅ `update_warranties_updated_at` (BEFORE UPDATE)

**תוצאה**: בקשה מאושרת + מכשיר מסומן כהוחלף + אחריות מבוטלת + מבקש מקבל התראה

---

## Authentication

### קריאת role של משתמש אחרי התחברות
**מיקום**: `src/app/login/page.tsx:51-58`
```typescript
supabase.from('users')
  .select('role')
  .eq('id', authData.user.id)
  .single()
```
- **מטרה**: קבלת תפקיד המשתמש להפניה לדשבורד המתאים
- **ערכים נקראים**: role
- **מי מבצע**: כל משתמש מחובר
- **שימוש**: ניתוב לדשבורד המתאים (admin/store/lab)

---

## סיכום כללי

### סה"כ רכיבי מסד נתונים

#### קריאות מהקוד (Client-side)
- **247 קריאות** למסד נתונים באמצעות `.from()`
- **9 קריאות RPC** מהאפליקציה (stored procedures)
- **קריאות אימות** (auth.signInWithPassword, auth.admin.*)

#### פונקציות במסד הנתונים (Server-side)
- **8 פונקציות עזר** (Helper Functions):
  - `get_my_role()`, `is_admin()`, `is_store()`, `is_lab()`
  - `current_user_role()`, `get_lab_device_count()`
  - `get_user_notification_preference()`, `notify_admins()`

- **9 פונקציות RPC** (Business Logic):
  - `get_lab_dashboard_stats()`, `get_store_device_count()`
  - `activate_warranty()`, `approve_replacement()`, `reject_replacement()`
  - `search_device_by_imei()`, `create_replacement_request()`
  - `store_check_imei_exists()`, `lab_check_imei_exists()`

- **11 פונקציות טריגר** (Trigger Functions):
  - `update_updated_at()` - עדכון זמן
  - `validate_repair_cost()` - חישוב עלות תיקון
  - `populate_replacement_customer_details()` - מילוי פרטי לקוח
  - `prevent_warranty_date_change()` - הגנה על תאריכים
  - `prevent_unreplace_device()` - מניעת ביטול החלפה
  - `handle_new_user()` - סנכרון משתמשים חדשים
  - `notify_on_new_repair()` - התראה על תיקון חדש
  - `notify_on_new_payment()` - התראה על תשלום
  - `notify_on_replacement_request()` - התראה על בקשת החלפה
  - `notify_on_replacement_status_change()` - התראה על עדכון סטטוס
  - `audit_replacement_request_creation()` - רישום ביקורת

#### טריגרים
- **19 טריגרים** (18 פעילים + 1 על auth.users):
  - 1 טריגר סנכרון משתמשים (auth.users)
  - 9 טריגרי עדכון updated_at
  - 4 טריגרי אכיפת כללים עסקיים
  - 4 טריגרי התראות
  - 1 טריגר ביקורת

### חלוקה לפי סוגי קריאות

#### קריאות קריאה (SELECT)
- שליפת רשימות (lists) - עם pagination ו-filtering
- שליפת פרטים (details) - עם nested relations
- חיפושים (search) - IMEI, משתמשים, תיקונים
- ספירות (counts) - למדדים וסטטיסטיקות
- סטטיסטיקות (stats) - aggregations מורכבות

#### קריאות כתיבה (INSERT/UPDATE/DELETE)
- הוספת רשומות חדשות (מכשירים, תיקונים, אחריות)
- עדכון רשומות קיימות (סטטוסים, מחירים)
- מחיקת רשומות (soft delete במקומות רבים)
- עדכונים מותנים (bulk updates)

#### קריאות RPC
- **לוגיקה עסקית מורכבת**:
  - `activate_warranty()` - הפעלת אחריות עם validations
  - `approve_replacement()` - אישור החלפה + עדכונים מרובים
  - `create_replacement_request()` - יצירת בקשה עם אכיפת כללים

- **אופטימיזציות**:
  - `get_lab_dashboard_stats()` - מחשוב 8 מדדים בשאילתה אחת
  - `search_device_by_imei()` - חיפוש מורכב עם rate limiting

- **בדיקות קיום**:
  - `store_check_imei_exists()` - בדיקה ספציפית לחנויות
  - `lab_check_imei_exists()` - בדיקה ספציפית למעבדות

### תבניות ואסטרטגיות

1. **Authentication & Authorization**
   - RLS Policies על כל הטבלאות
   - פונקציות עזר (is_admin, is_store, is_lab) ל-policies
   - SECURITY DEFINER על פונקציות רגישות
   - JWT claims למניעת N+1 queries

2. **Audit Logging & Tracking**
   - טבלת audit_log למעקב אחר פעולות
   - טריגרים אוטומטיים לרישום
   - device_search_log למעקב חיפושים
   - כולל: metadata, timestamps, actor info

3. **Data Integrity & Business Rules**
   - טריגרי BEFORE לאכיפת כללים
   - constraints ברמת הטבלה
   - CASCADE/RESTRICT policies מוגדרות היטב
   - מניעת שינויים היסטוריים (prevent_unreplace)

4. **Notifications & Real-time Updates**
   - טריגרי AFTER לשליחת התראות
   - `notify_admins()` פונקציה מרכזית
   - התראות למשתמשים ספציפיים או קבוצות
   - מידע עשיר ב-JSON לכל התראה

5. **Optimizations**
   - Bulk loading של סטטיסטיקות (למניעת N+1)
   - Views מותאמות (devices_with_status, active_warranties_with_replacements)
   - RPC functions לחישובים מורכבים
   - Indexes על שדות חיפוש וסינון
   - STABLE/IMMUTABLE על פונקציות pure

6. **Data Relations**
   - Nested joins (עד 3-4 רמות עומק)
   - Foreign keys עם ON DELETE CASCADE/RESTRICT/SET NULL
   - טעינה אחידה של relations (אחת לכל הרשימה)

7. **Rate Limiting & Security**
   - `search_device_by_imei()` עם rate limiting לחנויות
   - טבלת device_search_log למעקב
   - הגבלה דינמית מטבלת settings
   - IP tracking

8. **Auto-calculations & Defaults**
   - `validate_repair_cost()` - חישוב אוטומטי של עלויות
   - `populate_replacement_customer_details()` - מילוי אוטומטי
   - `update_updated_at()` - timestamps אוטומטיים
   - ברירות מחדל חכמות (role='store', is_active=true)

### זרימת נתונים טיפוסית

```
Client Request
    ↓
API Route (authorization check)
    ↓
Supabase Client Query
    ↓
RLS Policy Check (using helper functions)
    ↓
BEFORE Triggers (validation, auto-calculation)
    ↓
Database Operation (INSERT/UPDATE/DELETE)
    ↓
AFTER Triggers (notifications, audit logging)
    ↓
Response to Client
```

### טבלת הפניה מהירה - פונקציות לפי תפקיד

| משתמש | פונקציות זמינות |
|-------|-----------------|
| **Admin** | כל הפונקציות + approve_replacement, reject_replacement |
| **Store** | activate_warranty, create_replacement_request, store_check_imei_exists, search_device_by_imei (מוגבל) |
| **Lab** | create_replacement_request, lab_check_imei_exists, get_lab_dashboard_stats |
| **System** | notify_admins, handle_new_user, כל פונקציות הטריגר |

---

## המלצות לתחזוקה

1. **מעקב אחר ביצועים**:
   - לנטר את זמני הביצוע של `get_lab_dashboard_stats()`
   - לבדוק slow queries עם pg_stat_statements
   - לוודא שה-indexes משמשים (EXPLAIN ANALYZE)

2. **אבטחה**:
   - לבדוק תקופתית RLS policies
   - לוודא ש-SECURITY DEFINER פונקציות מאובטחות
   - לבדוק הרשאות על פונקציות חדשות

3. **תיעוד**:
   - לעדכן מסמך זה כשמוסיפים פונקציות/טריגרים
   - לתעד שינויים ב-changelog
   - לשמור דוגמאות שימוש

4. **ניקיון**:
   - לנקות device_search_log תקופתית (>90 ימים)
   - לארכב audit_log ישן
   - לבדוק notifications ישנות

---

**נוצר בתאריך**: 2025-01-14
**עודכן בתאריך**: 2025-01-14
**גרסה**: 2.0 (כולל פונקציות וטריגרים)
