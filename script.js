// ===================================================================
//   script.js - النسخة النهائية مع إصلاح مشكلة تفريغ الحقول
// ===================================================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwOVgwAois_WRzX6DOYufwrLm_2VUy5TOQvTTsM6EP5juBkbBM5J9WUdTPDqGNXf2k/exec";
const CACHE_DURATION_MINUTES = 1440;
const FORM_STATE_KEY = 'reportFormLastState'; 
const EDIT_STATE_KEY = 'reportToEdit';

let originalCreatedAt = null; 

// ===================================================================
//                     OFFLINE-FIRST STORAGE
// ===================================================================
const OFFLINE_DB_NAME = 'festivalOfflineDB';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_QUEUE_STORE = 'pendingReports';

function openOfflineDB() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB غير مدعوم'));
        const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'localId' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function queueReportOffline(reportData) {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
        tx.objectStore(OFFLINE_QUEUE_STORE).put({
            localId: `${reportData.id}_${Date.now()}`,
            reportData,
            createdAt: Date.now()
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

async function getPendingReports() {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
        const req = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

async function removePendingReport(localId) {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
        tx.objectStore(OFFLINE_QUEUE_STORE).delete(localId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

async function syncPendingReports() {
    if (!navigator.onLine) return;
    let pending = [];
    try { pending = await getPendingReports(); } catch (e) { return; }
    let syncedAny = false;
    for (const item of pending) {
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'submitReport', payload: item.reportData })
            });
            const result = await res.json();
            if (result.status !== 'success') throw new Error(result.message || 'فشل المزامنة');
            await removePendingReport(item.localId);
            syncedAny = true;
        } catch (error) {
            console.warn('Offline sync stopped:', error);
            break;
        }
    }
    if (syncedAny) {
        try { await refreshAppCache({ silent: true }); } catch (e) { console.warn('Post-sync cache refresh skipped:', e); }
    }
    updateOfflineStatus();
}

async function updateOfflineStatus() {
    const el = document.getElementById('offline-status');
    if (!el) return;
    let pendingCount = 0;
    try { pendingCount = (await getPendingReports()).length; } catch (e) {}
    if (!navigator.onLine) {
        el.textContent = pendingCount ? `🔴 بدون إنترنت — ${pendingCount} تقرير بانتظار المزامنة` : '🔴 بدون إنترنت — العمل محفوظ محلياً';
        el.style.display = 'block';
        el.style.background = '#dc3545';
        el.style.color = '#fff';
    } else if (pendingCount) {
        el.textContent = `🟠 متصل — ${pendingCount} تقرير بانتظار المزامنة`;
        el.style.display = 'block';
        el.style.background = '#ffc107';
        el.style.color = '#000';
    } else {
        el.textContent = '🟢 متصل';
        el.style.display = 'block';
        el.style.background = '#198754';
        el.style.color = '#fff';
        setTimeout(() => { if (navigator.onLine) el.style.display = 'none'; }, 2500);
    }
}

window.addEventListener('online', () => { updateOfflineStatus(); syncPendingReports(); });
window.addEventListener('offline', updateOfflineStatus);
setInterval(() => { if (navigator.onLine) syncPendingReports(); }, 30000);
document.addEventListener('DOMContentLoaded', () => {
    setupCacheRefreshButtons();
    setTimeout(() => { updateOfflineStatus(); syncPendingReports(); }, 500);
});

// ===================================================================
//                      1. التهيئة العامة والتحقق من تسجيل الدخول
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser'));
    const isLoginPage = !!document.getElementById('loginForm');

    if (isLoginPage && currentUser) { window.location.href = 'reports.html'; return; }
    if (!isLoginPage && !currentUser) { window.location.href = 'index.html'; return; }

    if (!isLoginPage) {
        document.getElementById('welcomeMessage').textContent = `أهلاً بك، ${currentUser.name}`;
        const logout = () => {
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            localStorage.removeItem('appDB');
            localStorage.removeItem('dbCacheTimestamp');
            localStorage.removeItem(FORM_STATE_KEY); 
            sessionStorage.removeItem(EDIT_STATE_KEY);
            window.location.href = 'index.html';
        };
        document.getElementById('logoutBtn').addEventListener('click', logout);

        if (window.location.pathname.includes('reports.html')) document.querySelector('.nav-link-reports').classList.add('active');
        if (window.location.pathname.includes('history.html')) document.querySelector('.nav-link-history').classList.add('active');
    }

    if (isLoginPage) handleLoginPage();
    else if (document.getElementById('reportForm')) handleReportPage();
    else if (document.getElementById('reports-accordion')) handleHistoryPage();
});

