// Initialize Lucide icons
lucide.createIcons();

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAZlJRp16G8ASoN-D3DhEBCqKzi0VlSLPU",
    authDomain: "dcash-database.firebaseapp.com",
    projectId: "dcash-database",
    storageBucket: "dcash-database.firebasestorage.app",
    messagingSenderId: "669328008811",
    appId: "1:669328008811:web:25e122b977790c40f9732e",
    measurementId: "G-TZB9YLC6GL",
    databaseURL: "https://dcash-database-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const transactionsRef = db.ref('transactions');

// Connection Debugging
console.log("🚀 DCash Version: 1.1 - Singapore Database Fix");
db.ref(".info/connected").on("value", (snap) => {
    if (snap.val() === true) {
        console.log("🔥 Firebase: Connected successfully!");
    } else {
        console.log("⚠️ Firebase: Disconnected.");
    }
});

// Data State
let transactions = [];

// Categories Config
const categories = {
    salary: { label: 'เงินเดือน', icon: 'briefcase', color: '#10b981' },
    food: { label: 'อาหารและเครื่องดื่ม', icon: 'coffee', color: '#f59e0b' },
    transport: { label: 'การเดินทาง', icon: 'truck', color: '#3b82f6' },
    shopping: { label: 'ช้อปปิ้ง', icon: 'shopping-bag', color: '#ec4899' },
    entertainment: { label: 'ความบันเทิง', icon: 'film', color: '#8b5cf6' },
    house: { label: 'ที่อยู่อาศัย', icon: 'home', color: '#64748b' },
    other: { label: 'อื่นๆ', icon: 'layers', color: '#94a3b8' }
};

// settings
const GOOGLE_SHEET_URL = ""; // <<-- วาง URL ที่ได้จาก Google Apps Script ที่นี่

// UI Elements
const totalBalanceEl = document.getElementById('totalBalance');
const monthlyIncomeEl = document.getElementById('monthlyIncome');
const monthlyExpenseEl = document.getElementById('monthlyExpense');
const transactionsListShortEl = document.getElementById('transactionsListShort');
const transactionsListFullEl = document.getElementById('transactionsListFull');
const transactionForm = document.getElementById('transactionForm');

// Navigation Elements
const menuOverview = document.getElementById('menuOverview');
const menuTransactions = document.getElementById('menuTransactions');
const mobileMenuOverview = document.getElementById('mobileMenuOverview');
const mobileMenuTransactions = document.getElementById('mobileMenuTransactions');
const viewOverview = document.getElementById('viewOverview');
const viewAllTransactions = document.getElementById('viewAllTransactions');
const viewAllLink = document.getElementById('viewAllLink');

// Filter & Pagination State
let currentPage = 1;
const itemsPerPage = 30;
let currentFilter = 'all';
let currentMonthFilter = 'all';
let currentChartMonthFilter = 'all';

// Charts
let mainChart, categoryChart;

function init() {
    // Listen for data from Firebase
    transactionsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        transactions = [];
        if (data) {
            Object.keys(data).forEach(key => {
                const tx = data[key];
                tx.firebaseKey = key;
                transactions.push(tx);
            });
        }

        // Refresh everything when data arrives or changes
        updateDashboard();
        updateCharts();
        renderFullTransactions();
    });

    initCharts();
    setupEventListeners();

    // Set default date for the inline form in DD/MM/YYYY format
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('date').value = `${day}/${month}/${year}`;
}

