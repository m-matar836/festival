// ===================================================================
//   script.js - النسخة النهائية مع إصلاح مشكلة تفريغ الحقول
// ===================================================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzvqRGBkZ84jvJHUsyWffB2-lnVtuZH7nvoNN6tHT56tVVbMrAclQl9JzSHxmYcehw/exec";
const CACHE_DURATION_MINUTES = 1440;
const FORM_STATE_KEY = 'reportFormLastState'; 
const EDIT_STATE_KEY = 'reportToEdit';

let originalCreatedAt = null; 

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
    const cachedDB = localStorage.getItem('appDB');
    const cacheTimestamp = localStorage.getItem('dbCacheTimestamp');
    if (cachedDB && cacheTimestamp && (Date.now() - cacheTimestamp) / 60000 < CACHE_DURATION_MINUTES) {
        return JSON.parse(cachedDB);
    }
    localStorage.removeItem('appDB');
    localStorage.removeItem('dbCacheTimestamp');
    const res = await fetch(`${SCRIPT_URL}?action=getInitialData`);
    const dbData = await res.json();
    localStorage.setItem('appDB', JSON.stringify(dbData));
    localStorage.setItem('dbCacheTimestamp', Date.now());
    return dbData;
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
    const DB = await getDbData();
    if (!DB) {
        const logoutOnClick = "localStorage.clear(); sessionStorage.clear(); window.location.href='index.html'; return false;";
        mainContainer.innerHTML = `<div class="alert alert-danger">فشل تحميل البيانات الأساسية. يرجى <a href="#" onclick="${logoutOnClick}">تسجيل الخروج</a> والمحاولة مرة أخرى.</div>`;
        return;
    }
    document.getElementById('loading-spinner').remove();
    form.style.display = 'block';

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

    const getFormState = () => ({
        governorate: $('#governorate').val(), region: $('#region').val(), market: $('#market_name').val(),
        campaign: $('#campaign').val(), event: $('#event').val(),
        eventDays: document.getElementById('eventDays').value, date: document.getElementById('date').value,
        timeFrom: document.getElementById('timeFrom').value, timeTo: document.getElementById('timeTo').value,
        inventoryDependency: $('#inventoryDependency').val(), coordinator: $('#coordinator').val(),
        promoter1: $('#promoter1').val(), promoter2: $('#promoter2').val(),
        promoter3: $('#promoter3').val(), promoter4: $('#promoter4').val(),
        notes: document.getElementById('notes').value,
        sales: Array.from(salesTableBody.querySelectorAll('tr')).map(r => ({ product: $(r.querySelector('.sale-product')).val(), price: r.querySelector('.sale-price').value, quantity: r.querySelector('.sale-quantity').value })),
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
        $('#promoter4').val(state.promoter4).trigger('change');
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
    const populateEmployees = (report = {}) => {
        const inventoryStaff = DB.employees.filter(e => e.role === 'مسؤول جرد').map(e => e.name);
        const coordinators = DB.employees.filter(e => e.role === 'منسق نقطة').map(e => e.name);
        const promoters = DB.employees.filter(e => e.role === 'مروج').map(e => e.name);
        populateSelect(document.getElementById('inventoryDependency'), inventoryStaff, report.inventoryDependency);
        populateSelect(document.getElementById('coordinator'), coordinators, report.coordinator);
        [1, 2, 3, 4].forEach(num => populateSelect(document.getElementById(`promoter${num}`), promoters, (report.promoters || [])[num - 1]));
    };
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
        const value = String(product?.cancelled ?? '').trim().toLowerCase();
        return value === 'true' || value === '1' || value === 'نعم';
    };

    const getCampaignProducts = () => {
        const campaignName = campaignSelect.value;
        let products = [];
        if (campaignName === 'شاملة') {
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

    const getSaleProducts = () => getCampaignProducts().filter(p => String(p.category ?? '').trim() === 'مادة بيعية');
    const getTastingProducts = () => getCampaignProducts().filter(p => String(p.category ?? '').trim() === 'مادة تذوق');

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
            return `<option value="${safeName}">${safeName}</option>`;
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
        
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'submitReport', payload: reportData }) })
            .then(res => res.json())
            .then(result => {
                if (result.status !== 'success') {
                    throw new Error(result.message || 'فشل الحفظ في الخلفية');
                }
                localStorage.removeItem('reportsCache');
                if (addAnother) {
                    showToast('تم حفظ التقرير السابق بنجاح.');
                } else {
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
                    showToast(`فشل حفظ التقرير السابق: ${error.message}`, true);
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
    reportForm.querySelectorAll('select:not(#market_name)').forEach(select => initSelect2(select, $(select).find("option:first").text(), false));
    
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

    const stopBarcodeCamera = async () => {
        if (!html5QrCode) return;
        try {
            const state = html5QrCode.getState?.();
            // 2 = SCANNING in html5-qrcode
            if (state === 2) await html5QrCode.stop();
        } catch (error) {
            console.warn('Barcode camera stop:', error);
        }
        try { await html5QrCode.clear(); } catch (error) { /* already cleared */ }
        html5QrCode = null;
        cameraScanLocked = false;
    };

    const handleScannedBarcode = (decodedText) => {
        if (cameraScanLocked) return;
        const barcode = normalizeBarcode(decodedText);
        if (!barcode) return;

        cameraScanLocked = true;
        const added = addProductToSalesByBarcode(barcode);
        const status = document.getElementById('cameraScannerStatus');
        status.textContent = added ? 'تمت إضافة المنتج. سيتم إغلاق الكاميرا...' : 'لم يتم العثور على المنتج.';

        setTimeout(async () => {
            await stopBarcodeCamera();
            barcodeCameraModal.hide();
            cameraScanLocked = false;
        }, added ? 350 : 900);
    };

    const startBarcodeCamera = async () => {
        if (typeof Html5Qrcode === 'undefined') {
            showToast('تعذر تحميل مكتبة الكاميرا. تأكد من الاتصال بالإنترنت.', true);
            return;
        }
        if (!campaignSelect.value) {
            showToast('يرجى اختيار نوع الحملة أولاً.', true);
            focusBarcodeInput();
            return;
        }

        document.getElementById('cameraScannerStatus').textContent = 'جارٍ تشغيل الكاميرا...';
        barcodeCameraModal.show();

        try {
            html5QrCode = new Html5Qrcode('barcode-reader');
            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) throw new Error('لم يتم العثور على كاميرا.');

            const backCamera = cameras.find(c => /back|rear|environment|خلف/i.test(c.label)) || cameras[cameras.length - 1];
            await html5QrCode.start(
                backCamera.id,
                {
                    fps: 10,
                    qrbox: { width: 280, height: 140 },
                    aspectRatio: 1.777778,
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
                },
                handleScannedBarcode,
                () => {}
            );
            document.getElementById('cameraScannerStatus').textContent = 'وجّه الكاميرا نحو الباركود';
        } catch (error) {
            console.error('Barcode camera error:', error);
            document.getElementById('cameraScannerStatus').textContent = `تعذر تشغيل الكاميرا: ${error.message || error}`;
            showToast('تعذر تشغيل الكاميرا. تأكد من السماح بالوصول للكاميرا واستخدام HTTPS.', true);
            await stopBarcodeCamera();
        }
    };

    scanBarcodeCameraBtn.addEventListener('click', startBarcodeCamera);
    clearBarcodeBtn.addEventListener('click', () => {
        barcodeInput.value = '';
        document.getElementById('barcodeStatus').textContent = '';
        focusBarcodeInput();
    });

    barcodeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            clearTimeout(barcodeDebounceTimer);
            addProductToSalesByBarcode(barcodeInput.value);
        }
    });

    // دعم أجهزة USB التي لا ترسل Enter: إذا وصل نص الباركود بسرعة، تتم المعالجة تلقائياً.
    barcodeInput.addEventListener('input', () => {
        clearTimeout(barcodeDebounceTimer);
        const value = normalizeBarcode(barcodeInput.value);
        if (value.length < 6) return;
        barcodeDebounceTimer = setTimeout(() => {
            if (document.activeElement === barcodeInput && normalizeBarcode(barcodeInput.value).length >= 6) {
                addProductToSalesByBarcode(barcodeInput.value);
            }
        }, 250);
    });

    barcodeCameraModalElement.addEventListener('hidden.bs.modal', async () => {
        await stopBarcodeCamera();
        focusBarcodeInput();
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