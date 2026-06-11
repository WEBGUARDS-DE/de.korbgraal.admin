// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCGs60UfdNt2Tu3-1lHDqXWX1yA31pyHus",
    authDomain: "beach-chair-14245.firebaseapp.com",
    projectId: "beach-chair-14245",
    storageBucket: "beach-chair-14245.appspot.com",
    messagingSenderId: "1033686121750",
    appId: "1:1033686121750:web:abc123"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Chart.js setup
let revenueChart = null;
let contractsChart = null;

// UI Elements
const authContainer = document.getElementById('authContainer');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const loginError = document.getElementById('loginError');

// Authentication State
auth.onAuthStateChanged((user) => {
    if (user) {
        authContainer.style.display = 'none';
        mainContent.style.display = 'block';
        userEmail.textContent = user.email;
        loadDashboard();
    } else {
        authContainer.style.display = 'flex';
        mainContent.style.display = 'none';
    }
});

// Login Handler
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            loginError.textContent = 'Login fehlgeschlagen: ' + error.message;
            loginError.style.display = 'block';
        });
});

// Logout Handler
function signOut() {
    auth.signOut();
}

// Load Dashboard
async function loadDashboard() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const uid = currentUser.uid;

    // Load contracts
    loadContracts(uid);

    // Load statistics
    loadStatistics(uid);

    // Load charts
    loadCharts(uid);

    // Load chairs
    loadChairs(uid);

    // Load all users (for admin view)
    loadAllUsers();
}

// Load Contracts
async function loadContracts(uid) {
    try {
        const contractsRef = db.collection('contracts').doc('v2').collection(uid);
        const snapshot = await contractsRef.orderBy('startDateTime', 'desc').get();
        const tbody = document.getElementById('contractsTable');

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Keine Buchungen gefunden</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const startTime = new Date(data.startDateTime?.toDate?.() || data.startDateTime);
            const endTime = new Date(data.endDateTime?.toDate?.() || data.endDateTime);
            const status = data.isDeleted ? 'Storniert' : 'Aktiv';
            const statusBadge = data.isDeleted ? 'danger' : 'success';

            html += `
                <tr>
                    <td><small>${doc.id.substring(0, 8)}</small></td>
                    <td>${data.chairName || 'N/A'}</td>
                    <td>${startTime.toLocaleDateString('de-DE')}</td>
                    <td>${endTime.toLocaleDateString('de-DE')}</td>
                    <td>${data.price || 0}€</td>
                    <td><span class="badge bg-${statusBadge}">${status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="editContract('${doc.id}', '${uid}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteContract('${doc.id}', '${uid}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Enable export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.onclick = () => exportToCSV(snapshot, uid);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Buchungen:', error);
    }
}

// Load Statistics
async function loadStatistics(uid) {
    try {
        const contractsRef = db.collection('contracts').doc('v2').collection(uid);
        const snapshot = await contractsRef.get();

        let activeCount = 0;
        let totalRevenue = 0;
        let komfortCount = 0;
        let klassikCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.isDeleted) {
                activeCount++;
                totalRevenue += data.price || 0;

                if (data.chairName?.includes('K')) {
                    komfortCount++;
                } else {
                    klassikCount++;
                }
            }
        });

        document.getElementById('activeContractsCount').textContent = activeCount;
        document.getElementById('totalRevenueCount').textContent = totalRevenue.toFixed(2) + '€';

        // Update revenue breakdown
        const komfortRevenue = snapshot.docs
            .filter(doc => !doc.data().isDeleted && doc.data().chairName?.includes('K'))
            .reduce((sum, doc) => sum + (doc.data().price || 0), 0);

        const klassikRevenue = snapshot.docs
            .filter(doc => !doc.data().isDeleted && !doc.data().chairName?.includes('K'))
            .reduce((sum, doc) => sum + (doc.data().price || 0), 0);

        // Store for charts
        window.revenueData = {
            komfort: komfortRevenue,
            klassik: klassikRevenue,
            total: totalRevenue
        };

    } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
    }
}

// Load Charts
async function loadCharts(uid) {
    try {
        const contractsRef = db.collection('contracts').doc('v2').collection(uid);
        const snapshot = await contractsRef.get();

        const months = {};
        const priceDistribution = { 'KOMFORT': 0, 'KLASSIK': 0, 'L_KORB': 0 };

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.isDeleted) {
                const date = new Date(data.startDateTime?.toDate?.() || data.startDateTime);
                const monthKey = date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
                months[monthKey] = (months[monthKey] || 0) + (data.price || 0);

                const type = data.chairType || 'KLASSIK';
                priceDistribution[type] = (priceDistribution[type] || 0) + (data.price || 0);
            }
        });

        // Revenue Chart
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx) {
            if (revenueChart) revenueChart.destroy();
            revenueChart = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: Object.keys(months),
                    datasets: [{
                        label: 'Umsatz (€)',
                        data: Object.values(months),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: 'Umsatz über Zeit' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // Distribution Chart
        const distributionCtx = document.getElementById('distributionChart');
        if (distributionCtx) {
            if (contractsChart) contractsChart.destroy();
            contractsChart = new Chart(distributionCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(priceDistribution),
                    datasets: [{
                        data: Object.values(priceDistribution),
                        backgroundColor: ['#667eea', '#764ba2', '#f093fb']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: 'Umsatz nach Körbe-Typ' }
                    }
                }
            });
        }

    } catch (error) {
        console.error('Fehler beim Laden der Charts:', error);
    }
}

// Load Chairs
async function loadChairs(uid) {
    try {
        const chairsRef = db.collection('chairs').doc('v2').collection(uid);
        const snapshot = await chairsRef.get();
        const tbody = document.getElementById('chairsTable');

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Keine Körbe gefunden</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const type = data.type || 'KLASSIK';

            html += `
                <tr>
                    <td>${data.name || doc.id}</td>
                    <td><span class="badge bg-primary">${type}</span></td>
                    <td><span class="badge bg-success">Verfügbar</span></td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="editChair('${doc.id}', '${uid}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteChair('${doc.id}', '${uid}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Fehler beim Laden der Körbe:', error);
    }
}

