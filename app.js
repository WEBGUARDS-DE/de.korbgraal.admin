// Global Variables
let authContainer, mainContent, loginForm, logoutBtn, userEmail;
let revenueChart, typesChart;
let currentUser = null;
let autoRefreshInterval = null;

// Initialize when Firebase is ready
document.addEventListener('firebaseReady', () => {
    console.log("🎯 Firebase ready event fired - initializing app");
    initializeApp();
});

// Fallback: Also try on DOMContentLoaded with a short delay
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.auth) {
            console.error("❌ Firebase still not ready after DOM load");
        }
    }, 3000);
});

function initializeApp() {
    authContainer = document.getElementById('authContainer');
    mainContent = document.getElementById('mainContent');
    loginForm = document.getElementById('loginForm');
    logoutBtn = document.getElementById('logoutBtn');
    userEmail = document.getElementById('userEmail');

    // Setup login form
    loginForm.addEventListener('submit', handleLogin);

    // Setup auth state
    window.auth.onAuthStateChanged(handleAuthStateChanged);
    console.log("✅ App initialized");
}

// ==================== AUTH ====================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');

    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginError.style.display = 'none';
    } catch (error) {
        loginError.textContent = 'Login fehlgeschlagen: ' + error.message;
        loginError.style.display = 'block';
    }
}

async function handleAuthStateChanged(user) {
    if (user) {
        currentUser = user;
        authContainer.style.display = 'none';
        mainContent.style.display = 'block';
        userEmail.textContent = user.email;
        document.getElementById('fbProject').textContent = APP_CONFIG.appName;
        console.log("✅ User logged in:", user.email);

        // Load all data
        loadDashboard();

        // Setup auto-refresh
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        autoRefreshInterval = setInterval(() => {
            refreshContracts();
            refreshSyncLogs();
            refreshPrintLogs();
        }, APP_CONFIG.refreshInterval);
    } else {
        currentUser = null;
        authContainer.style.display = 'flex';
        mainContent.style.display = 'none';
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        console.log("⚠️ User logged out");
    }
}

function signOut() {
    auth.signOut();
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    try {
        console.log("🔍 DEBUG loadDashboard:");
        console.log("  - currentUser:", window.auth.currentUser);
        console.log("  - currentUser.uid:", window.auth.currentUser?.uid);
        console.log("  - db:", window.db);

        // Load statistics
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log("📍 Versuche Contracts zu laden von: contracts/v2/" + SHARED_UID);
        const contractsRef = db.collection('contracts').doc('v2').collection(SHARED_UID);
        console.log("📍 Query ausführen (ohne WHERE für Test)...");

        // Test: Lade ALLE contracts ohne WHERE-Clause um Permissions zu testen
        const snapshot = await contractsRef.get();
        console.log("✅ Contracts geladen! Dokumente:", snapshot.size);

        let todayContracts = 0;
        let todayRevenue = 0;

        snapshot.forEach(doc => {
            if (!doc.data().isDeleted) {
                todayContracts++;
                todayRevenue += doc.data().price || 0;
            }
        });

        document.getElementById('stat-today').textContent = todayContracts;
        document.getElementById('stat-revenue').textContent = todayRevenue + '€';

        // Load users count (Test: ohne WHERE)
        const usersRef = db.collection('users');
        console.log("📍 Lade Users...");
        const usersSnapshot = await usersRef.get();
        console.log("✅ Users geladen:", usersSnapshot.size);

        const newUserCount = Array.from(usersSnapshot.docs).filter(doc => doc.data().appVersion === 'new').length;
        document.getElementById('stat-users').textContent = newUserCount;

        // Load devices - from sync logs (Test: ohne limit)
        const syncLogsRef = db.collection('sync-logs');
        console.log("📍 Lade Sync-Logs...");
        const devicesSnapshot = await syncLogsRef.get();
        console.log("✅ Sync-Logs geladen:", devicesSnapshot.size);

        const uniqueDevices = new Set();
        devicesSnapshot.forEach(doc => {
            if (doc.data().user) uniqueDevices.add(doc.data().user);
        });
        document.getElementById('stat-devices').textContent = uniqueDevices.size;

        // Load charts
        loadCharts();

        // Load all tables
        await refreshContracts();
        await refreshContracts2025();
        await refreshSyncLogs();
        await refreshPrintLogs();
        await loadUsers();
        await loadDevices();
        await loadPrices();
        await loadRefundConfig();
        await loadChairs();
        await loadChairPlan();
        await loadCategories();
        await loadPlanPositions();
        await loadPlanCategories();
        await loadContractsReservation();

    } catch (error) {
        console.error('Dashboard load error:', error);
        alert('Fehler beim Laden des Dashboards: ' + error.message);
    }
}

async function loadCharts() {
    try {
        // Revenue Chart (7 days)
        const labels = [];
        const data = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const contractsRef = db.collection('contracts').doc('v2').collection(SHARED_UID);
            const snapshot = await contractsRef
                .where('startDateTime', '>=', date)
                .where('startDateTime', '<', nextDate)
                .get();

            let revenue = 0;
            snapshot.forEach(doc => {
                if (!doc.data().isDeleted) {
                    revenue += doc.data().price || 0;
                }
            });

            labels.push(date.toLocaleDateString('de-DE', { weekday: 'short', month: 'numeric', day: 'numeric' }));
            data.push(revenue);
        }

        const revenueCtx = document.getElementById('revenueChart');
        if (revenueChart) revenueChart.destroy();

        revenueChart = new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Umsatz (€)',
                    data: data,
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Umsatz (€)' }
                    }
                }
            }
        });

        // Types Chart (Distribution)
        const typesRef = db.collection('contracts').doc('v2').collection(SHARED_UID);
        const typesSnapshot = await typesRef.get();

        const typesCounts = {};
        typesSnapshot.forEach(doc => {
            if (!doc.data().isDeleted) {
                const type = doc.data().product || 'Unbekannt';
                typesCounts[type] = (typesCounts[type] || 0) + 1;
            }
        });

        const typesCtx = document.getElementById('typesChart');
        if (typesChart) typesChart.destroy();

        typesChart = new Chart(typesCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typesCounts),
                datasets: [{
                    data: Object.values(typesCounts),
                    backgroundColor: [
                        '#FF9800',
                        '#FFA726',
                        '#FFB74D',
                        '#FFCC80',
                        '#FFE0B2',
                        '#FFF3E0'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: true } }
            }
        });

    } catch (error) {
        console.error('Charts load error:', error);
    }
}