// ===================================================================
//                      2. جلب البيانات من Google Sheet
// ===================================================================
async function getDbData() {
    const DB_KEY = APP_DB_KEY;
    const TS_KEY = APP_DB_TS_KEY;
    const cachedDB = localStorage.getItem(DB_KEY);
    const cacheTimestamp = localStorage.getItem(TS_KEY);

    if (cachedDB) {
        const ageMinutes = cacheTimestamp ? (Date.now() - Number(cacheTimestamp)) / 60000 : Infinity;
        // استخدم الكاش مباشرة إذا كان Offline، حتى لو انتهت مدته.
        if (!navigator.onLine || (cacheTimestamp && ageMinutes < CACHE_DURATION_MINUTES)) {
            return JSON.parse(cachedDB);
        }
    }

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getInitialData&v=${APP_DB_VERSION}&t=${Date.now()}`, {
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const dbData = await res.json();
        if (dbData.status === 'error') throw new Error(dbData.message || 'API error');
        localStorage.setItem(DB_KEY, JSON.stringify(dbData));
        localStorage.setItem(TS_KEY, Date.now());
        return dbData;
    } catch (error) {
        if (cachedDB) {
            console.warn('Using cached DB because network request failed:', error);
            return JSON.parse(cachedDB);
        }
        throw error;
    }
}

// ===================================================================
//                 CACHE REFRESH / FAST DATA UPDATE
// ===================================================================
const APP_DB_VERSION = 'v11-offline-locations';
const APP_DB_KEY = `appDB_${APP_DB_VERSION}`;
const APP_DB_TS_KEY = `dbCacheTimestamp_${APP_DB_VERSION}`;

let cacheRefreshInProgress = false;

async function refreshAppCache({ silent = false } = {}) {
    if (cacheRefreshInProgress) return { ok: false, busy: true };
    if (!navigator.onLine) {
        if (!silent) alert('لا يمكن تحديث البيانات بدون اتصال بالإنترنت.');
        return { ok: false, offline: true };
    }

    cacheRefreshInProgress = true;
    const buttons = document.querySelectorAll('[data-refresh-cache]');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>جاري التحديث...';
    });

    try {
        // cache: no-store + timestamp ensures Google Apps Script is queried for fresh data.
        const buildRefreshUrl = () =>
            `${SCRIPT_URL}?action=getInitialData&forceRefresh=1&v=${encodeURIComponent(APP_DB_VERSION)}&t=${Date.now()}&_=refresh`;

        let response = null;
        let lastError = null;

        // Try twice because Google Apps Script may transiently redirect/wake the deployment.
        for (let attempt = 1; attempt <= 2; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            try {
                response = await fetch(buildRefreshUrl(), {
                    method: 'GET',
                    cache: 'no-store',
                    redirect: 'follow',
                    signal: controller.signal
                });
                if (response.ok) break;
                lastError = new Error(`HTTP ${response.status}`);
            } catch (err) {
                lastError = err;
            } finally {
                clearTimeout(timeout);
            }
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 800));
        }

        if (!response || !response.ok) {
            throw lastError || new Error('تعذر الاتصال بخدمة تحديث البيانات');
        }

        const freshDB = await response.json();
        if (!freshDB || freshDB.status === 'error') {
            throw new Error(freshDB?.message || 'فشل جلب البيانات');
        }

        // Replace the cache only after a complete successful response.
        localStorage.setItem(APP_DB_KEY, JSON.stringify(freshDB));
        localStorage.setItem(APP_DB_TS_KEY, String(Date.now()));

        // Tell the current page that fresh data is available.
        window.dispatchEvent(new CustomEvent('dbCacheRefreshed', { detail: freshDB }));

        // Update the Service Worker itself without deleting the working cache first.
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.update()));
            } catch (swError) {
                console.warn('Service Worker update skipped:', swError);
            }
        }

        buttons.forEach(btn => {
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-outline-success');
            btn.innerHTML = '<i class="fa-solid fa-check me-1"></i>تم التحديث';
        });

        setTimeout(() => {
            buttons.forEach(btn => {
                btn.classList.remove('btn-outline-success');
                btn.classList.add('btn-outline-primary');
                btn.innerHTML = btn.dataset.originalHtml || '<i class="fa-solid fa-arrows-rotate me-1"></i>تحديث البيانات';
                btn.disabled = false;
            });
        }, 1500);

        return { ok: true, data: freshDB };
    } catch (error) {
        console.error('Cache refresh failed:', error);
        buttons.forEach(btn => {
            btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>فشل التحديث';
        });
        setTimeout(() => {
            buttons.forEach(btn => {
                btn.innerHTML = btn.dataset.originalHtml || '<i class="fa-solid fa-arrows-rotate me-1"></i>تحديث البيانات';
                btn.disabled = false;
            });
        }, 2000);

        if (!silent) {
            const message = error.name === 'AbortError'
                ? 'انتهت مهلة الاتصال. تحقق من الإنترنت وحاول مرة أخرى.'
                : (error instanceof TypeError && /fetch/i.test(error.message || '')
                    ? 'تعذر الاتصال بخدمة تحديث البيانات. تأكد من نشر آخر نسخة من Google Apps Script ثم حاول مرة أخرى.'
                    : `تعذر تحديث البيانات: ${error.message || error}`);
            alert(message);
        }
        return { ok: false, error };
    } finally {
        cacheRefreshInProgress = false;
    }
}

function setupCacheRefreshButtons() {
    document.querySelectorAll('[data-refresh-cache]').forEach(btn => {
        if (btn.dataset.refreshBound === '1') return;
        btn.dataset.refreshBound = '1';
        btn.addEventListener('click', async (event) => {
            event.preventDefault();
            await refreshAppCache();
        });
    });
}


// ===================================================================
//                 إضافة بيانات جديدة إلى Locations
// ===================================================================
async function addLocationToSheet(type, value, governorate = '', region = '') {
    const cleanValue = String(value ?? '').trim();
    if (!cleanValue) throw new Error('يرجى إدخال القيمة الجديدة.');
    if (!navigator.onLine) throw new Error('إضافة بيانات جديدة تحتاج إلى اتصال بالإنترنت.');

    const payload = {
        action: 'addLocation',
        payload: {
            type,
            value: cleanValue,
            governorate: String(governorate ?? '').trim(),
            region: String(region ?? '').trim()
        }
    };

    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result || result.status !== 'success') {
        throw new Error(result?.message || 'تعذر إضافة البيانات إلى Locations');
    }
    return result;
}

function setupLocationAddButtons(DBRef) {
    const modalEl = document.getElementById('addLocationModal');
    const form = document.getElementById('addLocationForm');
    if (!modalEl || !form) return;
    const modal = new bootstrap.Modal(modalEl);
    const typeInput = document.getElementById('addLocationType');
    const valueInput = document.getElementById('addLocationValue');
    const contextHint = document.getElementById('addLocationContext');
    const saveBtn = document.getElementById('saveLocationBtn');
    const governorateSelect = document.getElementById('governorate');
    const regionSelect = document.getElementById('region');
    const marketSelect = document.getElementById('market_name');

    const labels = { governorate: 'المحافظة', region: 'المنطقة', market: 'اسم المحل' };

    document.querySelectorAll('[data-add-location]').forEach(btn => {
        if (btn.dataset.locationAddBound === '1') return;
        btn.dataset.locationAddBound = '1';
        btn.addEventListener('click', () => {
            const type = btn.dataset.addLocation;
            const gov = governorateSelect?.value || '';
            const region = regionSelect?.value || '';
            if (type === 'region' && !gov) {
                alert('اختر المحافظة أولاً ثم أضف المنطقة.');
                return;
            }
            if (type === 'market' && (!gov || !region)) {
                alert('اختر المحافظة والمنطقة أولاً ثم أضف اسم المحل.');
                return;
            }
            typeInput.value = type;
            valueInput.value = '';
            valueInput.placeholder = `أدخل ${labels[type] || 'البيانات'} الجديدة`;
            contextHint.textContent = type === 'governorate'
                ? 'ستتم إضافة محافظة جديدة.'
                : type === 'region'
                    ? `المحافظة: ${gov}`
                    : `المحافظة: ${gov} — المنطقة: ${region}`;
            modal.show();
            setTimeout(() => valueInput.focus(), 200);
        });
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const type = typeInput.value;
        const value = valueInput.value.trim();
        const gov = governorateSelect?.value || '';
        const region = regionSelect?.value || '';
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>جاري الحفظ...';
        try {
            await addLocationToSheet(type, value, gov, region);
            modal.hide();
            if (typeof window.showToast === 'function') {
                window.showToast('تمت إضافة البيانات بنجاح. جاري تحديث القوائم...');
            } else {
                console.log('تمت إضافة البيانات بنجاح. جاري تحديث القوائم...');
            }
            const result = await refreshAppCache({ silent: true });
            if (!result.ok) throw result.error || new Error('تمت الإضافة لكن تعذر تحديث القوائم');

            // Select the newly-added value immediately after refresh.
            if (type === 'governorate') {
                $('#governorate').val(value).trigger('change');
            } else if (type === 'region') {
                $('#region').val(value).trigger('change');
            } else if (type === 'market') {
                $('#market_name').val(value).trigger('change');
            }
        } catch (error) {
            alert(`تعذر إضافة البيانات: ${error.message || error}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-save me-1"></i>حفظ';
        }
    });
}