function updateDashboard() {

    // Calculate Summary
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Previous month key for trend comparison
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const totals = transactions.reduce((acc, tx) => {
        const txDate = new Date(tx.date);
        const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

        if (txMonthKey === currentMonthKey) {
            if (tx.type === 'income') acc.income += tx.amount;
            else if (tx.type === 'expense') acc.expense += tx.amount;
        } else if (txMonthKey === prevMonthKey) {
            if (tx.type === 'income') acc.prevIncome += tx.amount;
            else if (tx.type === 'expense') acc.prevExpense += tx.amount;
        }

        // Savings are accumulated over all time
        if (tx.type === 'saving') {
            acc.balance += tx.amount;
        }
        return acc;
    }, { balance: 0, income: 0, expense: 0, prevIncome: 0, prevExpense: 0 });

    // Update UI
    totalBalanceEl.textContent = `฿${totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    monthlyIncomeEl.textContent = `฿${totals.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    monthlyExpenseEl.textContent = `฿${totals.expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // Update Trends (Compare current vs previous month)
    updateTrend('monthlyIncome', totals.income, totals.prevIncome, true);
    updateTrend('monthlyExpense', totals.expense, totals.prevExpense, false);

    // Update Goal Progress
    const goalAmount = 50000;
    const progress = Math.min((totals.income / goalAmount) * 100, 100);
    const progressBar = document.getElementById('goalProgressBar');
    const statusText = document.getElementById('goalStatusText');
    const goalCurrentEl = document.getElementById('goalCurrent');

    if (goalCurrentEl) {
        goalCurrentEl.textContent = `฿${totals.income.toLocaleString()}`;
    }

    if (progressBar && statusText) {
        progressBar.style.width = `${progress}%`;
        statusText.textContent = progress >= 100 ? 'ยินดีด้วย! บรรลุเป้าหมายแล้ว 🥳' : `กำลังดำเนินการ (${progress.toFixed(1)}%)`;
    }

    renderShortTransactions();
    renderFullTransactions();
    updateMonthFilterOptions();
    if (mainChart) updateCharts();
}

function updateTrend(elementId, current, previous, isIncome) {
    const card = document.getElementById(elementId).closest('.card');
    const trendEl = card.querySelector('.trend');
    if (!trendEl) return;

    let percent = 0;
    if (previous > 0) {
        percent = ((current - previous) / previous) * 100;
    } else if (current > 0) {
        percent = 100;
    }

    const isPositive = percent >= 0;
    const absPercent = Math.abs(percent).toFixed(1);

    // For income, positive is good. For expense, negative is good.
    const isGood = isIncome ? isPositive : !isPositive;

    trendEl.className = `trend ${isGood ? 'up' : 'down'}`;
    trendEl.innerHTML = `
        <i data-lucide="${isPositive ? 'trending-up' : 'trending-down'}"></i>
        ${isPositive ? '+' : '-'}${absPercent}%
    `;

    // Apply colors directly to balance the CSS
    trendEl.style.color = isGood ? 'var(--success)' : 'var(--danger)';
}

function updateMonthFilterOptions() {
    const filterMonthEl = document.getElementById('filterMonth');
    const chartMonthEl = document.getElementById('filterChartMonth');

    const selectedMain = filterMonthEl.value;
    const selectedChart = chartMonthEl.value;

    // Get unique months from transactions
    const months = [...new Set(transactions.map(tx => {
        const date = new Date(tx.date);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();

    const commonOptions = '<option value="all">ทั้งหมด</option>';
    filterMonthEl.innerHTML = commonOptions;
    chartMonthEl.innerHTML = commonOptions;

    months.forEach(m => {
        const [year, month] = m.split('-');
        const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const label = `${monthNames[parseInt(month) - 1]} ${year}`;

        const opt1 = document.createElement('option');
        opt1.value = m;
        opt1.textContent = label;
        filterMonthEl.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = m;
        opt2.textContent = label;
        chartMonthEl.appendChild(opt2);
    });

    filterMonthEl.value = months.includes(selectedMain) || selectedMain === 'all' ? selectedMain : 'all';
    chartMonthEl.value = months.includes(selectedChart) || selectedChart === 'all' ? selectedChart : 'all';
}

function renderShortTransactions() {
    transactionsListShortEl.innerHTML = '';
    // Sort by date descending, then by ID descending (newest on top)
    const sorted = [...transactions].sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });

    if (sorted.length === 0) {
        transactionsListShortEl.innerHTML = '<div class="empty-state"><p>ไม่มีรายการในขณะนี้</p></div>';
        return;
    }

    sorted.slice(0, 5).forEach(tx => {
        const item = createTransactionElement(tx);
        // Add delete listener for short list
        item.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(tx.id));
        transactionsListShortEl.appendChild(item);
    });

    lucide.createIcons();
}

function renderFullTransactions() {
    const summaryContainer = document.getElementById('summaryGroupedContainer');
    const summaryList = document.getElementById('summaryGroupedList');
    transactionsListFullEl.innerHTML = '';
    summaryList.innerHTML = '';

    // 1. Initial filtered list from all transactions
    let filtered = [...transactions];

    // 2. Apply Type Filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(tx => tx.type === currentFilter);
    }

    // 3. Apply Month Filter
    if (currentMonthFilter !== 'all') {
        filtered = filtered.filter(tx => {
            const date = new Date(tx.date);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return monthStr === currentMonthFilter;
        });

        // 4. Generate Grouped Summary (Only if a specific month is selected)
        const grouped = filtered.reduce((acc, tx) => {
            const key = `${tx.type}_${tx.description.trim()}`;
            if (!acc[key]) {
                acc[key] = {
                    description: tx.description.trim(),
                    type: tx.type,
                    amount: 0
                };
            }
            acc[key].amount += tx.amount;
            return acc;
        }, {});

        const groupedEntries = Object.values(grouped);
        if (groupedEntries.length > 0) {
            summaryContainer.style.display = 'block';
            groupedEntries.forEach(group => {
                const amountClass = group.type === 'income' ? 'text-success' : group.type === 'expense' ? 'text-danger' : 'text-main';
                const prefix = group.type === 'income' ? '+' : group.type === 'expense' ? '-' : '•';
                const item = document.createElement('div');
                item.className = 'grouped-item';
                item.innerHTML = `
                    <span class="grouped-topic">${group.description}</span>
                    <span class="grouped-amount ${amountClass}">${prefix} ฿${group.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                `;
                summaryList.appendChild(item);
            });
        } else {
            summaryContainer.style.display = 'none';
        }
    } else {
        summaryContainer.style.display = 'none';
    }

    // 5. Sort for the detailed list
    filtered.sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });

    // 6. Pagination & Rendering the Raw List

    // Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filtered.slice(start, end);

    if (pageItems.length === 0) {
        transactionsListFullEl.innerHTML = '<div class="empty-state"><p>ไม่พบรายการธุรกรรม</p></div>';
    } else {
        pageItems.forEach(tx => {
            const item = createTransactionElement(tx);
            // Add delete listener for full list
            item.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(tx.id));
            transactionsListFullEl.appendChild(item);
        });
    }

    // Update pagination UI
    document.getElementById('pageInfo').textContent = `หน้า ${currentPage} จาก ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;

    lucide.createIcons();
}

function createTransactionElement(tx) {
    const iconColor = tx.type === 'income' ? 'var(--success)' :
        tx.type === 'expense' ? 'var(--danger)' : '#08fefa'; // Cyan for saving
    const iconName = tx.type === 'income' ? 'trending-up' :
        tx.type === 'expense' ? 'trending-down' : 'piggy-bank';
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.innerHTML = `
        <div class="tx-main-info">
            <div class="tx-icon" style="background-color: ${iconColor}">
                <i data-lucide="${iconName}"></i>
            </div>
            <div class="tx-details">
                <p class="tx-name">${tx.description}</p>
                <p class="tx-date">${formatDate(tx.date)}</p>
            </div>
        </div>
        <div class="tx-right-side">
            <div class="tx-amount ${tx.type === 'income' ? 'text-success' : tx.type === 'expense' ? 'text-danger' : 'text-main'}" style="${tx.type === 'saving' ? 'color: #08fefa' : ''}">
                ${tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '•'} ฿${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <button class="btn-delete" title="ลบรายการ">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `;
    return item;
}

function deleteTransaction(id) {
    // Find the transaction to get its unique Firebase key
    const txToDelete = transactions.find(t => t.id === id);
    if (!txToDelete || !txToDelete.firebaseKey) return;

    if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
        // Remove from Firebase directly - the 'on value' listener will update the UI
        transactionsRef.child(txToDelete.firebaseKey).remove()
            .then(() => console.log('Deleted from Firebase'))
            .catch(err => console.error('Delete failed:', err));
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function initCharts() {
    const ctxMain = document.getElementById('mainChart').getContext('2d');
    const ctxCat = document.getElementById('categoryChart').getContext('2d');

    const months = ['ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.'];

    mainChart = new Chart(ctxMain, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'รายรับ',
                    data: [0, 0, 0, 0, 0, 0],
                    borderColor: '#34d399', // Green for income
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'รายจ่าย',
                    data: [0, 0, 0, 0, 0, 0],
                    borderColor: '#fb7185', // Red for expense
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4
                },
                {
                    label: 'เงินเก็บ',
                    data: [0, 0, 0, 0, 0, 0],
                    borderColor: '#08fefa', // Cyan for saving
                    backgroundColor: 'rgba(8, 254, 250, 0.1)',
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });

    categoryChart = new Chart(ctxCat, {
        type: 'bar',
        data: getCategoryData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function getCategoryData() {
    // Filter transactions based on selected month for the bar chart
    let dataPool = [...transactions];
    if (currentChartMonthFilter !== 'all') {
        dataPool = dataPool.filter(tx => {
            const date = new Date(tx.date);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return monthStr === currentChartMonthFilter;
        });
    }

    const incomeTotal = dataPool.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const expenseTotal = dataPool.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const savingTotal = dataPool.filter(tx => tx.type === 'saving').reduce((sum, tx) => sum + tx.amount, 0);

    const labels = ['รายรับทั้งหมด', 'รายจ่ายทั้งหมด', 'เงินเก็บทั้งหมด'];
    const data = [incomeTotal, expenseTotal, savingTotal];
    const colors = ['#34d399', '#fb7185', '#08fefa']; // Green, Red, Cyan

    return {
        labels: incomeTotal === 0 && expenseTotal === 0 && savingTotal === 0 ? ['ไม่มีข้อมูล'] : labels,
        datasets: [{
            data: incomeTotal === 0 && expenseTotal === 0 && savingTotal === 0 ? [0, 0, 0] : data,
            backgroundColor: colors,
            borderRadius: 8,
            borderWidth: 0
        }]
    };
}

function updateCharts() {
    categoryChart.data = getCategoryData();
    categoryChart.update();

    const totals = transactions.reduce((acc, tx) => {
        if (tx.type === 'income') acc.income += tx.amount;
        else if (tx.type === 'expense') acc.expense += tx.amount;
        else if (tx.type === 'saving') acc.saving += tx.amount;
        return acc;
    }, { income: 0, expense: 0, saving: 0 });

    mainChart.data.datasets[0].data[5] = totals.income;
    mainChart.data.datasets[1].data[5] = totals.expense;
    mainChart.data.datasets[2].data[5] = totals.saving;
    mainChart.update();
}

function switchView(viewName) {
    if (viewName === 'overview') {
        viewOverview.style.display = 'block';
        viewAllTransactions.style.display = 'none';
        menuOverview.classList.add('active');
        menuTransactions.classList.remove('active');
        if (mobileMenuOverview) mobileMenuOverview.classList.add('active');
        if (mobileMenuTransactions) mobileMenuTransactions.classList.remove('active');
    } else {
        viewOverview.style.display = 'none';
        viewAllTransactions.style.display = 'block';
        menuOverview.classList.remove('active');
        menuTransactions.classList.add('active');
        if (mobileMenuOverview) mobileMenuOverview.classList.remove('active');
        if (mobileMenuTransactions) mobileMenuTransactions.classList.add('active');

        // Reset to current month by default if no filter is set
        if (currentMonthFilter === 'all') {
            const now = new Date();
            currentMonthFilter = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            document.getElementById('filterMonth').value = currentMonthFilter;
        }

        renderFullTransactions();
    }
}

function setupEventListeners() {
    const dateInput = document.getElementById('date');
    const calendarTrigger = document.getElementById('calendarTrigger');

    // Navigation
    menuOverview.addEventListener('click', () => switchView('overview'));
    menuTransactions.addEventListener('click', () => switchView('transactions'));
    viewAllLink.addEventListener('click', () => switchView('transactions'));

    // Mobile Navigation
    if (mobileMenuOverview) mobileMenuOverview.addEventListener('click', (e) => { e.preventDefault(); switchView('overview'); });
    if (mobileMenuTransactions) mobileMenuTransactions.addEventListener('click', (e) => { e.preventDefault(); switchView('transactions'); });

    // Filters
    document.getElementById('filterType').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        currentPage = 1;
        renderFullTransactions();
    });

    document.getElementById('filterMonth').addEventListener('change', (e) => {
        currentMonthFilter = e.target.value;
        currentPage = 1;
        renderFullTransactions();
    });

    document.getElementById('filterChartMonth').addEventListener('change', (e) => {
        currentChartMonthFilter = e.target.value;
        if (categoryChart) categoryChart.update();
        updateCharts(); // Refresh chart data
    });

    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderFullTransactions();
        }
    });
    document.getElementById('nextPage').addEventListener('click', () => {
        const filteredCount = currentFilter === 'all' ? transactions.length : transactions.filter(t => t.type === currentFilter).length;
        if (currentPage < Math.ceil(filteredCount / itemsPerPage)) {
            currentPage++;
            renderFullTransactions();
        }
    });

    // Initialize Flatpickr
    const fp = flatpickr(dateInput, {
        dateFormat: "d/m/Y",
        locale: "th",
        disableMobile: "true",
        theme: "dark",
        allowInput: true,
        onChange: function (selectedDates, dateStr) {
            dateInput.value = dateStr;
        }
    });

    calendarTrigger.addEventListener('click', () => fp.open());

    dateInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 2 && value.length <= 4) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        } else if (value.length > 4) {
            value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4, 8);
        }
        e.target.value = value;
    });

    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dateStr = document.getElementById('date').value;
        const [d, m, y] = dateStr.split('/');

        if (!d || !m || !y || y.length < 4) {
            alert('กรุณากรอกวันที่ให้ถูกต้อง (วว/ดด/ปปปป)');
            return;
        }

        const newTransaction = {
            id: Date.now(),
            type: transactionForm.type.value,
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            category: 'other', // Default to other since input is removed
            date: `${y}-${m}-${d}`
        };

        // Push to Firebase instead of local array
        transactionsRef.push(newTransaction);

        if (GOOGLE_SHEET_URL) {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTransaction)
            }).catch(err => console.error('Sheet sync failed', err));
        }

        transactionForm.reset();
        const today = new Date();
        document.getElementById('date').value = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    });
}

init();