// ==================== CONTRACTS ====================
async function refreshContracts() {
    try {
        // Load all users first (für Email-Mapping)
        const usersSnapshot = await db.collection('users').get();
        const userMap = new Map();
        usersSnapshot.forEach(doc => {
            userMap.set(doc.id, doc.data().email || 'Unknown');
        });

        const contractsRef = db.collection('contracts').doc('v2').collection(SHARED_UID);
        // Ohne orderBy/limit zum Testen
        const snapshot = await contractsRef.get();

        const tbody = document.querySelector('#contractsTable tbody');
        let html = '';

        if (snapshot.empty) {
            html = '<tr><td colspan="8" class="text-center text-muted">Keine Buchungen gefunden</td></tr>';
        } else {
            // Sammle alle Dokumente und sortiere sie
            const docs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Unterstütze beide Strukturen: startDateTime (Timestamp) und startTime (ISO String)
                let startTime;
                if (data.startDateTime?.toDate) {
                    startTime = data.startDateTime.toDate();
                } else if (data.startTime) {
                    startTime = new Date(data.startTime);
                } else {
                    startTime = new Date();
                }
                docs.push({ doc, data, startTime });
            });

            // Sortiere nach startTime (jüngste zuerst)
            docs.sort((a, b) => b.startTime - a.startTime);

            // Rendere sortierte Dokumente
            docs.forEach(({ doc, data, startTime }) => {
                // Verarbeite endTime (kann Timestamp oder ISO String sein)
                let endTime;
                if (data.endDateTime?.toDate) {
                    endTime = data.endDateTime.toDate();
                } else if (data.endTime) {
                    endTime = new Date(data.endTime);
                } else {
                    endTime = new Date();
                }

                // Status Mapping (wie v2025)
                let status = 'Unbekannt';
                let statusBadge = 'secondary';

                if (data.isDeleted) {
                    status = 'Storniert';
                    statusBadge = 'danger';
                } else if (data.state === 'CONTRACT_READY') {
                    status = 'Gebucht';
                    statusBadge = 'success';
                } else if (data.state === 'RESERVATION_COMPLETE') {
                    status = 'Reserviert';
                    statusBadge = 'warning';
                } else if (data.state === 'TERMINATED') {
                    status = 'Beendet';
                    statusBadge = 'danger';
                } else {
                    status = data.state || 'Aktiv';
                    statusBadge = 'info';
                }

                // Bezahlt Badge
                const paidBadge = data.isPayed ? 'success' : 'secondary';
                const paidText = data.isPayed ? 'Ja' : 'Nein';

                // Korb (neue Struktur hat "chair" statt "chairName")
                const chair = data.chairName || data.chair || 'N/A';

                // Kunde (neue Struktur hat "customer")
                const customer = data.customer || 'N.N.';

                // Kunde Spalte nur editierbar wenn "N.N." oder "n.n." (case-insensitive)
                const isEditableCustomer = customer?.toUpperCase() === 'N.N.';
                const customerCell = isEditableCustomer
                    ? `<small style="cursor: pointer; text-decoration: underline; color: #FF9800;" onclick="editCustomer('${doc.id}', '${customer}')">${customer} ✏️</small>`
                    : `<small>${customer}</small>`;

                html += `
                    <tr>
                        <td><small>${doc.id.substring(0, 8)}</small></td>
                        <td>${chair}</td>
                        <td>${customerCell}</td>
                        <td>${startTime.toLocaleString('de-DE')}</td>
                        <td>${endTime.toLocaleString('de-DE')}</td>
                        <td><strong>${data.price || 0}€</strong></td>
                        <td><span class="badge bg-${paidBadge}">${paidText}</span></td>
                        <td><span class="badge bg-${statusBadge}">${status}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-orange" onclick="editContract('${doc.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Contracts load error:', error);
    }
}

async function editContract(contractId) {
    try {
        const contractDoc = await db.collection('contracts').doc('v2').collection(SHARED_UID).doc(contractId).get();
        if (contractDoc.exists) {
            const data = contractDoc.data();
            const newPrice = prompt('Neuer Preis:', data.price);
            if (newPrice !== null && !isNaN(newPrice)) {
                await contractDoc.ref.update({ price: parseFloat(newPrice) });
                refreshContracts();
                alert('Buchung aktualisiert!');
            }
        }
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
}

async function editCustomer(contractId, currentCustomer) {
    const newCustomer = prompt('Neuer Kundenname:', currentCustomer);
    if (newCustomer !== null && newCustomer !== '') {
        try {
            await db.collection('contracts').doc('v2').collection(SHARED_UID).doc(contractId).update({
                customer: newCustomer
            });
            refreshContracts();
            showToast('✅ Kundenname aktualisiert!', 'success');
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

async function editCustomer2025(contractId, currentCustomer) {
    const newCustomer = prompt('Neuer Kundenname:', currentCustomer);
    if (newCustomer !== null && newCustomer !== '') {
        try {
            await db.collection('contracts').doc('v2').collection(OLD_UID).doc(contractId).update({
                customer: newCustomer
            });
            refreshContracts2025();
            showToast('✅ Kundenname aktualisiert!', 'success');
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// ==================== CONTRACTS 2025 ====================
const OLD_UID = 'QXyzCIkPR6TU2ZRPYAz1UKpotXz2';

async function refreshContracts2025() {
    try {
        // Lade Email des Benutzers und update Tab-Titel
        const userDoc = await db.collection('users').doc(OLD_UID).get();
        if (userDoc.exists) {
            const userEmail = userDoc.data().email || OLD_UID;
            const tabHeader = document.querySelector('#contracts2025 .card-header span');
            if (tabHeader) {
                tabHeader.textContent = `Buchungen v2025 (${userEmail})`;
            }
        }

        const contractsRef = db.collection('contracts').doc('v2').collection(OLD_UID);
        const snapshot = await contractsRef.get();

        const tbody = document.querySelector('#contractsTable2025 tbody');
        let html = '';

        // Filter: Nur Buchungen ab 2026-06-22
        const filterDate = new Date('2026-06-22');

        if (snapshot.empty) {
            html = '<tr><td colspan="7" class="text-center text-muted">Keine Buchungen gefunden</td></tr>';
        } else {
            // Sammle alle Dokumente und sortiere sie
            const docs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const startTime = new Date(data.startTime);

                // Filter:
                // 1. Nur Buchungen ab 2026-06-22
                // 2. Nicht storniert (isDeleted = false)
                // 3. Nicht TERMINATED
                if (startTime >= filterDate &&
                    !data.isDeleted &&
                    data.state !== 'TERMINATED') {
                    docs.push({ doc, data, startTime });
                }
            });

            // Wenn keine Buchungen nach Filter
            if (docs.length === 0) {
                html = '<tr><td colspan="7" class="text-center text-muted">Keine Buchungen ab 2026-06 gefunden</td></tr>';
            } else {
                // Sortiere nach startTime (jüngste zuerst)
                docs.sort((a, b) => b.startTime - a.startTime);

                // Rendere sortierte Dokumente
                docs.forEach(({ doc, data, startTime }) => {
                const endTime = new Date(data.endTime);

                // Status Mapping
                let status = 'Unbekannt';
                let statusBadge = 'secondary';

                if (data.isDeleted) {
                    status = 'Storniert';
                    statusBadge = 'danger';
                } else if (data.state === 'CONTRACT_READY') {
                    status = 'Gebucht';
                    statusBadge = 'success';
                } else if (data.state === 'RESERVATION_COMPLETE') {
                    status = 'Reserviert';
                    statusBadge = 'warning'; // Orange
                } else if (data.state === 'TERMINATED') {
                    status = 'Beendet';
                    statusBadge = 'danger';
                } else {
                    status = data.state || 'Aktiv';
                    statusBadge = 'info';
                }

                // Customer als Email verwenden
                const customerEmail = data.customer || data.uid || 'Unbekannt';

                const paidBadge = data.isPayed ? 'success' : 'secondary';
                const paidText = data.isPayed ? 'Ja' : 'Nein';

                // Kunde Spalte nur editierbar wenn "N.N." oder "n.n." (case-insensitive)
                const isEditableCustomer2025 = customerEmail?.toUpperCase() === 'N.N.';
                const customerCell2025 = isEditableCustomer2025
                    ? `<small style="cursor: pointer; text-decoration: underline; color: #FF9800;" onclick="editCustomer2025('${doc.id}', '${customerEmail}')">${customerEmail} ✏️</small>`
                    : `<small>${customerEmail}</small>`;

                html += `
                    <tr>
                        <td>${data.chair || 'N/A'}</td>
                        <td>${customerCell2025}</td>
                        <td>${startTime.toLocaleString('de-DE')}</td>
                        <td>${endTime.toLocaleString('de-DE')}</td>
                        <td><strong>${data.price || 0}€</strong></td>
                        <td><span class="badge bg-${paidBadge}">${paidText}</span></td>
                        <td><span class="badge bg-${statusBadge}">${status}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-orange" onclick="editContract2025('${doc.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            }
        }

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Contracts 2025 load error:', error);
    }
}

async function editContract2025(contractId) {
    try {
        const contractDoc = await db.collection('contracts').doc('v2').collection(OLD_UID).doc(contractId).get();
        if (contractDoc.exists) {
            const data = contractDoc.data();
            const newPrice = prompt('Neuer Preis:', data.price);
            if (newPrice !== null && !isNaN(newPrice)) {
                await contractDoc.ref.update({ price: parseFloat(newPrice) });
                refreshContracts2025();
                alert('Buchung aktualisiert!');
            }
        }
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
}

function exportCSV2025() {
    let csv = 'ID,Korb,Email,Startzeit,Endzeit,Preis,Status\n';
    document.querySelectorAll('#contractsTable2025 tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const values = Array.from(cells).map(cell => '"' + cell.textContent.trim() + '"').join(',');
            csv += values + '\n';
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookings_2025_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
}

function exportCSV() {
    let csv = 'ID,Korb,UID,Startzeit,Endzeit,Preis,Status\n';
    document.querySelectorAll('#contractsTable tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const values = Array.from(cells).map(cell => '"' + cell.textContent.trim() + '"').join(',');
            csv += values + '\n';
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookings_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
}

// ==================== SYNC LOGS ====================
async function refreshSyncLogs() {
    try {
        // Load all users first (für Email-Mapping)
        const usersSnapshot = await db.collection('users').get();
        const userMap = new Map();
        usersSnapshot.forEach(doc => {
            userMap.set(doc.id, doc.data().email || 'Unknown');
        });

        const syncLogsRef = db.collection('sync-logs');
        const snapshot = await syncLogsRef.get();

        const tbody = document.querySelector('#syncLogsTable tbody');
        let html = '';

        if (snapshot.empty) {
            html = '<tr><td colspan="5" class="text-center text-muted">Keine Sync-Logs gefunden</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
                const statusBadge = data.status === 'success' ? 'success' : 'danger';

                const userId = data.user || SHARED_UID;
                const userEmail = userMap.get(userId) || userId.substring(0, 8);

                html += `
                    <tr>
                        <td>${userEmail}</td>
                        <td>${data.cashier || '-'}</td>
                        <td>${timestamp.toLocaleString('de-DE')}</td>
                        <td><span class="badge bg-${statusBadge}">${data.status || 'unknown'}</span></td>
                        <td>${data.error || '-'}</td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Sync logs error:', error);
    }
}

// ==================== PRINT LOGS ====================
async function refreshPrintLogs() {
    try {
        // Load all users first (für Email-Mapping)
        const usersSnapshot = await db.collection('users').get();
        const userMap = new Map();
        usersSnapshot.forEach(doc => {
            userMap.set(doc.id, doc.data().email || 'Unknown');
        });

        const printLogsRef = db.collection('print-logs');
        const snapshot = await printLogsRef.get();

        const tbody = document.querySelector('#printLogsTable tbody');
        let html = '';

        if (snapshot.empty) {
            html = '<tr><td colspan="5" class="text-center text-muted">Keine Print-Logs gefunden</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);

                const userId = data.user || SHARED_UID;
                const userEmail = userMap.get(userId) || userId.substring(0, 8);

                html += `
                    <tr>
                        <td>${userEmail}</td>
                        <td>${data.cashier || '-'}</td>
                        <td>${timestamp.toLocaleString('de-DE')}</td>
                        <td><strong>${data.subtotal || 0}€</strong></td>
                        <td><span class="badge bg-info">${data.type || 'subtotal'}</span></td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Print logs error:', error);
    }
}

// ==================== PRICES ====================
async function loadPrices() {
    try {
        const pricesGrid = document.getElementById('pricesGrid');
        console.log("📍 Lade Preise");

        const firebasePrices = {};

        for (const category of ['KLASSIK', 'KOMFORT']) {
            const priceDoc = await db.collection('prices').doc(category).get();
            if (priceDoc.exists) {
                firebasePrices[category] = priceDoc.data();
            }
        }

        let html = '';

        for (const [category, data] of Object.entries(firebasePrices)) {
            html += `<div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header"><strong>${category}</strong> Preise</div>
                    <div class="card-body">`;

            if (data.durations) {
                // 1 Stunde
                if (typeof data.durations['1'] === 'number') {
                    html += `
                        <div class="mb-2 d-flex justify-content-between align-items-center">
                            <label><small>1 Stunde</small></label>
                            <div class="input-group input-group-sm" style="width: 120px;">
                                <input type="number" class="form-control price-input"
                                       data-category="${category}" data-duration="1" 
                                       value="${data.durations['1']}">
                                <span class="input-group-text">€</span>
                            </div>
                        </div>
                    `;
                }

                // 2 Stunden
                if (typeof data.durations['2'] === 'number') {
                    html += `
                        <div class="mb-2 d-flex justify-content-between align-items-center">
                            <label><small>2 Stunden</small></label>
                            <div class="input-group input-group-sm" style="width: 120px;">
                                <input type="number" class="form-control price-input"
                                       data-category="${category}" data-duration="2" 
                                       value="${data.durations['2']}">
                                <span class="input-group-text">€</span>
                            </div>
                        </div>
                    `;
                }

                // Halbtag vor 16 Uhr (ab 13:30)
                const halfday = data.durations['6'];
                if (halfday && typeof halfday === 'object' && halfday.before) {
                    html += `
                        <div class="mb-2 d-flex justify-content-between align-items-center">
                            <label><small>ab 13:30</small></label>
                            <div class="input-group input-group-sm" style="width: 120px;">
                                <input type="number" class="form-control price-input"
                                       data-category="${category}" data-key="durations.6.before" 
                                       value="${halfday.before}">
                                <span class="input-group-text">€</span>
                            </div>
                        </div>
                    `;
                }

                // Halbtag ab 16 Uhr
                if (halfday && typeof halfday === 'object' && halfday.after) {
                    html += `
                        <div class="mb-2 d-flex justify-content-between align-items-center">
                            <label><small>ab 16:00</small></label>
                            <div class="input-group input-group-sm" style="width: 120px;">
                                <input type="number" class="form-control price-input"
                                       data-category="${category}" data-key="durations.6.after" 
                                       value="${halfday.after}">
                                <span class="input-group-text">€</span>
                            </div>
                        </div>
                    `;
                }

                // Tage (1-7)
                const dayLabels = {
                    '24': '1 Tag',
                    '48': '2 Tage',
                    '72': '3 Tage',
                    '96': '4 Tage',
                    '120': '5 Tage',
                    '144': '6 Tage',
                    '168': '7 Tage'
                };

                for (const [duration, label] of Object.entries(dayLabels)) {
                    if (typeof data.durations[duration] === 'number') {
                        html += `
                            <div class="mb-2 d-flex justify-content-between align-items-center">
                                <label><small>${label}</small></label>
                                <div class="input-group input-group-sm" style="width: 120px;">
                                    <input type="number" class="form-control price-input"
                                           data-category="${category}" data-duration="${duration}" 
                                           value="${data.durations[duration]}">
                                    <span class="input-group-text">€</span>
                                </div>
                            </div>
                        `;
                    }
                }
            }

            html += `</div></div></div>`;
        }

        pricesGrid.innerHTML = html;
        console.log("✅ Preisblatt gerendert (custom Reihenfolge)");

        document.querySelectorAll('.price-input').forEach(input => {
            input.addEventListener('change', updatePrice);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        alert('Fehler: ' + error.message);
    }
}

async function updatePrice(e) {
    const category = e.target.dataset.category;
    const key = e.target.dataset.duration || e.target.dataset.key;
    const value = parseFloat(e.target.value);

    try {
        const updateObj = {};
        if (key.includes('.')) {
            updateObj[key] = value;
        } else {
            updateObj[`durations.${key}`] = value;
        }
        updateObj['lastUpdated'] = new Date();

        await db.collection('prices').doc(category).update(updateObj);
        showToast(`✅ Gespeichert!`, 'success');
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
}

async function loadRefundConfig() {
    try {
        console.log("📍 Lade Refund-Config von /refund-prices/KLASSIK, KOMFORT");

        const refundConfig = {};

        // Lade direkt aus /refund-prices/{category}
        for (const category of ['KLASSIK', 'KOMFORT']) {
            try {
                const refundDoc = await db.collection('refund-prices').doc(category).get();
                if (refundDoc.exists) {
                    const data = refundDoc.data();
                    refundConfig[category] = {
                        grace_period_minutes: data.grace_period_minutes || 15,
                        one_hour_full_refund: data.one_hour_full_refund || 10,
                        one_hour_half_refund: data.one_hour_half_refund || 6
                    };
                    console.log(`✅ ${category} geladen:`, refundConfig[category]);
                } else {
                    console.warn(`⚠️ ${category} Dokument nicht gefunden, nutze Defaults`);
                    refundConfig[category] = {
                        grace_period_minutes: 15,
                        one_hour_full_refund: category === 'KLASSIK' ? 10 : 11,
                        one_hour_half_refund: category === 'KLASSIK' ? 6 : 7
                    };
                }
            } catch (e) {
                console.warn(`⚠️ ${category} Fehler:`, e.message);
            }
        }

        renderRefundConfig(refundConfig);

    } catch (error) {
        console.error('Refund config load error:', error);
    }
}

function renderRefundConfig(config) {
    const refundCard = document.getElementById('refundCard');
    if (!refundCard) return;

    let html = '<div class="row">';

    for (const [category, values] of Object.entries(config)) {
        html += `
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header"><strong>${category}</strong> Rückerstattungen</div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">Karenzzeit (Minuten)</label>
                            <input type="number" class="form-control refund-input"
                                   data-category="${category}" data-key="grace_period_minutes"
                                   value="${values.grace_period_minutes || 15}" min="0" max="60">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">nach 1 Stunde (€)</label>
                            <input type="number" class="form-control refund-input"
                                   data-category="${category}" data-key="one_hour_full_refund"
                                   value="${values.one_hour_full_refund || 10}" step="0.01" min="0">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">nach 2 Stunden (€)</label>
                            <input type="number" class="form-control refund-input"
                                   data-category="${category}" data-key="one_hour_half_refund"
                                   value="${values.one_hour_half_refund || 6}" step="0.01" min="0">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    html += '<button class="btn btn-orange" onclick="updateRefundConfig()">✅ Speichern</button>';

    refundCard.innerHTML = html;
}

async function updateRefundConfig() {
    try {
        console.log("📍 Speichere Refund-Config...");

        const inputs = document.querySelectorAll('.refund-input');
        const updates = {};

        // Sammle Änderungen pro Kategorie
        for (const input of inputs) {
            const category = input.dataset.category;
            const key = input.dataset.key;
            const value = key === 'grace_period_minutes'
                ? parseInt(input.value)
                : parseFloat(input.value);

            if (!updates[category]) updates[category] = {};
            updates[category][key] = value;
        }

        // Speichere für jede Kategorie
        for (const [category, values] of Object.entries(updates)) {
            await db.collection('refund-prices')
                .doc(category)
                .set({
                    ...values,
                    lastUpdated: new Date()
                }, { merge: true });
            console.log(`✅ ${category} gespeichert:`, values);
        }

        showToast('✅ Alle Rückerstattungen gespeichert!', 'success');
    } catch (error) {
        alert('Fehler: ' + error.message);
        console.error('Update error:', error);
    }
}

async function loadUsers() {
    try {
        const usersRef = db.collection('users');
        console.log("📍 loadUsers: Lade Users Collection...");
        const snapshot = await usersRef.get();
        console.log("📍 loadUsers: Query fertig, Dokumente:", snapshot.size);
        console.log("📍 loadUsers: Snapshot empty?", snapshot.empty);
        console.log("📍 loadUsers: Snapshot docs:", snapshot.docs.map(d => ({ id: d.id, email: d.data().email })));

        const tbody = document.querySelector('#usersTable tbody');
        let html = '';

        if (snapshot.empty) {
            html = '<tr><td colspan="5" class="text-center text-muted">Keine Benutzer gefunden</td></tr>';
        } else {
            // Sort by appVersion (new first, then others)
            const sortedDocs = snapshot.docs.sort((a, b) => {
                const versionA = a.data().appVersion || '';
                const versionB = b.data().appVersion || '';
                // 'new' kommt zuerst
                if (versionA === 'new' && versionB !== 'new') return -1;
                if (versionA !== 'new' && versionB === 'new') return 1;
                return versionA.localeCompare(versionB);
            });

            sortedDocs.forEach(doc => {
                const data = doc.data();
                const displayName = data.displayName || data.email?.split('@')[0] || 'Unknown';

                html += `
                    <tr>
                        <td>${displayName}</td>
                        <td>${data.email || '-'}</td>
                        <td><span class="badge bg-${data.appVersion === 'new' ? 'success' : 'warning'}">${data.appVersion || 'unknown'}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${doc.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;
        console.log(`✅ ${snapshot.size} Benutzer geladen`);
    } catch (error) {
        console.error('❌ Users load error:', error);
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Fehler beim Laden der Benutzer: ${error.message}</td></tr>`;
    }
}

async function createUser() {
    try {
        const email = document.getElementById('newUserEmail').value;
        const password = document.getElementById('newUserPassword').value;
        const appVersion = document.getElementById('newUserAppVersion').value;

        if (!email || !password) {
            alert('Bitte alle Felder ausfüllen');
            return;
        }

        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // Create user document
        await db.collection('users').doc(uid).set({
            email: email,
            appVersion: appVersion,
            createdAt: new Date(),
            displayName: email.split('@')[0]
        });

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
        modal.hide();

        // Reset form
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPassword').value = '';

        // Reload users
        await loadUsers();
        showToast('Benutzer erstellt!', 'success');

    } catch (error) {
        alert('Fehler beim Erstellen: ' + error.message);
    }
}

async function deleteUser(uid) {
    if (!confirm('Benutzer wirklich löschen?')) return;

    try {
        await db.collection('users').doc(uid).delete();
        await loadUsers();
        showToast('Benutzer gelöscht!', 'success');
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
}

// ==================== DEVICES ====================
async function loadDevices() {
    try {
        // Load all users first (für Email-Mapping)
        const usersSnapshot = await db.collection('users').get();
        const userMap = new Map();
        usersSnapshot.forEach(doc => {
            userMap.set(doc.id, doc.data().email || 'Unknown');
        });

        const syncLogsRef = db.collection('sync-logs');
        const snapshot = await syncLogsRef.get();

        const devicesMap = new Map();

        snapshot.forEach(doc => {
            const data = doc.data();
            const userId = data.user || SHARED_UID;
            const userEmail = userMap.get(userId) || userId.substring(0, 8);
            const deviceSerial = data.deviceSerial || data.user?.substring(0, 8) || 'Unknown';

            if (!devicesMap.has(deviceSerial)) {
                devicesMap.set(deviceSerial, {
                    deviceName: `Device ${deviceSerial}`,
                    deviceSerial: deviceSerial,
                    user: userEmail,
                    userId: userId,
                    lastSync: data.timestamp?.toDate?.() || new Date(data.timestamp),
                    status: data.status || 'unknown'
                });
            } else {
                // Update mit neuerer Zeit
                const existing = devicesMap.get(deviceSerial);
                const newTime = data.timestamp?.toDate?.() || new Date(data.timestamp);
                if (newTime > existing.lastSync) {
                    existing.lastSync = newTime;
                    existing.status = data.status || existing.status;
                }
            }
        });

        const tbody = document.querySelector('#devicesTable tbody');
        let html = '';

        if (devicesMap.size === 0) {
            html = '<tr><td colspan="5" class="text-center text-muted">Keine Geräte gefunden</td></tr>';
        } else {
            Array.from(devicesMap.values())
                .sort((a, b) => b.lastSync - a.lastSync) // Neueste zuerst
                .forEach(device => {
                    // Status Mapping
                    let statusText = device.status;
                    let statusBadge = 'warning';

                    if (device.status === 'success') {
                        statusText = 'erfolgreich';
                        statusBadge = 'success';
                    } else if (device.status === 'error') {
                        statusText = 'Fehler';
                        statusBadge = 'danger';
                    } else if (device.status === 'pending') {
                        statusText = 'Ausstehend';
                        statusBadge = 'info';
                    }

                    html += `
                        <tr>
                            <td><strong>${device.deviceName}</strong></td>
                            <td><small>${device.deviceSerial}</small></td>
                            <td>${device.user}</td>
                            <td>${device.lastSync.toLocaleString('de-DE')}</td>
                            <td><span class="badge bg-${statusBadge}">${statusText}</span></td>
                        </tr>
                    `;
                });
        }

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Devices load error:', error);
    }
}

// ==================== SETTINGS ====================
async function updateSettings() {
    try {
        const appName = document.getElementById('appName').value;
        const appVersion = document.getElementById('appVersion').value;

        await db.collection('settings').doc('config').set({
            appName: appName,
            appVersion: appVersion,
            updatedAt: new Date()
        }, { merge: true });

        showToast('Einstellungen gespeichert!', 'success');
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
}

// ==================== CHAIRS ====================
async function loadChairs() {
    try {
        const chairOrderRef = db.collection('chairOrder').doc(SHARED_UID);
        const snapshot = await chairOrderRef.get();

        const tbody = document.getElementById('chairsTable');
        let html = '';

        if (!snapshot.exists || !snapshot.data()) {
            html = '<tr><td colspan="4" class="text-center text-muted">Keine Körbe gefunden</td></tr>';
        } else {
            const data = snapshot.data();
            const positions = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));

            // Gruppiere in 2er-Paaren: (0,1), (2,3), (4,5), ...
            for (let i = 0; i < positions.length; i += 2) {
                const pos0 = positions[i];
                const pos1 = positions[i + 1];

                const chair0 = data[pos0] || '';
                const chair1 = pos1 ? (data[pos1] || '') : '';

                html += `
                    <tr>
                        <td><strong>${pos0}</strong></td>
                        <td class="chair-cell" data-position="${pos0}" data-value="${chair0}" onclick="editChairInline(this)">${chair0}</td>
                        <td class="chair-cell" data-position="${pos1 || ''}" data-value="${chair1}" onclick="editChairInline(this)" ${pos1 === undefined ? 'style="pointer-events:none; color: #ccc;"' : ''}>${chair1}</td>
                        <td><strong>${pos1 !== undefined ? pos1 : ''}</strong></td>
                    </tr>
                `;
            }
        }

        tbody.innerHTML = html;
        console.log('✅ Chairs geladen');
    } catch (error) {
        console.error('Chairs load error:', error);
    }
}

function editChairInline(cell) {
    if (!cell.dataset.position) return; // Keine Bearbeitung für leere Zellen
    
    const position = cell.dataset.position;
    const currentValue = cell.innerText;
    
    // Erstelle Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control';
    input.value = currentValue;
    input.style.maxWidth = '100px';
    
    // Ersetze Zelle-Inhalt mit Input
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    // Speichern bei Enter oder Blur
    const saveChair = async () => {
        const newValue = input.value.trim();
        
        try {
            const chairOrderRef = db.collection('chairOrder').doc(SHARED_UID);
            const snapshot = await chairOrderRef.get();
            const data = snapshot.data() || {};
            
            // Aktualisiere
            data[position] = newValue;
            
            await chairOrderRef.set(data);
            console.log(`✅ Position ${position} aktualisiert zu "${newValue}"`);
            
            // Reload
            await loadChairs();
        } catch (error) {
            console.error('Update error:', error);
            alert('Fehler beim Speichern');
            cell.innerText = currentValue; // Revert
        }
    };
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveChair();
    });
    
    input.addEventListener('blur', saveChair);
}

async function loadChairPlan() {
    try {
        const chairOrderRef = db.collection('chairOrder').doc(SHARED_UID);
        const snapshot = await chairOrderRef.get();
        const chairGrid = document.getElementById('chairGrid');
        let html = '<div class="row g-3">';

        if (!snapshot.exists || !snapshot.data()) {
            html += '<p class="text-center text-muted">Keine Körbe gefunden</p>';
        } else {
            const data = snapshot.data();
            const positions = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));

            positions.forEach(position => {
                const chairName = data[position];
                let bgColor = '#ffffff';
                let borderColor = '#999';
                let displayType = 'KLASSIK';

                if (chairName && chairName.toUpperCase().includes('K')) {
                    bgColor = '#ffc107';
                    borderColor = '#ff9800';
                    displayType = 'KOMFORT';
                } else if (!chairName || chairName === '' || chairName.toLowerCase() === 'xxx') {
                    bgColor = '#e0e0e0';
                    borderColor = '#999';
                    displayType = 'FREI';
                }

                html += `
                    <div class="col-md-6 col-lg-6">
                        <div class="card chair-card" style="background-color: ${bgColor}; border-color: ${borderColor}; cursor: pointer;" onclick="editChairFromPlan('${position}')" draggable="true" ondragstart="dragStart(event, '${position}')" ondrop="dragDrop(event, '${position}')" ondragover="allowDrop(event)" ondragend="dragEnd(event)">
                            <div class="card-body text-center" style="padding: 20px;">
                                <div style="font-size: 12px; opacity: 0.7; margin-bottom: 5px;"><strong>Position ${position}</strong></div>
                                <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">${chairName || 'FREI'}</div>
                                <div style="font-size: 12px; opacity: 0.8;"><span class="badge bg-${displayType === 'KOMFORT' ? 'warning' : 'secondary'}">${displayType}</span></div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        chairGrid.innerHTML = html;
        console.log('✅ Chair Plan geladen');
    } catch (error) {
        console.error('Chair plan error:', error);
    }
}

// ==================== PLAN POSITIONS ====================
async function loadPlanPositions() {
    try {
        console.log("📍 Lade Plan Positions...");
        const tbody = document.querySelector('#planPositionsTable');
        
        // Laden Sie alle Users und deren chairsOrder
        const usersRef = db.collection('users');
        const usersSnapshot = await usersRef.get();
        
        let html = '';
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            
            try {
                const ordersRef = db.collection('chairsOrder').doc(userId);
                const orderDoc = await ordersRef.get();
                
                if (orderDoc.exists) {
                    const orders = orderDoc.data();
                    
                    for (const [chairNum, data] of Object.entries(orders)) {
                        html += `
                            <tr>
                                <td><small>${userId}</small></td>
                                <td>${chairNum}</td>
                                <td>${data.category || '-'}</td>
                                <td>${data.position?.x || '-'}</td>
                                <td>${data.position?.y || '-'}</td>
                            </tr>
                        `;
                    }
                }
            } catch (error) {
                console.warn(`Fehler beim Laden von chairsOrder/${userId}:`, error);
            }
        }
        
        if (html === '') {
            html = '<tr><td colspan="5" class="text-center text-muted">Keine Positionen gefunden</td></tr>';
        }
        
        tbody.innerHTML = html;
        console.log("✅ Plan Positions geladen");
    } catch (error) {
        console.error('Plan positions error:', error);
    }
}

// ==================== PLAN CATEGORIES ====================
async function loadPlanCategories() {
    try {
        console.log("📍 Lade Plan Categories...");
        const tbody = document.querySelector('#planCategoriesTable');
        
        const categoryRef = db.collection('chairCategory').doc('Category');
        const doc = await categoryRef.get();
        
        if (!doc.exists) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Keine Kategorien vorhanden</td></tr>';
            return;
        }
        
        const categories = doc.data();
        
        // Sortiere numerisch
        const sorted = Object.entries(categories)
            .sort(([keyA], [keyB]) => {
                const numA = parseInt(keyA);
                const numB = parseInt(keyB);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                return keyA.localeCompare(keyB);
            });
        
        let html = '';
        sorted.forEach(([index, name]) => {
            html += `
                <tr>
                    <td><strong>${index}</strong></td>
                    <td>${name}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        console.log("✅ Plan Categories geladen");
    } catch (error) {
        console.error('Plan categories error:', error);
    }
}

// ==================== CONTRACTS RESERVATION ====================
async function loadContractsReservation() {
    try {
        console.log("📍 Lade Contracts mit Status Reservation...");
        const tbody = document.querySelector('#contractsReservationTable');
        
        // Lade alle Users
        const usersRef = db.collection('users');
        const usersSnapshot = await usersRef.get();
        
        let rows = [];
        
        // Für jeden User: lade seine Contracts
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            
            try {
                const contractsRef = db.collection('contracts').doc('v2').collection(userId);
                const contractsSnapshot = await contractsRef.get();
                
                contractsSnapshot.forEach(contractDoc => {
                    const contractData = contractDoc.data();
                    
                    // Filter: Status === "Reservation"
                    if (contractData.status === 'Reservation') {
                        rows.push({
                            userId,
                            contractId: contractDoc.id,
                            status: contractData.status,
                            datum: contractData.createdAt ? new Date(contractData.createdAt.toDate()).toLocaleDateString('de-DE') : '-',
                            stuhl: contractData.chairNumber || '-',
                            kategorie: contractData.chairCategory || '-',
                            preis: contractData.totalPrice ? '€' + contractData.totalPrice.toFixed(2) : '-'
                        });
                    }
                });
            } catch (error) {
                console.warn(`Fehler beim Laden von contracts/v2/${userId}:`, error);
            }
        }
        
        let html = '';
        if (rows.length === 0) {
            html = '<tr><td colspan="7" class="text-center text-muted">Keine Reservierungen gefunden</td></tr>';
        } else {
            rows.forEach(row => {
                html += `
                    <tr>
                        <td><small>${row.userId}</small></td>
                        <td><small>${row.contractId}</small></td>
                        <td><span class="badge bg-primary">${row.status}</span></td>
                        <td>${row.datum}</td>
                        <td>${row.stuhl}</td>
                        <td>${row.kategorie}</td>
                        <td>${row.preis}</td>
                    </tr>
                `;
            });
        }
        
        tbody.innerHTML = html;
        console.log("✅ Contracts Reservation geladen:", rows.length, "Einträge");
    } catch (error) {
        console.error('Contracts reservation error:', error);
    }
}

// ==================== CATEGORIES ====================
async function loadCategories() {
    try {
        console.log("📍 Lade Chair Categories...");
        const categoryRef = db.collection('chairCategory').doc('Category');
        console.log("📍 categoryRef created");
        
        const doc = await categoryRef.get();
        console.log("📍 doc.get() fertig, exists:", doc.exists);
        
        const tbody = document.querySelector('#categoriesTable');
        console.log("📍 tbody gefunden:", !!tbody);
        if (!tbody) {
            console.warn("⚠️  #categoriesTable nicht gefunden");
            return;
        }
        
        if (!doc.exists) {
            console.log("⚠️  Keine chairCategory/Category Document");
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Keine Kategorien vorhanden</td></tr>';
            return;
        }
        
        const categories = doc.data();
        console.log("📍 categories data:", categories);
        renderCategories(categories);
        
        console.log("✅ Categories geladen:", categories);
    } catch (error) {
        console.error('Categories load error:', error);
    }
}

function renderCategories(categories) {
    const tbody = document.querySelector('#categoriesTable');
    
    // Sortiere Keys numerisch (1, 2, 10, 11, 100, 111)
    const sorted = Object.entries(categories)
        .sort(([keyA], [keyB]) => {
            const numA = parseInt(keyA);
            const numB = parseInt(keyB);
            // Wenn beide Nummern, numerisch sortieren
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            // Sonst alphabetisch
            return keyA.localeCompare(keyB);
        });
    
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Keine Kategorien vorhanden</td></tr>';
        return;
    }
    
    let html = '';
    sorted.forEach(([index, name]) => {
        html += `
            <tr>
                <td><strong>${index}</strong></td>
                <td>${name}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${index}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

async function addCategory() {
    const input = document.getElementById('newCategoryInput');
    const name = input.value.trim();
    
    if (!name) {
        alert('Bitte eine Kategorie eingeben');
        return;
    }
    
    try {
        console.log("📍 Speichere neue Kategorie:", name);
        
        const categoryRef = db.collection('chairCategory').doc('Category');
        const doc = await categoryRef.get();
        
        const categories = doc.exists ? doc.data() : {};
        
        // Finde nächste numerische Position
        const numKeys = Object.keys(categories)
            .map(k => parseInt(k))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);
        
        const nextIndex = numKeys.length > 0 ? Math.max(...numKeys) + 1 : 1;
        
        categories[nextIndex.toString()] = name;
        
        await categoryRef.set(categories);
        
        input.value = '';
        await loadCategories();
        
        console.log("✅ Kategorie hinzugefügt an Position", nextIndex);
    } catch (error) {
        console.error('Add category error:', error);
        alert('Fehler beim Hinzufügen');
    }
}

async function deleteCategory(key) {
    if (!confirm(`Position "${key}" wirklich löschen?`)) return;
    
    try {
        console.log("📍 Lösche Position:", key);
        
        const categoryRef = db.collection('chairCategory').doc('Category');
        const doc = await categoryRef.get();
        
        if (!doc.exists) return;
        
        const categories = doc.data();
        
        // Lösche den Key
        delete categories[key];
        
        await categoryRef.set(categories);
        await loadCategories();
        
        console.log("✅ Position gelöscht");
    } catch (error) {
        console.error('Delete category error:', error);
        alert('Fehler beim Löschen');
    }
}

document.getElementById('addChairForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const name = document.getElementById('chairName').value;
        const type = document.getElementById('chairType').value;

        const chairOrderRef = db.collection('chairOrder').doc(SHARED_UID);
        const snapshot = await chairOrderRef.get();

        let nextPosition = 1;
        if (snapshot.exists && snapshot.data()) {
            const positions = Object.keys(snapshot.data()).map(p => parseInt(p));
            nextPosition = Math.max(...positions) + 1;
        }

        const updateData = {};
        updateData[nextPosition.toString()] = name;

        await chairOrderRef.set(updateData, { merge: true });

        e.target.reset();
        bootstrap.Modal.getInstance(document.getElementById('addChairModal')).hide();
        await loadChairs();
        await loadChairPlan();
        showToast('✅ Korb hinzugefügt!', 'success');
    } catch (error) {
        alert('❌ Fehler: ' + error.message);
        console.error(error);
    }
});

async function editChair(position) {
    const newName = prompt('Neuer Name:');
    if (newName !== null && newName !== '') {
        try {
            const updateData = {};
            updateData[position] = newName;
            await db.collection('chairOrder').doc(SHARED_UID).update(updateData);
            await loadChairs();
            await loadChairPlan();
            showToast('✅ Korb aktualisiert!', 'success');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    }
}

async function deleteChair(position) {
    if (confirm('Möchtest du diesen Korb löschen?')) {
        try {
            const deleteData = {};
            deleteData[position] = firebase.firestore.FieldValue.delete();
            await db.collection('chairOrder').doc(SHARED_UID).update(deleteData);
            await loadChairs();
            await loadChairPlan();
            showToast('✅ Korb gelöscht!', 'success');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    }
}

async function editChairFromPlan(position) {
    const newName = prompt('Neuer Name:');
    if (newName !== null && newName !== '') {
        try {
            const updateData = {};
            updateData[position] = newName;
            await db.collection('chairOrder').doc(SHARED_UID).update(updateData);
            await loadChairs();
            await loadChairPlan();
            showToast('✅ Korb aktualisiert!', 'success');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    }
}

let draggedPosition = null;
let isDropping = false;

function dragStart(event, position) {
    draggedPosition = position;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', position);
    console.log('🎯 Drag start:', position);
}

function allowDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function dragEnd(event) {
    console.log('🎯 Drag end, isDropping:', isDropping);
    if (!isDropping) {
        draggedPosition = null;
    }
}

async function dragDrop(event, targetPosition) {
    event.preventDefault();
    event.stopPropagation();

    console.log('🎯 Drag drop:', draggedPosition, '->', targetPosition);

    if (!draggedPosition || draggedPosition === targetPosition) {
        draggedPosition = null;
        isDropping = false;
        return;
    }

    isDropping = true;

    try {
        const chairOrderRef = db.collection('chairOrder').doc(SHARED_UID);
        const snapshot = await chairOrderRef.get();

        console.log('✅ Snapshot geladen');

        if (!snapshot.exists || !snapshot.data()) {
            alert('Fehler: Keine Daten gefunden');
            draggedPosition = null;
            return;
        }

        const data = snapshot.data();

        console.log('🎯 Data keys:', Object.keys(data));
        console.log('🎯 Dragged Position:', draggedPosition);
        console.log('🎯 Dragged Name:', data[draggedPosition]);

        const draggedName = data[draggedPosition];
        const targetName = data[targetPosition];

        if (!draggedName) {
            console.error('Quell-Position nicht gefunden!', draggedPosition);
            alert('Fehler: Quell-Position existiert nicht');
            return;
        }

        const updateData = {};

        if (targetName && targetName !== '' && targetName.toLowerCase() !== 'xxx') {
            updateData[draggedPosition] = targetName;
            updateData[targetPosition] = draggedName;
        } else {
            updateData[draggedPosition] = firebase.firestore.FieldValue.delete();
            updateData[targetPosition] = draggedName;
        }

        console.log('🎯 Update Data:', updateData);
        await chairOrderRef.update(updateData);

        await loadChairs();
        await loadChairPlan();
        showToast('✅ Körbe vertauscht!', 'success');
    } catch (error) {
        console.error('Drag drop error:', error);
        alert('❌ Fehler: ' + error.message);
    } finally {
        draggedPosition = null;
        isDropping = false;
    }
}

// ==================== UTILS ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

console.log('Admin Panel v' + APP_CONFIG.appVersion + ' loaded');

// Event Listeners für Categories
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('newCategoryInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addCategory();
            }
        });
    }
});