// ===================================================================
//                      3. منطق صفحة تسجيل الدخول
// ===================================================================
async function handleLoginPage() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value.trim().toLowerCase();
        const password = e.target.password.value.trim();
        const rememberMe = e.target.rememberMe.checked;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const errorMessage = document.getElementById('errorMessage');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جار التحقق...';
        errorMessage.textContent = '';
        try {
            const resLogin = await fetch(SCRIPT_URL, {
                method: 'POST', body: JSON.stringify({ action: 'doLogin', payload: { username, password } }),
            });
            const loginResult = await resLogin.json();
            if (loginResult.status !== 'success') throw new Error('Invalid credentials');
            
            if (rememberMe) {
                localStorage.setItem('currentUser', JSON.stringify(loginResult.user));
            } else {
                sessionStorage.setItem('currentUser', JSON.stringify(loginResult.user));
            }
            
            await getDbData();
            errorMessage.textContent = 'تم التحقق بنجاح! جارٍ التحويل...';
            errorMessage.style.color = '#2ecc71';
            setTimeout(() => { window.location.href = 'reports.html'; }, 1000);
        } catch (error) {
            errorMessage.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'دخـــول';
        }
    });

    const togglePassword = document.querySelector('.toggle-password');
    if(togglePassword) {
        togglePassword.addEventListener('click', function () {
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
}

// ===================================================================
//                      4. منطق صفحة إدخال التقارير
// ===================================================================
async function handleReportPage() {
    let isFormDirty = false;
    
    const mainContainer = document.querySelector('.main-container');
    const form = document.getElementById('reportForm');
    form.style.display = 'none';
    mainContainer.insertAdjacentHTML('afterbegin', `<div id="loading-spinner" class="text-center p-5"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p class="mt-2">جارِ تهيئة النموذج...</p></div>`);
    let DB = await getDbData();
    if (!DB) {
        const logoutOnClick = "localStorage.clear(); sessionStorage.clear(); window.location.href='index.html'; return false;";
        mainContainer.innerHTML = `<div class="alert alert-danger">فشل تحميل البيانات الأساسية. يرجى <a href="#" onclick="${logoutOnClick}">تسجيل الخروج</a> والمحاولة مرة أخرى.</div>`;
        return;
    }
    // Update the in-memory DB immediately when the user refreshes the cache.
    // No page reload is needed, so an unfinished report is not lost.
    window.addEventListener('dbCacheRefreshed', (event) => {
        if (!event.detail) return;
        DB = event.detail;
        try {
            // Rebuild the main selects from the fresh data where applicable.
            const selectedGovernorate = governorateSelect.value;
            const selectedRegion = regionSelect.value;
            const selectedMarket = marketSelect.value;
            const selectedCampaign = campaignSelect.value;

            if (typeof populateSelect === 'function') {
                const locations = Array.isArray(DB.locations) ? DB.locations : [];
                const governors = [...new Set(locations.map(l => String(l.gov ?? '').trim()).filter(Boolean))];
                const regions = selectedGovernorate
                    ? [...new Set(locations.filter(l => String(l.gov ?? '').trim() === String(selectedGovernorate).trim())
                        .map(l => String(l.region ?? '').trim()).filter(Boolean))]
                    : [];
                const markets = selectedGovernorate && selectedRegion
                    ? [...new Set(locations.filter(l =>
                        String(l.gov ?? '').trim() === String(selectedGovernorate).trim() &&
                        String(l.region ?? '').trim() === String(selectedRegion).trim())
                        .map(l => String(l.market ?? '').trim()).filter(Boolean))]
                    : [];

                populateSelect(governorateSelect, governors, selectedGovernorate);
                populateSelect(regionSelect, regions, selectedRegion);
                populateSelect(marketSelect, markets, selectedMarket);
            }

            // Re-run dependent product filtering without touching existing rows.
            if (typeof updateProductAvailability === 'function') updateProductAvailability();
        } catch (e) {
            console.warn('In-page DB refresh UI update skipped:', e);
        }
    });

    document.getElementById('loading-spinner').remove();
    form.style.display = 'block';
    setupLocationAddButtons(DB);

    const reportForm = document.getElementById('reportForm'), governorateSelect = document.getElementById('governorate'), regionSelect = document.getElementById('region'), marketSelect = document.getElementById('market_name'), campaignSelect = document.getElementById('campaign'), salesTableBody = document.getElementById('sales-table-body'), expensesTableBody = document.getElementById('expenses-table-body'), addSaleRowBtn = document.getElementById('add-sale-row'), addExpenseRowBtn = document.getElementById('add-expense-row'), mainSubmitBtn = document.querySelector('.main-submit-btn'), supervisorInput = document.getElementById('supervisor'), submitAndAddAnotherBtn = document.getElementById('submitAndAddAnotherBtn');
    const productModal = new bootstrap.Modal(document.getElementById('productSelectionModal'));
    const productSearchInput = document.getElementById('productSearchInput');
    const productSelectionTbody = document.querySelector('#productSelectionTable tbody');
    const addSelectedProductsBtn = document.getElementById('addSelectedProductsBtn');
    const expenseModal = new bootstrap.Modal(document.getElementById('expenseSelectionModal'));
    const expenseSearchInput = document.getElementById('expenseSearchInput');
    const expenseSelectionTbody = document.querySelector('#expenseSelectionTable tbody');
    const addSelectedExpensesBtn = document.getElementById('addSelectedExpensesBtn');
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    const viewReportBtn = document.getElementById('viewReportBtn');

    const toastContainer = document.getElementById('toast-notification');
    const toastMessage = toastContainer.querySelector('.toast-message');
    const showToast = (message, isError = false) => {
        toastMessage.textContent = message;
        toastMessage.classList.toggle('error', isError);
        toastContainer.classList.add('show');
        setTimeout(() => toastContainer.classList.remove('show'), 3000);
    };
    window.showToast = showToast;

    const getFormState = () => ({
        governorate: $('#governorate').val(), region: $('#region').val(), market: $('#market_name').val(),
        campaign: $('#campaign').val(), event: $('#event').val(),
        eventDays: document.getElementById('eventDays').value, date: document.getElementById('date').value,
        timeFrom: document.getElementById('timeFrom').value, timeTo: document.getElementById('timeTo').value,
        inventoryDependency: $('#inventoryDependency').val(), coordinator: $('#coordinator').val(),
        promoter1: $('#promoter1').val(), promoter2: $('#promoter2').val(),
        promoter3: $('#promoter3').val(), promoter4: $('#promoter4').val(),
        promoters: getSelectedPromoters(),
        notes: document.getElementById('notes').value,
        sales: Array.from(salesTableBody.querySelectorAll('tr')).map(r => ({ product: $(r.querySelector('.sale-product')).val(), price: Number(r.querySelector('.sale-price').value) || 0, quantity: Number(r.querySelector('.sale-quantity').value) || 0, campaign: $('#campaign').val() })),
        expenses: Array.from(expensesTableBody.querySelectorAll('tr')).map(r => ({ item: $(r.querySelector('.expense-item')).val(), quantity: r.querySelector('.expense-quantity').value })),
    });
    const saveFormState = () => { if (isFormDirty) { localStorage.setItem(FORM_STATE_KEY, JSON.stringify(getFormState())); } };
    const loadFormState = () => {
        const savedState = localStorage.getItem(FORM_STATE_KEY);
        if (!savedState) return;
        const state = JSON.parse(savedState);
        $('#campaign').val(state.campaign).trigger('change');
        $('#event').val(state.event).trigger('change');
        document.getElementById('eventDays').value = state.eventDays;
        document.getElementById('date').value = state.date;
        document.getElementById('timeFrom').value = state.timeFrom;
        document.getElementById('timeTo').value = state.timeTo;
        document.getElementById('notes').value = state.notes;
        $('#inventoryDependency').val(state.inventoryDependency).trigger('change');
        $('#coordinator').val(state.coordinator).trigger('change');
        $('#promoter1').val(state.promoter1).trigger('change');
        $('#promoter2').val(state.promoter2).trigger('change');
        $('#promoter3').val(state.promoter3).trigger('change');
        setSelectedPromoters([state.promoter1, state.promoter2, state.promoter3, state.promoter4]);
        if (state.governorate) {
            $('#governorate').val(state.governorate).trigger('change');
            if (state.region) {
                $('#region').val(state.region).trigger('change');
                if (state.market) {
                    $('#market_name').val(state.market).trigger('change');
                }
            }
        }
        salesTableBody.innerHTML = '';
        if (state.sales) state.sales.forEach(createSaleRow);
        expensesTableBody.innerHTML = '';
        if (state.expenses) state.expenses.forEach(createExpenseRow);
        updateSaleTotals();
        isFormDirty = true;
    };

    reportForm.addEventListener('input', () => { isFormDirty = true; saveFormState(); });
    window.addEventListener('beforeunload', (event) => { if (isFormDirty) { event.preventDefault(); event.returnValue = ''; } });

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));

    const initSelect2 = (selector, placeholder, allowTags = false) => { 
        $(selector).select2({ 
            theme: 'bootstrap-5', 
            dir: 'rtl', 
            placeholder, 
            width: '100%',
            tags: allowTags 
        }).on('change', () => { 
            isFormDirty = true; 
            saveFormState(); 
        }); 
    };
    const populateSelect = (select, options, selectedVal = '') => {
        const currentVal = $(select).val();
        const placeholder = select.querySelector('option[disabled]').textContent;
        select.innerHTML = `<option value="" selected disabled>${placeholder}</option>`;
        if (select.id.startsWith('promoter') || select.id === 'inventoryDependency' || select.id === 'coordinator') { select.innerHTML += `<option value="">غير محدد</option>`; }
        options.forEach(opt => select.innerHTML += `<option value="${opt}" ${opt === selectedVal ? 'selected' : ''}>${opt}</option>`);
        $(select).val(selectedVal || currentVal).trigger('change.select2');
    };
    const isValidPromoterName = (value) => {
        if (value === null || value === undefined) return false;
        const name = String(value).trim();
        return !!name && name.toLowerCase() !== 'undefined' && name.toLowerCase() !== 'null' && name !== '-';
    };

    const normalizePromoterNames = (names = []) => [...new Set(
        (Array.isArray(names) ? names : [names])
            .map(v => String(v ?? '').trim())
            .filter(isValidPromoterName)
    )];

    const getSelectedPromoters = () => normalizePromoterNames(
        [1,2,3,4].map(num => document.getElementById(`promoter${num}`)?.value)
    );

    const setSelectedPromoters = (names = []) => {
        const unique = normalizePromoterNames(names);
        [1,2,3,4].forEach((num, index) => {
            const input = document.getElementById(`promoter${num}`);
            if (input) input.value = unique[index] || '';
        });
        const text = document.getElementById('selectedPromotersText');
        const badges = document.getElementById('selectedPromotersBadges');
        if (text) text.textContent = unique.length ? `تم اختيار ${unique.length} من الأشخاص` : 'اختر الأشخاص المتواجدين ضمن النقطة...';
        if (badges) badges.innerHTML = unique.map(name => `<span class="badge text-bg-primary">${escapeHtml(name)}</span>`).join('');
    };

    const populateEmployees = (report = {}) => {
        const inventoryStaff = DB.employees.filter(e => e.role === 'مسؤول جرد').map(e => e.name);
        const coordinators = DB.employees.filter(e => e.role === 'منسق نقطة').map(e => e.name);
        populateSelect(document.getElementById('inventoryDependency'), inventoryStaff, report.inventoryDependency);
        populateSelect(document.getElementById('coordinator'), coordinators, report.coordinator);
        const reportPromoters = Array.isArray(report.promoters)
            ? report.promoters
            : [report.promoter1, report.promoter2, report.promoter3, report.promoter4];
        setSelectedPromoters(normalizePromoterNames(reportPromoters));
    };

    const promotersSelectionModal = new bootstrap.Modal(document.getElementById('promotersSelectionModal'));
    const promotersSearchInput = document.getElementById('promotersSearchInput');
    const promotersSelectionTbody = document.querySelector('#promotersSelectionTable tbody');
    const promotersEmptyMessage = document.getElementById('promotersEmptyMessage');
    const openPromotersBtn = document.getElementById('openPromotersBtn');
    const savePromotersBtn = document.getElementById('savePromotersBtn');

    const renderPromotersSelection = () => {
        const promoters = (Array.isArray(DB.employees) ? DB.employees : [])
            .filter(e => e && String(e.role || '').trim() === 'مروج')
            .map(e => String(e.name ?? '').trim())
            .filter(isValidPromoterName)
            .filter((name, index, arr) => arr.indexOf(name) === index);
        const selected = new Set(getSelectedPromoters());
        promotersSelectionTbody.innerHTML = '';
        const query = (promotersSearchInput?.value || '').toLowerCase().trim();
        const visible = promoters.filter(name => name.toLowerCase().includes(query));
        if (!visible.length) {
            promotersEmptyMessage.classList.remove('d-none');
            return;
        }
        promotersEmptyMessage.classList.add('d-none');
        visible.forEach(name => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><div class="form-check"><input class="form-check-input promoter-checkbox" type="checkbox" value="${escapeHtml(name)}" ${selected.has(name) ? 'checked' : ''}></div></td><td>${escapeHtml(name)}</td>`;
            tr.addEventListener('click', e => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = tr.querySelector('.promoter-checkbox');
                    cb.checked = !cb.checked;
                }
            });
            promotersSelectionTbody.appendChild(tr);
        });
    };

    openPromotersBtn?.addEventListener('click', () => {
        renderPromotersSelection();
        promotersSelectionModal.show();
    });
    promotersSearchInput?.addEventListener('input', renderPromotersSelection);
    savePromotersBtn?.addEventListener('click', () => {
        const selected = Array.from(promotersSelectionTbody.querySelectorAll('.promoter-checkbox:checked')).map(cb => cb.value);
        // إذا كانت القائمة مفلترة، نحافظ على الاختيارات الموجودة خارج نتيجة البحث.
        const current = new Set(getSelectedPromoters());
        const visibleNames = Array.from(promotersSelectionTbody.querySelectorAll('.promoter-checkbox')).map(cb => cb.value);
        visibleNames.forEach(name => current.delete(name));
        selected.forEach(name => current.add(name));
        setSelectedPromoters(Array.from(current));
        isFormDirty = true;
        saveFormState();
        promotersSelectionModal.hide();
    });

    const updateSaleTotals = () => {
        let grandTotal = 0, totalQuantity = 0;
        salesTableBody.querySelectorAll('tr').forEach(row => {
            const price = parseFloat(row.querySelector('.sale-price').value) || 0;
            const quantity = parseInt(row.querySelector('.sale-quantity').value) || 0;
            const rowTotal = price * quantity;
            row.querySelector('.row-total').value = rowTotal.toFixed(2);
            grandTotal += rowTotal;
            totalQuantity += quantity;
        });
        document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);
        document.getElementById('totalQuantity').textContent = totalQuantity;
    };
    // ===============================================================
    //                         SALES / BARCODE
    // ===============================================================
    const isCancelledProduct = (product) => {
        if (!product) return true;
        if (product.cancelled === true) return true;
        const value = String(product.cancelled ?? '').trim().toLowerCase();
        return value === 'true' || value === '1' || value === 'yes' || value === 'نعم';
    };

    const getCampaignProducts = () => {
        const campaignName = campaignSelect.value;
        let products = [];
        if (campaignName === 'شاملة'||campaignName === 'مهرجان') {
            const allProducts = new Map();
            Object.values(DB.products || {}).flat().forEach(p => {
                if (p && p.name) allProducts.set(p.name, p);
            });
            products = Array.from(allProducts.values());
        } else {
            products = DB.products?.[campaignName] || [];
        }
        return products.filter(p => p && p.name && !isCancelledProduct(p));
    };

    const normalizeCategory = (value) => String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ');
    const getSaleProducts = () => getCampaignProducts().filter(p => normalizeCategory(p.category) === 'مادة بيعية');
    const getTastingProducts = () => getCampaignProducts().filter(p => normalizeCategory(p.category) === 'مادة تذوق');

    const normalizeBarcode = (value) => String(value ?? '').trim();

    const findProductByBarcode = (barcode) => {
        const code = normalizeBarcode(barcode);
        if (!code) return null;

        const products = getSaleProducts();
        return products.find(p => normalizeBarcode(p.barcode) === code) || null;
    };

    const findSaleRowByProduct = (productName) => {
        return Array.from(salesTableBody.querySelectorAll('tr')).find(row => {
            return $(row.querySelector('.sale-product')).val() === productName;
        }) || null;
    };

    const focusBarcodeInput = () => {
        const input = document.getElementById('barcodeInput');
        if (input) setTimeout(() => input.focus(), 50);
    };

    const addProductToSalesByBarcode = (rawBarcode) => {
        const barcode = normalizeBarcode(rawBarcode);
        const status = document.getElementById('barcodeStatus');
        if (!barcode) return false;

        if (!campaignSelect.value) {
            status.textContent = 'يرجى اختيار نوع الحملة أولاً.';
            status.className = 'small mt-2 text-danger';
            showToast('يرجى اختيار نوع الحملة أولاً.', true);
            focusBarcodeInput();
            return false;
        }

        const product = findProductByBarcode(barcode);
        if (!product) {
            status.textContent = `الباركود ${barcode} غير موجود ضمن منتجات الحملة الحالية.`;
            status.className = 'small mt-2 text-danger';
            showToast(`الباركود ${barcode} غير موجود.`, true);
            focusBarcodeInput();
            return false;
        }

        const existingRow = findSaleRowByProduct(product.name);
        if (existingRow) {
            const quantityInput = existingRow.querySelector('.sale-quantity');
            const currentQty = parseInt(quantityInput.value, 10) || 0;
            quantityInput.value = currentQty + 1;
            updateSaleTotals();
            status.textContent = `تمت زيادة كمية «${product.name}» إلى ${quantityInput.value}.`;
            status.className = 'small mt-2 text-success';
        } else {
            createSaleRow({
                product: product.name,
                price: product.price,
                quantity: 1,
                barcode: barcode
            });
            status.textContent = `تمت إضافة «${product.name}» بسعر ${Number(product.price || 0).toFixed(2)} × 1.`;
            status.className = 'small mt-2 text-success';
        }

        isFormDirty = true;
        saveFormState();
        const input = document.getElementById('barcodeInput');
        if (input) input.value = '';
        focusBarcodeInput();
        return true;
    };

    const createSaleRow = (sale = {}) => {
        const products = getSaleProducts();
        // لا نعيد مادة ملغاة/غير متاحة من حالة محلية قديمة.
        if (sale.product && !products.some(p => p.name === sale.product)) {
            return;
        }
        const existingProducts = Array.from(salesTableBody.querySelectorAll('.sale-product')).map(select => $(select).val());
        if (sale.product && existingProducts.includes(sale.product) && !sale.price) return;

        const row = document.createElement('tr');
        const productOptions = products.map(p => {
            const safeName = String(p.name ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            return `<option value="${safeName}" data-price="${Number(p.price || 0)}" data-barcode="${normalizeBarcode(p.barcode)}">${safeName}</option>`;
        }).join('');
        const priceValue = sale.price !== undefined && sale.price !== '' ? Number(sale.price || 0).toFixed(2) : '0.00';
        const quantityValue = sale.quantity !== undefined && sale.quantity !== '' ? sale.quantity : '';

        row.innerHTML = `<td><select class="form-select form-select-sm sale-product" required><option value="" selected disabled>اختر...</option>${productOptions}</select></td><td><input type="number" class="form-control form-control-sm sale-price" value="${priceValue}" step="0.01" required></td><td><input type="number" class="form-control form-control-sm sale-quantity" value="${quantityValue}" min="1" required></td><td><input type="text" class="form-control form-control-sm row-total" value="0.00" readonly></td><td><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="fa-solid fa-trash-can"></i></button></td>`;
        row.querySelector('.remove-row-btn').addEventListener('click', () => {
            row.remove();
            updateSaleTotals();
            isFormDirty = true;
            saveFormState();
            focusBarcodeInput();
        });

        const productSelect = $(row.querySelector('.sale-product'));
        initSelect2(productSelect, 'اختر المادة...');
        productSelect.on('change', function() {
            const newPrice = $(this).find('option:selected').data('price');
            if (newPrice !== undefined && newPrice !== '') {
                row.querySelector('.sale-price').value = parseFloat(newPrice).toFixed(2);
            }
            updateSaleTotals();
            isFormDirty = true;
            saveFormState();
        });

        row.querySelector('.sale-quantity').addEventListener('input', () => {
            updateSaleTotals();
            isFormDirty = true;
            saveFormState();
        });
        row.querySelector('.sale-price').addEventListener('input', () => {
            updateSaleTotals();
            isFormDirty = true;
            saveFormState();
        });

        salesTableBody.appendChild(row);
        if (sale.product) productSelect.val(sale.product).trigger('change');
        if (sale.price !== undefined && sale.price !== '') row.querySelector('.sale-price').value = Number(sale.price || 0).toFixed(2);
        if (sale.quantity !== undefined && sale.quantity !== '') row.querySelector('.sale-quantity').value = sale.quantity;
        updateSaleTotals();
    };

    const createExpenseRow = (expense = {}) => {
        const expenseProducts = getTastingProducts();
        const existingExpenses = Array.from(expensesTableBody.querySelectorAll('.expense-item')).map(select => $(select).val());
        if (expense.item && existingExpenses.includes(expense.item) && !expense.quantity) return;

        const row = document.createElement('tr');
        const expenseOptions = expenseProducts.map(product => {
            const safeName = String(product.name ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            return `<option value="${safeName}" data-barcode="${normalizeBarcode(product.barcode)}">${safeName}</option>`;
        }).join('');

        row.innerHTML = `<td><select class="form-select form-select-sm expense-item" required><option value="" selected disabled>اختر...</option>${expenseOptions}</select></td><td><input type="number" class="form-control form-control-sm expense-quantity" value="${expense.quantity || ''}" min="1" required></td><td><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="fa-solid fa-trash-can"></i></button></td>`;
        row.querySelector('.remove-row-btn').addEventListener('click', () => { row.remove(); isFormDirty = true; saveFormState(); });
        const expenseSelect = $(row.querySelector('.expense-item'));
        initSelect2(expenseSelect, 'اختر مادة التذوق...');
        expensesTableBody.appendChild(row);
        if (expense.item) expenseSelect.val(expense.item).trigger('change');
        if (expense.quantity) row.querySelector('.expense-quantity').value = expense.quantity;
        row.querySelector('.expense-quantity').addEventListener('input', () => { isFormDirty = true; saveFormState(); });
    };

    /**
     * [إضافة جديدة] دالة لإعادة تعيين النموذج بالكامل بدون إعادة تحميل الصفحة
     */
    const resetFullForm = () => {
        // إعادة تعيين الحقول الأساسية
        document.getElementById('eventDays').value = '1';
        document.getElementById('date').value = '';
        document.getElementById('timeFrom').value = '';
        document.getElementById('timeTo').value = '';
        document.getElementById('notes').value = '';

        // إعادة تعيين حقول Select2
        $('#governorate, #campaign, #event, #inventoryDependency, #coordinator, #promoter1, #promoter2, #promoter3, #promoter4').val(null).trigger('change');
        // تفريغ الأشخاص المتواجدين ضمن النقطة بالكامل
        setSelectedPromoters([]);
        const promotersSelectionTbodyReset = document.getElementById('promotersSelectionTbody');
        if (promotersSelectionTbodyReset) {
            promotersSelectionTbodyReset.querySelectorAll('.promoter-checkbox').forEach(cb => {
                cb.checked = false;
            });
        }
        // تفريغ القوائم المعتمدة
        $('#region, #market_name').empty().append('<option value="" selected disabled>اختر...</option>').val(null).trigger('change');

        // تفريغ الجداول
        salesTableBody.innerHTML = '';
        expensesTableBody.innerHTML = '';
        updateSaleTotals();

        // إزالة علامات التحقق من الصحة
        reportForm.classList.remove('was-validated');
    };

    const handleFormSubmit = (event, editId, addAnother = false) => {
        if(event) event.preventDefault();
        if (!reportForm.checkValidity()) { 
            if(event) event.stopPropagation(); 
            reportForm.classList.add('was-validated'); 
            return; 
        }

        const reportData = getFormState();
        isFormDirty = false;
        localStorage.removeItem(FORM_STATE_KEY); 
        
        if (addAnother) {
            // [تصحيح] استدعاء دالة إعادة التعيين الكاملة
            resetFullForm(); 
            showToast('التقرير قيد الحفظ في الخلفية...');
        } else {
            document.querySelector('#successModal .fs-5').textContent = 'التقرير قيد الحفظ في الخلفية...';
            document.getElementById('success-spinner').style.display = 'inline-block';
            viewReportBtn.classList.add('disabled');
            successModal.show();
        }

        reportData.id = editId || Date.now();
        reportData.createdAt = editId ? originalCreatedAt : new Date().toLocaleString('ar-EG');
        reportData.promoters = [reportData.promoter1, reportData.promoter2, reportData.promoter3, reportData.promoter4].filter(p => p && p !== 'غير محدد');
        reportData.supervisor = supervisorInput.value;
        reportData.participants = [...new Set([reportData.coordinator, reportData.inventoryDependency, reportData.supervisor, ...reportData.promoters].filter(Boolean))];
        
        const saveOnlineOrQueue = async () => {
            if (!navigator.onLine) {
                await queueReportOffline(reportData);
                return { queued: true };
            }
            try {
                const res = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'submitReport', payload: reportData })
                });
                const result = await res.json();
                if (result.status !== 'success') throw new Error(result.message || 'فشل الحفظ');
                // Rebuild the local cache after every successful report so the next report sees fresh data.
                try { await refreshAppCache({ silent: true }); } catch (cacheError) { console.warn('Post-report cache refresh skipped:', cacheError); }
                return result;
            } catch (error) {
                // في حالة انقطاع الشبكة أثناء الإرسال، خزّن التقرير للمزامنة.
                const networkFailure = !navigator.onLine || error instanceof TypeError ||
                    /failed to fetch|network|load failed/i.test(String(error.message || ''));
                if (networkFailure) {
                    await queueReportOffline(reportData);
                    return { queued: true };
                }
                throw error;
            }
        };

        saveOnlineOrQueue()
            .then(result => {
                localStorage.removeItem('reportsCache');
                if (result.queued) {
                    updateOfflineStatus();
                    if (addAnother) {
                        showToast('تم حفظ التقرير محلياً وسيتم إرساله تلقائياً عند عودة الإنترنت.');
                    } else {
                        document.querySelector('#successModal .fs-5').textContent = 'تم حفظ التقرير محلياً — بانتظار الإنترنت للمزامنة';
                        document.getElementById('success-spinner').style.display = 'none';
                        viewReportBtn.classList.add('disabled');
                        successModal.show();
                    }
                    return;
                }

                if (addAnother) {
                    // resetFullForm() تم استدعاؤها مسبقاً، وتشمل تفريغ الأشخاص المتواجدين.
                    showToast('تم حفظ التقرير السابق بنجاح.');
                } else {
                    // بعد نجاح إرسال تقرير جديد فقط، نفرّغ الأشخاص المتواجدين ضمن النقطة.
                    // لا نفرّغ نموذج التعديل حتى يبقى التقرير المعروض كما هو.
                    if (!editId) {
                        setSelectedPromoters([]);
                        const promotersSelectionTbodyAfterSubmit = document.getElementById('promotersSelectionTbody');
                        if (promotersSelectionTbodyAfterSubmit) {
                            promotersSelectionTbodyAfterSubmit.querySelectorAll('.promoter-checkbox').forEach(cb => {
                                cb.checked = false;
                            });
                    }
                    }
                    document.querySelector('#successModal .fs-5').textContent = 'تم حفظ التقرير بنجاح!';
                    document.getElementById('success-spinner').style.display = 'none';
                    viewReportBtn.href = `history.html#c-${result.reportId}`;
                    viewReportBtn.classList.remove('disabled');
                }
            })
            .catch(error => {
                isFormDirty = true;
                saveFormState();
                if (addAnother) {
                    showToast(`فشل حفظ التقرير: ${error.message}`, true);
                } else {
                    successModal.hide();
                    alert(`فشل إرسال التقرير: ${error.message}`);
                }
            });
    };
    
    function setupModalRowClick(tbody) {
        tbody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const checkbox = row.querySelector('.form-check-input');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
            }
        });
    }
    
    function populateProductSelectionModal(campaignName) {
        const products = getSaleProducts();
        productSelectionTbody.innerHTML = '';
        products.forEach(product => { productSelectionTbody.insertAdjacentHTML('beforeend', `<tr><td><div class="form-check"><input class="form-check-input product-select-check" type="checkbox" value="${product.name}" data-price="${product.price}" style="pointer-events: none;"></div></td><td>${product.name}</td></tr>`); });
        productSearchInput.value = ''; productSearchInput.dispatchEvent(new Event('input'));
    }
    addSaleRowBtn.addEventListener('click', () => { const c = campaignSelect.value; if (!c) { alert('يرجى اختيار نوع الحملة أولاً.'); return; } populateProductSelectionModal(c); productModal.show(); });
    productSearchInput.addEventListener('input', () => { const s = productSearchInput.value.toLowerCase().trim(); productSelectionTbody.querySelectorAll('tr').forEach(r => { r.style.display = r.cells[1].textContent.toLowerCase().includes(s) ? '' : 'none'; }); });
    addSelectedProductsBtn.addEventListener('click', () => { productSelectionTbody.querySelectorAll('.product-select-check:checked').forEach(c => createSaleRow({ product: c.value, price: c.dataset.price })); updateSaleTotals(); productModal.hide(); isFormDirty = true; saveFormState(); });
    
    function populateExpenseSelectionModal(campaignName) {
        const products = getTastingProducts();
        expenseSelectionTbody.innerHTML = '';
        products.forEach(product => { expenseSelectionTbody.insertAdjacentHTML('beforeend', `<tr><td><div class="form-check"><input class="form-check-input expense-select-check" type="checkbox" value="${product.name}" style="pointer-events: none;"></div></td><td>${product.name}</td></tr>`); });
        expenseSearchInput.value = ''; expenseSearchInput.dispatchEvent(new Event('input'));
    }
    addExpenseRowBtn.addEventListener('click', () => { const c = campaignSelect.value; if (!c) { alert('يرجى اختيار نوع الحملة أولاً.'); return; } populateExpenseSelectionModal(c); expenseModal.show(); });
    expenseSearchInput.addEventListener('input', () => { const s = expenseSearchInput.value.toLowerCase().trim(); expenseSelectionTbody.querySelectorAll('tr').forEach(r => { r.style.display = r.cells[1].textContent.toLowerCase().includes(s) ? '' : 'none'; }); });
    addSelectedExpensesBtn.addEventListener('click', () => { expenseSelectionTbody.querySelectorAll('.expense-select-check:checked').forEach(c => createExpenseRow({ item: c.value })); expenseModal.hide(); isFormDirty = true; saveFormState(); });

    setupModalRowClick(productSelectionTbody);
    setupModalRowClick(expenseSelectionTbody);
    
    const initEditMode = (report) => {
        populateSelect(governorateSelect, [...new Set(DB.locations.map(l => l.gov))], report.governorate);
        populateSelect(regionSelect, [...new Set(DB.locations.filter(l => l.gov === report.governorate).map(l => l.region))], report.region);
        populateSelect(marketSelect, [...new Set(DB.locations.filter(l => l.region === report.region).map(l => l.market))], report.market);
        $('#campaign').val(report.campaign).trigger('change');
        $('#event').val(report.event).trigger('change');
        document.getElementById('eventDays').value = report.eventDays;
        document.getElementById('date').value = report.date;
        document.getElementById('timeFrom').value = report.timeFrom;
        document.getElementById('timeTo').value = report.timeTo;
        document.getElementById('notes').value = report.notes;
        supervisorInput.value = report.supervisor || '';
        populateEmployees(report);
        originalCreatedAt = report.createdAt;
        salesTableBody.innerHTML = '';
        if (report.sales) report.sales.forEach(createSaleRow);
        expensesTableBody.innerHTML = '';
        if (report.expenses) report.expenses.forEach(createExpenseRow);
        updateSaleTotals();
        mainSubmitBtn.innerHTML = '<i class="fa-solid fa-save"></i> تحديث التقرير';
        submitAndAddAnotherBtn.style.display = 'none';
        setTimeout(() => { isFormDirty = false; }, 200);
    };

    populateSelect(governorateSelect, [...new Set(DB.locations.map(l => l.gov))]);
    populateEmployees();
    reportForm.querySelectorAll('select:not(#market_name):not(.promoter-selector)').forEach(select => initSelect2(select, $(select).find("option:first").text(), false));
    
    $('#governorate').on('change', () => { const s = $('#governorate').val(); populateSelect(regionSelect, [...new Set(DB.locations.filter(l => l.gov === s).map(l => l.region))]); populateSelect(marketSelect, []); });
    $('#region').on('change', () => { const s = $('#region').val(); populateSelect(marketSelect, [...new Set(DB.locations.filter(l => l.region === s).map(l => l.market))]); });
    $('#inventoryDependency').on('change', function() { const s = $(this).val(); let n = ''; if (s) { const m = DB.employees.find(e => e.name === s); if (m && m.mgr) n = m.mgr; } supervisorInput.value = n; });
    $('#campaign').on('change', function() { salesTableBody.innerHTML = ''; expensesTableBody.innerHTML = ''; updateSaleTotals(); const bi = document.getElementById('barcodeInput'); if (bi) bi.value = ''; const bs = document.getElementById('barcodeStatus'); if (bs) bs.textContent = ''; focusBarcodeInput(); });
    
    $('#event').on('change', function() {
        const isDirectPromotion = $(this).val() === 'ترويج مباشر';
        const marketSelectElement = $('#market_name');
        const currentValue = marketSelectElement.val();
        
        if (marketSelectElement.data('select2')) {
            marketSelectElement.select2('destroy');
        }
        
        initSelect2(marketSelectElement, 'اختر أو أدخل اسم المحل...', isDirectPromotion);
        marketSelectElement.val(currentValue).trigger('change');
    }).trigger('change');

    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    if (editId) {
        localStorage.removeItem(FORM_STATE_KEY);
        const reportFromState = JSON.parse(sessionStorage.getItem(EDIT_STATE_KEY));
        if (reportFromState && reportFromState.id == editId) {
            initEditMode(reportFromState);
            sessionStorage.removeItem(EDIT_STATE_KEY);
        } else {
            mainSubmitBtn.disabled = true;
            mainContainer.insertAdjacentHTML('afterbegin', `<div class="alert alert-info text-center p-3" id="edit-loading"><i class="fa-solid fa-spinner fa-spin"></i> تحميل بيانات التقرير...</div>`);
            (async () => {
                try {
                    const res = await fetch(`${SCRIPT_URL}?action=getReportById&id=${editId}`);
                    const result = await res.json();
                    document.getElementById('edit-loading').remove();
                    if (result.status === 'success') {
                        initEditMode(result.report);
                        mainSubmitBtn.disabled = false;
                    } else { throw new Error(result.message); }
                } catch (error) {
                    alert(`خطأ في تحميل بيانات التعديل: ${error.message}`);
                    mainContainer.querySelector('#edit-loading')?.remove();
                }
            })();
        }
    } else {
        loadFormState();
    }
    

    // ===============================================================
    //                  EXPENSE / TASTING BARCODE
    // ===============================================================
    const expenseBarcodeInput = document.getElementById('expenseBarcodeInput');
    const scanExpenseBarcodeCameraBtn = document.getElementById('scanExpenseBarcodeCameraBtn');
    const clearExpenseBarcodeBtn = document.getElementById('clearExpenseBarcodeBtn');
    let expenseBarcodeDebounceTimer = null;

    const findExpenseByBarcode = (barcode) => {
        const code = normalizeBarcode(barcode);
        if (!code) return null;
        return getTastingProducts().find(p => normalizeBarcode(p.barcode) === code) || null;
    };

    const findExpenseRowByProduct = (productName) => {
        return Array.from(expensesTableBody.querySelectorAll('tr')).find(row =>
            $(row.querySelector('.expense-item')).val() === productName
        ) || null;
    };

    const focusExpenseBarcodeInput = () => {
        if (expenseBarcodeInput) setTimeout(() => expenseBarcodeInput.focus(), 50);
    };

    const addProductToExpensesByBarcode = (rawBarcode) => {
        const barcode = normalizeBarcode(rawBarcode);
        const status = document.getElementById('expenseBarcodeStatus');
        if (!barcode) return false;

        if (!campaignSelect.value) {
            status.textContent = 'يرجى اختيار نوع الحملة أولاً.';
            status.className = 'small mt-2 text-danger';
            showToast('يرجى اختيار نوع الحملة أولاً.', true);
            focusExpenseBarcodeInput();
            return false;
        }

        const product = findExpenseByBarcode(barcode);
        if (!product) {
            status.textContent = `الباركود ${barcode} غير موجود ضمن مواد التذوق للحملة الحالية.`;
            status.className = 'small mt-2 text-danger';
            showToast(`الباركود ${barcode} غير موجود ضمن مواد التذوق.`, true);
            focusExpenseBarcodeInput();
            return false;
        }

        const existingRow = findExpenseRowByProduct(product.name);
        if (existingRow) {
            const quantityInput = existingRow.querySelector('.expense-quantity');
            quantityInput.value = (parseInt(quantityInput.value, 10) || 0) + 1;
            status.textContent = `تمت زيادة كمية «${product.name}» إلى ${quantityInput.value}.`;
        } else {
            createExpenseRow({ item: product.name, quantity: 1, barcode });
            status.textContent = `تمت إضافة «${product.name}» × 1.`;
        }

        status.className = 'small mt-2 text-success';
        isFormDirty = true;
        saveFormState();
        expenseBarcodeInput.value = '';
        focusExpenseBarcodeInput();
        return true;
    };

    // ===============================================================
    //                 USB SCANNER + CAMERA SCANNER
    // ===============================================================
    const barcodeInput = document.getElementById('barcodeInput');
    const scanBarcodeCameraBtn = document.getElementById('scanBarcodeCameraBtn');
    const clearBarcodeBtn = document.getElementById('clearBarcodeBtn');
    const barcodeCameraModalElement = document.getElementById('barcodeCameraModal');
    const barcodeCameraModal = new bootstrap.Modal(barcodeCameraModalElement);
    let html5QrCode = null;
    let barcodeDebounceTimer = null;
    let cameraScanLocked = false;
    let cameraTarget = 'sales';

    const stopBarcodeCamera = async () => {
        if (!html5QrCode) return;
        try {
            const state = html5QrCode.getState?.();
            if (state === 2) await html5QrCode.stop();
        } catch (error) { console.warn('Barcode camera stop:', error); }
        try { await html5QrCode.clear(); } catch (error) {}
        html5QrCode = null;
        cameraScanLocked = false;
    };

    const handleScannedBarcode = (decodedText) => {
        if (cameraScanLocked) return;
        const barcode = normalizeBarcode(decodedText);
        if (!barcode) return;

        cameraScanLocked = true;
        const added = cameraTarget === 'expense'
            ? addProductToExpensesByBarcode(barcode)
            : addProductToSalesByBarcode(barcode);

        const status = document.getElementById('cameraScannerStatus');
        status.textContent = added ? 'تمت إضافة المادة. سيتم إغلاق الكاميرا...' : 'لم يتم العثور على المادة.';
        setTimeout(async () => {
            await stopBarcodeCamera();
            barcodeCameraModal.hide();
            cameraScanLocked = false;
        }, added ? 350 : 900);
    };

    const startBarcodeCamera = async (target = 'sales') => {
        cameraTarget = target;
        const status = document.getElementById('cameraScannerStatus');

        if (typeof Html5Qrcode === 'undefined') {
            const msg = 'مكتبة قراءة الباركود بالكاميرا لم تُحمّل. افتح الموقع مرة واحدة مع الإنترنت ثم حاول مجدداً.';
            status.textContent = msg;
            showToast(msg, true);
            barcodeCameraModal.show();
            return;
        }
        if (!campaignSelect.value) {
            showToast('يرجى اختيار نوع الحملة أولاً.', true);
            return;
        }
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            const msg = 'الكاميرا تحتاج HTTPS أو localhost.';
            status.textContent = msg;
            showToast(msg, true);
            barcodeCameraModal.show();
            return;
        }

        cameraScanLocked = false;
        status.textContent = target === 'expense'
            ? 'جاري تجهيز الكاميرا لمواد التذوق...'
            : 'جاري تجهيز الكاميرا للمواد البيعية...';
        barcodeCameraModal.show();

        const scannerConfig = {
            fps: 10,
            qrbox: { width: 280, height: 140 },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.ITF,
                Html5QrcodeSupportedFormats.CODABAR
            ]
        };

        try {
            // لا نستخدم facingMode نهائياً. نطلب الكاميرات ونمرر cameraId مباشرة.
            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                throw new DOMException('لم يتم العثور على كاميرا متاحة.', 'NotFoundError');
            }

            // html5-qrcode 2.3.8 expects a non-empty camera id string.
            // Some browsers expose the device id as `deviceId` instead of `id`,
            // so normalize all common shapes before calling start().
            const normalizedCameras = cameras.map(camera => {
                const isString = typeof camera === 'string';
                return {
                    raw: camera,
                    id: String(
                        isString
                            ? camera
                            : (camera?.id ??
                               camera?.deviceId ??
                               camera?.cameraId ??
                               '')
                    ).trim(),
                    label: String(isString ? '' : (camera?.label || '')).trim()
                };
            }).filter(camera => camera.id);

            if (!normalizedCameras.length) {
                throw new DOMException(
                    'لم يتمكن المتصفح من توفير معرف للكاميرا.',
                    'NotFoundError'
                );
            }

            const selectedCamera =
                normalizedCameras.find(camera => {
                    const label = camera.label.toLowerCase();
                    return label.includes('back') ||
                           label.includes('rear') ||
                           label.includes('environment') ||
                           label.includes('خلف');
                }) || normalizedCameras[0];

            const cameraId = selectedCamera.id;

            // Safety check: never call start() with an empty/undefined camera id.
            if (typeof cameraId !== 'string' || !cameraId.trim()) {
                throw new DOMException(
                    'معرف الكاميرا غير صالح.',
                    'NotFoundError'
                );
            }

            html5QrCode = new Html5Qrcode('barcode-reader', { verbose: false });

            await html5QrCode.start(
                cameraId,
                scannerConfig,
                handleScannedBarcode,
                () => {}
            );

            status.textContent = target === 'expense'
                ? 'وجّه الكاميرا نحو باركود مادة التذوق'
                : 'وجّه الكاميرا نحو باركود المادة البيعية';
        } catch (error) {
            console.error('Barcode camera error:', error);
            let message = `تعذر تشغيل الكاميرا: ${error?.name || ''} ${error?.message || error}`;

            if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
                message = 'تم رفض إذن الكاميرا. اسمح للمتصفح باستخدام الكاميرا ثم أعد المحاولة.';
            } else if (error?.name === 'NotFoundError') {
                message = 'لم يتم العثور على كاميرا متاحة على الجهاز.';
            } else if (error?.name === 'NotReadableError' || error?.name === 'AbortError') {
                message = 'الكاميرا مستخدمة من تطبيق أو صفحة أخرى. أغلقها ثم أعد المحاولة.';
            }

            status.textContent = message;
            showToast(message, true);
            await stopBarcodeCamera();
        }
    };

    scanBarcodeCameraBtn.addEventListener('click', () => startBarcodeCamera('sales'));
    scanExpenseBarcodeCameraBtn?.addEventListener('click', () => startBarcodeCamera('expense'));

    clearBarcodeBtn.addEventListener('click', () => {
        barcodeInput.value = '';
        document.getElementById('barcodeStatus').textContent = '';
        focusBarcodeInput();
    });
    clearExpenseBarcodeBtn?.addEventListener('click', () => {
        expenseBarcodeInput.value = '';
        document.getElementById('expenseBarcodeStatus').textContent = '';
        focusExpenseBarcodeInput();
    });

    barcodeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            clearTimeout(barcodeDebounceTimer);
            addProductToSalesByBarcode(barcodeInput.value);
        }
    });
    barcodeInput.addEventListener('input', () => {
        clearTimeout(barcodeDebounceTimer);
        const value = normalizeBarcode(barcodeInput.value);
        if (value.length < 6) return;
        barcodeDebounceTimer = setTimeout(() => {
            if (document.activeElement === barcodeInput && normalizeBarcode(barcodeInput.value).length >= 6)
                addProductToSalesByBarcode(barcodeInput.value);
        }, 250);
    });

    expenseBarcodeInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            clearTimeout(expenseBarcodeDebounceTimer);
            addProductToExpensesByBarcode(expenseBarcodeInput.value);
        }
    });
    expenseBarcodeInput?.addEventListener('input', () => {
        clearTimeout(expenseBarcodeDebounceTimer);
        const value = normalizeBarcode(expenseBarcodeInput.value);
        if (value.length < 6) return;
        expenseBarcodeDebounceTimer = setTimeout(() => {
            if (document.activeElement === expenseBarcodeInput && normalizeBarcode(expenseBarcodeInput.value).length >= 6)
                addProductToExpensesByBarcode(expenseBarcodeInput.value);
        }, 250);
    });

    barcodeCameraModalElement.addEventListener('hidden.bs.modal', async () => {
        await stopBarcodeCamera();
    });

    setTimeout(focusBarcodeInput, 300);

    salesTableBody.addEventListener('input', updateSaleTotals);
    reportForm.addEventListener('submit', (event) => handleFormSubmit(event, editId, false));
    submitAndAddAnotherBtn.addEventListener('click', (event) => handleFormSubmit(event, editId, true));
    
    document.getElementById('successModal').addEventListener('hidden.bs.modal', () => {
        if (!editId) { // فقط إذا كان تقريرًا جديدًا
            resetFullForm();
        } else {
            window.location.href = 'reports.html'; // في حالة التعديل، ارجع إلى صفحة فارغة
        }
    });
}

