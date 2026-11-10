# מבנה מסד נתונים - מערכת ניהול אחריות

**גרסה:** 2.3
**תאריך:** 2025-11-16

---

## 📋 תוכן עניינים

1. [הרחבות PostgreSQL](#הרחבות-postgresql)
2. [טיפוסי ENUM](#טיפוסי-enum)
3. [טבלאות](#טבלאות)
4. [תצוגות (Views)](#תצוגות-views)
5. [אינדקסים](#אינדקסים)

---

## הרחבות PostgreSQL

המערכת דורשת את ההרחבות הבאות:

| הרחבה | תיאור |
|-------|--------|
| `uuid-ossp` | יצירת UUID ייחודיים - משמשת לכל המפתחות הראשיים |
| `pgcrypto` | פונקציות הצפנה - משמשת לאבטחת נתונים רגישים |

---

## טיפוסי ENUM

### 1. user_role
**תפקידי משתמשים במערכת**

| ערך | תיאור |
|-----|-------|
| `admin` | מנהל מערכת |
| `store` | חנות |
| `lab` | מעבדה |

### 2. fault_type
**סוגי תקלות**

| ערך | תיאור |
|-----|-------|
| `screen` | מסך |
| `charging_port` | שקע טעינה |
| `flash` | פלאש |
| `speaker` | רמקול |
| `board` | לוח אם |
| `other` | אחר |

### 3. repair_status
**סטטוסים של תיקונים**

| ערך | תיאור |
|-----|-------|
| `received` | התקבל |
| `in_progress` | בתהליך |
| `completed` | הושלם |
| `replacement_requested` | התבקשה החלפה |
| `cancelled` | בוטל |

### 4. request_status
**סטטוסים של בקשות החלפה**

| ערך | תיאור |
|-----|-------|
| `pending` | ממתין |
| `approved` | אושר |
| `rejected` | נדחה |

---

## טבלאות

### 1. users
**משתמשי המערכת**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | - | ❌ | מזהה ייחודי (PK) |
| `email` | TEXT | - | ❌ | כתובת דואר אלקטרוני (UNIQUE) |
| `full_name` | TEXT | - | ✅ | שם מלא |
| `phone` | TEXT | - | ✅ | טלפון |
| `role` | user_role | 'store' | ❌ | תפקיד |
| `is_active` | BOOLEAN | true | ❌ | פעיל |
| `notification_preferences` | JSONB | אובייקט JSON* | ✅ | העדפות התראות |
| `created_by` | UUID | - | ✅ | נוצר על ידי |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `users_id_fkey`: קשר ל-`auth.users(id)` עם `ON DELETE CASCADE`
- `valid_email`: תבנית דואר אלקטרוני תקינה
- `valid_full_name`: אורך מינימלי 2 תווים (אם לא NULL)
- `valid_phone`: אורך מינימלי 9 תווים (אם לא NULL)
- `valid_notification_preferences`: חייב להיות אובייקט JSON (אם לא NULL)

**הערות:**
\* ברירת מחדל של `notification_preferences`:
```json
{
  "emailOnRepairAssigned": true,
  "emailOnRepairCompleted": true,
  "emailOnPaymentReceived": true,
  "emailOnWarrantyExpiring": true,
  "emailOnReplacementRequest": true
}
```

---

### 2. device_models
**דגמי מכשירים**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `model_name` | TEXT | - | ❌ | שם הדגם (UNIQUE) |
| `manufacturer` | TEXT | - | ✅ | יצרן |
| `warranty_months` | INTEGER | 12 | ❌ | תקופת אחריות (חודשים) |
| `description` | TEXT | - | ✅ | תיאור |
| `is_active` | BOOLEAN | true | ❌ | פעיל |
| `created_by` | UUID | - | ✅ | נוצר על ידי |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `device_models_created_by_fkey`: קשר ל-`auth.users(id)`
- `device_models_warranty_months_check`: בין 1 ל-36 חודשים

---

### 3. devices
**מכשירים**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `imei` | TEXT | - | ❌ | IMEI ראשי (UNIQUE) |
| `imei2` | TEXT | - | ✅ | IMEI שני (UNIQUE) |
| `model_id` | UUID | - | ❌ | מזהה הדגם (FK) |
| `warranty_months` | INTEGER | 12 | ❌ | תקופת אחריות (חודשים) - ספציפי למכשיר |
| `is_replaced` | BOOLEAN | false | ❌ | הוחלף |
| `replaced_at` | TIMESTAMPTZ | - | ✅ | תאריך החלפה |
| `imported_by` | UUID | - | ✅ | יובא על ידי |
| `import_batch` | TEXT | - | ✅ | מספר קבוצת ייבוא |
| `notes` | TEXT | - | ✅ | הערות |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `devices_model_id_fkey`: קשר ל-`device_models(id)` עם `ON DELETE RESTRICT`
- `devices_imported_by_fkey`: קשר ל-`auth.users(id)`
- `devices_imei_check`: בדיוק 15 ספרות
- `devices_imei2_check`: בדיוק 15 ספרות (אם לא NULL)
- `devices_warranty_months_check`: בין 1 ל-36 חודשים

---

### 4. repair_types
**סוגי תיקונים**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `name` | TEXT | - | ❌ | שם סוג התיקון (UNIQUE) |
| `description` | TEXT | - | ✅ | תיאור |
| `is_active` | BOOLEAN | true | ❌ | פעיל |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

---

### 5. lab_repair_prices
**מחירוני תיקונים למעבדות**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `lab_id` | UUID | - | ❌ | מזהה מעבדה (FK) |
| `repair_type_id` | UUID | - | ❌ | מזהה סוג תיקון (FK) |
| `price` | NUMERIC(10,2) | - | ❌ | מחיר |
| `is_active` | BOOLEAN | true | ❌ | פעיל |
| `notes` | TEXT | - | ✅ | הערות |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `lab_repair_prices_lab_id_repair_type_id_key`: UNIQUE על שילוב lab_id ו-repair_type_id
- `lab_repair_prices_lab_id_fkey`: קשר ל-`users(id)` עם `ON DELETE CASCADE`
- `lab_repair_prices_repair_type_id_fkey`: קשר ל-`repair_types(id)` עם `ON DELETE CASCADE`
- `lab_repair_prices_price_check`: מחיר גדול או שווה ל-0

---

### 6. warranties
**אחריות**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `device_id` | UUID | - | ❌ | מזהה מכשיר (FK) |
| `store_id` | UUID | - | ❌ | מזהה חנות (FK) |
| `customer_name` | TEXT | - | ❌ | שם לקוח |
| `customer_phone` | TEXT | - | ❌ | טלפון לקוח |
| `activation_date` | DATE | CURRENT_DATE | ❌ | תאריך הפעלה |
| `expiry_date` | DATE | - | ❌ | תאריך תפוגה |
| `is_active` | BOOLEAN | true | ❌ | פעיל |
| `activated_by` | UUID | - | ✅ | הופעל על ידי |
| `notes` | TEXT | - | ✅ | הערות |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `warranties_device_id_fkey`: קשר ל-`devices(id)` עם `ON DELETE CASCADE`
- `warranties_store_id_fkey`: קשר ל-`users(id)` עם `ON DELETE RESTRICT`
- `warranties_activated_by_fkey`: קשר ל-`auth.users(id)`
- `warranties_customer_phone_check`: 9-10 ספרות
- `warranties_customer_name_check`: אורך מינימלי 2 תווים
- `check_expiry_after_activation`: תאריך תפוגה חייב להיות אחרי תאריך הפעלה

---

### 7. repairs
**תיקונים**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `device_id` | UUID | - | ❌ | מזהה מכשיר (FK) |
| `lab_id` | UUID | - | ❌ | מזהה מעבדה (FK) |
| `warranty_id` | UUID | - | ✅ | מזהה אחריות (FK) |
| `repair_type_id` | UUID | - | ✅ | מזהה סוג תיקון (FK) |
| `customer_name` | TEXT | - | ❌ | שם לקוח |
| `customer_phone` | TEXT | - | ❌ | טלפון לקוח |
| `fault_type` | fault_type | - | ✅ | סוג תקלה |
| `fault_description` | TEXT | - | ✅ | תיאור תקלה |
| `status` | repair_status | 'received' | ❌ | סטטוס |
| `cost` | NUMERIC(10,2) | - | ✅ | עלות |
| `completed_at` | TIMESTAMPTZ | - | ✅ | תאריך השלמה |
| `created_by` | UUID | - | ✅ | נוצר על ידי |
| `notes` | TEXT | - | ✅ | הערות |
| `custom_repair_description` | TEXT | - | ✅ | תיאור תיקון מותאם אישית |
| `custom_repair_price` | NUMERIC(10,2) | - | ✅ | מחיר תיקון מותאם אישית |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `repairs_device_id_fkey`: קשר ל-`devices(id)` עם `ON DELETE CASCADE`
- `repairs_lab_id_fkey`: קשר ל-`users(id)` עם `ON DELETE RESTRICT`
- `repairs_repair_type_id_fkey`: קשר ל-`repair_types(id)` עם `ON DELETE RESTRICT`
- `repairs_warranty_id_fkey`: קשר ל-`warranties(id)` עם `ON DELETE SET NULL`
- `repairs_created_by_fkey`: קשר ל-`auth.users(id)`
- `repairs_customer_phone_check`: 9-10 ספרות
- `repairs_customer_name_check`: אורך מינימלי 2 תווים
- `repairs_cost_check`: עלות גדולה או שווה ל-0 (אם לא NULL)
- `repairs_custom_repair_price_check`: מחיר גדול או שווה ל-0 (אם לא NULL)
- `check_repair_type_or_custom`: מאפשר 3 מצבים בלבד:
  1. `repair_type_id` קיים ו-`custom_repair_description` + `custom_repair_price` הם NULL
  2. `repair_type_id` הוא NULL ו-`custom_repair_description` קיים (עם או בלי `custom_repair_price`)
  3. כל שלושת השדות NULL
- `check_completed_date`: אם סטטוס 'completed' חייב completed_at

---

### 8. replacement_requests
**בקשות החלפה**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `device_id` | UUID | - | ❌ | מזהה מכשיר (FK) |
| `warranty_id` | UUID | - | ✅ | מזהה אחריות (FK) |
| `repair_id` | UUID | - | ✅ | מזהה תיקון (FK) |
| `requester_id` | UUID | - | ❌ | מזהה מבקש (FK) |
| `customer_name` | TEXT | - | ❌ | שם לקוח |
| `customer_phone` | TEXT | - | ❌ | טלפון לקוח |
| `reason` | TEXT | - | ❌ | סיבה |
| `status` | request_status | 'pending' | ❌ | סטטוס |
| `admin_notes` | TEXT | - | ✅ | הערות מנהל |
| `resolved_by` | UUID | - | ✅ | טופל על ידי |
| `resolved_at` | TIMESTAMPTZ | - | ✅ | תאריך טיפול |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `replacement_requests_device_id_fkey`: קשר ל-`devices(id)` עם `ON DELETE CASCADE`
- `replacement_requests_warranty_id_fkey`: קשר ל-`warranties(id)` עם `ON DELETE SET NULL`
- `replacement_requests_repair_id_fkey`: קשר ל-`repairs(id)` עם `ON DELETE SET NULL`
- `replacement_requests_requester_id_fkey`: קשר ל-`users(id)` עם `ON DELETE RESTRICT`
- `replacement_requests_resolved_by_fkey`: קשר ל-`users(id)` עם `ON DELETE SET NULL`
- `check_reason_length`: אורך מינימלי 5 תווים
- `check_resolved_fields`: אם סטטוס לא 'pending' חייבים resolved_by ו-resolved_at

---

### 9. payments
**תשלומים**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `lab_id` | UUID | - | ❌ | מזהה מעבדה (FK) |
| `amount` | NUMERIC(10,2) | - | ❌ | סכום |
| `payment_date` | DATE | CURRENT_DATE | ❌ | תאריך תשלום |
| `reference` | TEXT | - | ✅ | אסמכתא |
| `notes` | TEXT | - | ✅ | הערות |
| `created_by` | UUID | - | ✅ | נוצר על ידי |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**אילוצים:**
- `payments_lab_id_fkey`: קשר ל-`users(id)` עם `ON DELETE RESTRICT`
- `payments_created_by_fkey`: קשר ל-`auth.users(id)`
- `payments_amount_check`: סכום גדול מ-0

---

### 10. device_search_log
**יומן חיפושי מכשירים**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `user_id` | UUID | - | ❌ | מזהה משתמש (FK) |
| `search_term` | TEXT | - | ❌ | מונח חיפוש |
| `device_found` | BOOLEAN | - | ❌ | מכשיר נמצא |
| `device_id` | UUID | - | ✅ | מזהה מכשיר (FK) |
| `ip_address` | INET | - | ✅ | כתובת IP |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |

**אילוצים:**
- `device_search_log_device_id_fkey`: קשר ל-`devices(id)` עם `ON DELETE SET NULL`
- `device_search_log_user_id_fkey`: קשר ל-`users(id)` עם `ON DELETE CASCADE`

---

### 11. notifications
**התראות**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `user_id` | UUID | - | ❌ | מזהה משתמש (FK) |
| `type` | TEXT | - | ❌ | סוג התראה |
| `title` | TEXT | - | ❌ | כותרת |
| `message` | TEXT | - | ❌ | הודעה |
| `data` | JSONB | '{}' | ✅ | נתונים נוספים |
| `is_read` | BOOLEAN | false | ❌ | נקרא |
| `is_opened` | BOOLEAN | false | ❌ | נפתח |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |

**סוגי התראות מותרים:**
- `replacement_request_new` - בקשת החלפה חדשה
- `replacement_request_updated` - עדכון בקשת החלפה
- `repair_new` - תיקון חדש
- `repair_updated` - עדכון תיקון
- `payment_new` - תשלום חדש
- `user_registered` - משתמש נרשם

**אילוצים:**
- `notifications_user_id_fkey`: קשר ל-`users(id)` עם `ON DELETE CASCADE`
- `notifications_type_check`: חייב להיות אחד מסוגי ההתראות המותרים

---

### 12. settings
**הגדרות מערכת**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `key` | TEXT | - | ❌ | מפתח (PK) |
| `value` | JSONB | - | ❌ | ערך |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |
| `updated_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך עדכון |

**הגדרות ברירת מחדל:**
- `imei_search_rate_limit`: `{"value": 50}` - מגבלת חיפושי IMEI ליום

---

### 13. audit_log
**יומן ביקורת**

| שדה | טיפוס | ברירת מחדל | אפשר NULL | תיאור |
|-----|--------|------------|-----------|--------|
| `id` | UUID | uuid_generate_v4() | ❌ | מזהה ייחודי (PK) |
| `actor_user_id` | UUID | - | ❌ | מזהה משתמש מבצע (FK) |
| `action` | TEXT | - | ❌ | פעולה |
| `entity_type` | TEXT | - | ❌ | סוג ישות |
| `entity_id` | TEXT | - | ❌ | מזהה ישות |
| `meta` | JSONB | - | ✅ | מטא-דאטה |
| `created_at` | TIMESTAMPTZ | NOW() | ❌ | תאריך יצירה |

**אילוצים:**
- `audit_log_actor_user_id_fkey`: קשר ל-`users(id)` עם `ON DELETE CASCADE`

---

## תצוגות (Views)

### 1. devices_imei_lookup
**חיפוש מכשירים לפי IMEI**

מציגה מידע בסיסי על מכשירים עם סטטוס אחריות ותיקון.

**עמודות:**
- `id` - מזהה מכשיר
- `imei` - IMEI ראשי
- `imei2` - IMEI שני
- `is_replaced` - הוחלף
- `model_name` - שם דגם
- `has_active_warranty` - יש אחריות פעילה
- `has_active_repair` - יש תיקון פעיל

---

### 2. devices_with_status
**מכשירים עם סטטוס**

מציגה מכשירים עם מידע על הדגם וסטטוס אחריות.

**עמודות:**
- כל עמודות `devices`
- `model_name` - שם דגם (מ-`device_models`)
- `warranty_months` - תקופת אחריות ספציפית למכשיר (מ-`devices`)
- `warranty_status` - סטטוס אחריות:
  - `replaced` - הוחלף
  - `active` - אחריות פעילה
  - `expired` - אחריות פגה
  - `new` - חדש (ללא אחריות)

---

### 3. active_warranties_with_replacements
**אחריות פעילה עם בקשות החלפה**

מציגה אחריות פעילות עם פרטים מלאים וספירת בקשות החלפה.

**עמודות:**
- `id` - מזהה אחריות
- `device_id` - מזהה מכשיר
- `store_id` - מזהה חנות
- `activation_date` - תאריך הפעלה
- `expiry_date` - תאריך תפוגה
- `is_active` - פעיל
- `customer_name` - שם לקוח
- `customer_phone` - טלפון לקוח
- `notes` - הערות
- `created_at` - תאריך יצירה
- `updated_at` - תאריך עדכון
- `imei` - IMEI מכשיר
- `is_replaced` - מכשיר הוחלף
- `model_name` - שם דגם
- `store_name` - שם חנות
- `warranty_status` - סטטוס אחריות (active/expired/cancelled)
- `pending_replacements` - מספר בקשות החלפה ממתינות
- `approved_replacements` - מספר בקשות החלפה מאושרות

---

### 4. admin_dashboard_stats
**סטטיסטיקות ללוח בקרת מנהל**

מציגה סטטיסטיקות כלליות של המערכת.

**עמודות:**
- `total_devices` - סך מכשירים (לא הוחלפו)
- `active_warranties` - אחריות פעילות
- `pending_repairs` - תיקונים ממתינים
- `pending_replacements` - בקשות החלפה ממתינות
- `total_stores` - סך חנויות פעילות
- `total_labs` - סך מעבדות פעילות

---

## אינדקסים

### טבלת users
- `idx_users_role_active` - על `role` (רק פעילים)
- `idx_users_email` - על `email`

### טבלת device_models
- `idx_device_models_active` - על `is_active` (רק פעילים)
- `idx_device_models_name` - על `model_name`

### טבלת devices
- `idx_devices_model` - על `model_id`
- `idx_devices_imei` - על `imei`
- `idx_devices_imei2` - על `imei2` (רק לא NULL)
- `idx_devices_not_replaced` - על `is_replaced` (רק false)

### טבלת repair_types
- `idx_repair_types_active` - על `is_active` (רק פעילים)

### טבלת lab_repair_prices
- `idx_lab_repair_prices_lab` - על `lab_id`
- `idx_lab_repair_prices_type` - על `repair_type_id`
- `idx_lab_repair_prices_active` - על `lab_id, repair_type_id` (רק פעילים)

### טבלת warranties
- `idx_warranties_device` - על `device_id`
- `idx_warranties_store` - על `store_id`
- `idx_warranties_active` - על `device_id, is_active` (רק פעילים)
- `idx_warranties_expiry` - על `expiry_date` (רק פעילים)

### טבלת repairs
- `idx_repairs_device` - על `device_id`
- `idx_repairs_lab` - על `lab_id`
- `idx_repairs_warranty` - על `warranty_id`
- `idx_repairs_status` - על `status`
- `idx_repairs_type` - על `repair_type_id`
- `idx_repairs_completed` - על `completed_at` (רק לא NULL)
- `idx_repairs_custom_repair` - על `custom_repair_description` (רק לא NULL)

### טבלת replacement_requests
- `idx_replacement_requests_device` - על `device_id`
- `idx_replacement_requests_requester` - על `requester_id`
- `idx_replacement_requests_status` - על `status`
- `idx_replacement_requests_pending` - על `device_id` (רק pending)

### טבלת payments
- `idx_payments_lab` - על `lab_id`
- `idx_payments_date` - על `payment_date`

### טבלת device_search_log
- `idx_search_log_user_date` - על `user_id, created_at DESC`
- `idx_search_log_date` - על `created_at DESC`

### טבלת notifications
- `idx_notifications_user_id` - על `user_id`
- `idx_notifications_created_at` - על `created_at DESC`
- `idx_notifications_unread` - על `user_id, is_read` (רק לא נקראו)
- `idx_notifications_type` - על `type`

### טבלת audit_log
- `idx_audit_log_actor` - על `actor_user_id`
- `idx_audit_log_entity` - על `entity_type, entity_id`
- `idx_audit_log_action` - על `action`
- `idx_audit_log_created_at` - על `created_at DESC`

---

## יחסים בין טבלאות

```
auth.users (Supabase)
    ↓ (1:1)
users
    ↓ (1:N)
    ├── device_models (created_by)
    ├── warranties (store_id, activated_by)
    ├── repairs (lab_id, created_by)
    ├── replacement_requests (requester_id, resolved_by)
    ├── payments (lab_id, created_by)
    ├── device_search_log (user_id)
    ├── notifications (user_id)
    └── audit_log (actor_user_id)

device_models
    ↓ (1:N)
devices
    ↓ (1:N)
    ├── warranties
    │   ↓ (1:N)
    │   └── repairs
    ├── replacement_requests
    └── device_search_log

repair_types
    ↓ (1:N)
    ├── lab_repair_prices
    └── repairs

warranties
    ↓ (1:N)
    └── replacement_requests

repairs
    ↓ (1:N)
    └── replacement_requests
```

---

## הערות חשובות

1. **UUID**: כל הטבלאות משתמשות ב-UUID כמפתח ראשי לביטחון ומדרגיות.

2. **Timestamps**: כל הטבלאות כוללות `created_at` ו-`updated_at` שמתעדכנים אוטומטית.

3. **Soft Delete**: המערכת משתמשת ב-`is_active` ולא ב-DELETE פיזי לרוב הישויות.

4. **Cascade**: מחיקות מתפשטות בצורה לוגית:
   - מחיקת משתמש ← מחיקת הנתונים שלו
   - מחיקת מכשיר ← מחיקת אחריות, תיקונים ובקשות החלפה
   - מחיקת אחריות/תיקון ← SET NULL בבקשות החלפה

5. **תיקונים מותאמים אישית**: טבלת `repairs` תומכת הן בתיקונים מוגדרים מראש (דרך `repair_type_id`) והן בתיקונים מותאמים אישית (דרך `custom_repair_description` ו-`custom_repair_price`).

6. **חיפוש IMEI**: יש מגבלת חיפוש יומית לחנויות (50 כברירת מחדל) שניתנת לשינוי בטבלת `settings`.

---

**סוף המסמך**
