# V17 – Price Required for Non-Direct Events

- For `ترويج وبيع مباشر`, sales prices continue to come automatically from `Products`.
- For every other event type, sales price fields are left blank and are required before submission.
- Competitor sales price fields are also required when the event type is not `ترويج وبيع مباشر` (including `ترويج مولات`).
- Submission performs an explicit validation and blocks saving if any required price field is empty.
- Existing prices loaded while editing a report are preserved.
- Cache/service-worker version was bumped to force the updated JavaScript to load.


### V18 — إصلاح ظهور مواد المنافس
- تم رفع إصدار الكاش إلى V18.
- تمت إضافة قراءة مباشرة وآمنة من `ProductsOfCompetitor`.
- عند فتح قائمة مبيعات المنافس، إذا كانت قائمة المتصفح فارغة يتم جلب المواد مباشرة من Google Apps Script.
- المواد الملغاة لا تظهر.
- السعر في المبيعات العادية يبقى فارغاً عندما لا يكون نوع الحدث `ترويج وبيع مباشر`.