// ===================================================================
//                      5. منطق صفحة سجل التعديلات
// ===================================================================
async function handleHistoryPage() {
    const reportsAccordion = document.getElementById('reports-accordion');
    const searchInput = document.getElementById('searchInput');
    const noResultsMessage = document.getElementById('no-results-message');
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser'));
    let currentReports = [];

    const renderReports = (reportsToRender) => {
        reportsAccordion.innerHTML = '';
        if (!reportsToRender || reportsToRender.length === 0) {
            noResultsMessage.textContent = searchInput.value ? 'لا توجد تقارير تطابق بحثك.' : 'لا توجد تقارير محفوظة لعرضها.';
            noResultsMessage.classList.remove('d-none');
            return;
        }
        noResultsMessage.classList.add('d-none');
        reportsToRender.slice().reverse().forEach(report => {
            let grandTotal = 0, totalQuantity = 0;
            const salesRows = report.sales?.length > 0 ? report.sales.map(s => { 
                const p = parseFloat(s.price) || 0;
                const q = parseInt(s.quantity) || 0;
                const t = p * q; 
                grandTotal += t; 
                totalQuantity += q; 
                return `<tr><td>${s.product||'-'}</td><td>${p.toFixed(2)}</td><td>${q}</td><td>${t.toFixed(2)}</td></tr>`; 
            }).join('') : '<tr><td colspan="4" class="text-center text-muted">لا توجد مبيعات</td></tr>';
            const expensesRows = report.expenses?.length > 0 ? report.expenses.map(exp => `<tr><td>${exp.item || '-'}</td><td>${exp.quantity || '0'}</td></tr>`).join('') : '<tr><td colspan="2" class="text-center text-muted">لا توجد مصاريف</td></tr>';
            const promotersList = report.promoters && report.promoters.length > 0 ? report.promoters.join(', ') : 'لا يوجد';
            const reportHTML = `<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#c-${report.id}"><strong>${report.campaign} - ${report.market}</strong> (${report.date})</button></h2><div id="c-${report.id}" class="accordion-collapse collapse" data-bs-parent="#reports-accordion"><div class="accordion-body"><p><strong>تاريخ الإنشاء:</strong> ${report.createdAt || 'غير مسجل'}</p><p><strong>الحدث:</strong> ${report.event} (${report.eventDays} أيام) | <strong>الوقت:</strong> ${report.timeFrom} - ${report.timeTo}</p><p><strong>الفريق:</strong> منسق (${report.coordinator || 'N/A'})، جرد (${report.inventoryDependency || 'N/A'})، مشرف (${report.supervisor || 'N/A'})</p><p><strong>المروجون:</strong> ${promotersList}</p><h5 class="mt-4">المبيعات</h5><table class="table table-sm table-bordered"><thead><tr><th>المادة</th><th>السعر</th><th>الكمية</th><th>المجموع</th></tr></thead><tbody>${salesRows}</tbody>${report.sales?.length > 0 ? `<tfoot class="table-light fw-bold"><tr><td class="text-end" colspan="2">الإجمالي:</td><td>${totalQuantity}</td><td>${grandTotal.toFixed(2)}</td></tr></tfoot>` : ''}</table><h5 class="mt-4">المصاريف</h5><table class="table table-sm table-bordered"><thead><tr><th>المادة</th><th>الكمية</th></tr></thead><tbody>${expensesRows}</tbody></table>${report.notes ? `<hr><p><strong>ملاحظات:</strong> ${report.notes}</p>` : ''}<div class="text-end mt-3 border-top pt-3"><a href="reports.html?edit=${report.id}" class="btn btn-sm btn-primary edit-report-btn" data-report-id="${report.id}"><i class="fa-solid fa-pen-to-square me-1"></i> تعديل</a></div></div></div></div>`;
            reportsAccordion.insertAdjacentHTML('beforeend', reportHTML);
        });
        reportsAccordion.querySelectorAll('.edit-report-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const reportId = button.getAttribute('data-report-id');
                const reportData = currentReports.find(r => r.id == reportId);
                if (reportData) {
                    sessionStorage.setItem(EDIT_STATE_KEY, JSON.stringify(reportData));
                }
                window.location.href = button.href;
            });
        });
        
        if (window.location.hash) {
            const targetId = window.location.hash.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                new bootstrap.Collapse(targetElement).show();
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    const cachedReportsJSON = localStorage.getItem('reportsCache');
    if (cachedReportsJSON) {
        const allCachedReports = JSON.parse(cachedReportsJSON);
        currentReports = currentUser.role === 'admin' ? allCachedReports : allCachedReports.filter(r => r.participants && r.participants.includes(currentUser.name));
        renderReports(currentReports);
    } else {
        reportsAccordion.innerHTML = `<div class="text-center p-5"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p class="mt-2">جار تحميل السجل لأول مرة...</p></div>`;
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) { renderReports(currentReports); return; }
        const filtered = currentReports.filter(r => `${r.campaign||''} ${r.market||''} ${r.date||''} ${r.supervisor||''}`.toLowerCase().includes(term));
        renderReports(filtered);
    });

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getReports`);
        const allFreshReports = await res.json();
        const freshReportsJSON = JSON.stringify(allFreshReports);
        if (freshReportsJSON !== cachedReportsJSON) {
            localStorage.setItem('reportsCache', freshReportsJSON);
            currentReports = currentUser.role === 'admin' ? allFreshReports : allFreshReports.filter(r => r.participants && r.participants.includes(currentUser.name));
            searchInput.dispatchEvent(new Event('input'));
        }
    } catch (error) {
        if (!cachedReportsJSON) {
            reportsAccordion.innerHTML = `<div class="alert alert-danger">فشل تحميل سجل التقارير. يرجى التحقق من اتصالك بالإنترنت وتحديث الصفحة.</div>`;
        }
    }
}