// Load All Users (Admin View)
async function loadAllUsers() {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        const tbody = document.getElementById('usersTable');

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Keine Benutzer gefunden</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <tr>
                    <td>${data.email}</td>
                    <td>${data.contractCount || 0}</td>
                    <td>${(data.totalRevenue || 0).toFixed(2)}€</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewUserDetails('${doc.id}')">
                            <i class="bi bi-eye"></i> Details
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Fehler beim Laden der Benutzer:', error);
    }
}

// Add Chair
document.getElementById('addChairForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const type = formData.get('type');

    try {
        const uid = auth.currentUser.uid;
        await db.collection('chairs').doc('v2').collection(uid).add({
            name,
            type,
            createdAt: new Date()
        });

        e.target.reset();
        bootstrap.Modal.getInstance(document.getElementById('addChairModal')).hide();
        loadChairs(uid);
        showNotification('✅ Korb hinzugefügt!', 'success');
    } catch (error) {
        showNotification('❌ Fehler: ' + error.message, 'danger');
    }
});

// Add User
document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            email,
            createdAt: new Date(),
            contractCount: 0,
            totalRevenue: 0
        });

        e.target.reset();
        bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
        loadAllUsers();
        showNotification('✅ Benutzer erstellt!', 'success');
    } catch (error) {
        showNotification('❌ Fehler: ' + error.message, 'danger');
    }
});

// Edit Contract
async function editContract(contractId, uid) {
    const price = prompt('Neuer Preis (€):');
    if (price !== null && price !== '') {
        try {
            await db.collection('contracts').doc('v2').collection(uid).doc(contractId).update({
                price: parseFloat(price)
            });
            loadContracts(uid);
            loadStatistics(uid);
            loadCharts(uid);
            showNotification('✅ Buchung aktualisiert!', 'success');
        } catch (error) {
            showNotification('❌ Fehler: ' + error.message, 'danger');
        }
    }
}

// Delete Contract
async function deleteContract(contractId, uid) {
    if (confirm('Möchtest du diese Buchung stornieren?')) {
        try {
            await db.collection('contracts').doc('v2').collection(uid).doc(contractId).update({
                isDeleted: true
            });
            loadContracts(uid);
            loadStatistics(uid);
            loadCharts(uid);
            showNotification('✅ Buchung storniert!', 'success');
        } catch (error) {
            showNotification('❌ Fehler: ' + error.message, 'danger');
        }
    }
}

// Edit Chair
async function editChair(chairId, uid) {
    const newName = prompt('Neuer Name:');
    if (newName !== null && newName !== '') {
        try {
            await db.collection('chairs').doc('v2').collection(uid).doc(chairId).update({
                name: newName
            });
            loadChairs(uid);
            showNotification('✅ Korb aktualisiert!', 'success');
        } catch (error) {
            showNotification('❌ Fehler: ' + error.message, 'danger');
        }
    }
}

// Delete Chair
async function deleteChair(chairId, uid) {
    if (confirm('Möchtest du diesen Korb löschen?')) {
        try {
            await db.collection('chairs').doc('v2').collection(uid).doc(chairId).delete();
            loadChairs(uid);
            showNotification('✅ Korb gelöscht!', 'success');
        } catch (error) {
            showNotification('❌ Fehler: ' + error.message, 'danger');
        }
    }
}

// View User Details
async function viewUserDetails(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const data = userDoc.data();
        alert(`Benutzer: ${data.email}\nBuchungen: ${data.contractCount}\nUmsatz: ${data.totalRevenue}€`);
    } catch (error) {
        showNotification('❌ Fehler: ' + error.message, 'danger');
    }
}

// Export to CSV
function exportToCSV(snapshot, uid) {
    let csv = 'ID,Stuhl,Startdatum,Enddatum,Preis,Status\n';

    snapshot.forEach(doc => {
        const data = doc.data();
        const startTime = new Date(data.startDateTime?.toDate?.() || data.startDateTime);
        const endTime = new Date(data.endDateTime?.toDate?.() || data.endDateTime);
        const status = data.isDeleted ? 'Storniert' : 'Aktiv';

        csv += `${doc.id},"${data.chairName || 'N/A'}",${startTime.toLocaleDateString('de-DE')},${endTime.toLocaleDateString('de-DE')},${data.price || 0},${status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `buchungen_${new Date().toLocaleDateString('de-DE')}.csv`;
    link.click();
    showNotification('✅ CSV exportiert!', 'success');
}

// Show Notification
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;

    const container = document.querySelector('.container-main');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        setTimeout(() => alertDiv.remove(), 5000);
    }
}

// Auto-refresh every 30 seconds
setInterval(() => {
    if (auth.currentUser) {
        loadDashboard();
    }
}, 30000);

// Load Chart.js library dynamically
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
document.head.appendChild(script);
