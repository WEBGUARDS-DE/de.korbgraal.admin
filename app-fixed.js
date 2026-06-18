// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCGs60UfdNt2Tu3-1lHDqXWX1yA31pyHus",
    authDomain: "beach-chair-14245.firebaseapp.com",
    projectId: "beach-chair-14245",
    storageBucket: "beach-chair-14245.appspot.com",
    messagingSenderId: "1033686121750",
    appId: "1:1033686121750:web:abc123def456"
};

console.log('Firebase wird initialisiert...');

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialisiert ✓');
} catch (error) {
    console.error('Firebase Init Fehler:', error);
}

const auth = firebase.auth();
const db = firebase.firestore();

// UI Elements
const authContainer = document.getElementById('authContainer');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const loginError = document.getElementById('loginError');

console.log('UI Elemente geladen');

// Authentication State Handler
auth.onAuthStateChanged((user) => {
    console.log('Auth State Changed:', user ? 'Logged in' : 'Logged out');

    if (user) {
        console.log('Benutzer angemeldet:', user.email);
        authContainer.style.display = 'none';
        mainContent.style.display = 'block';
        userEmail.textContent = user.email;
        loadDashboard();
    } else {
        console.log('Benutzer abgemeldet - Login anzeigen');
        authContainer.style.display = 'flex';
        mainContent.style.display = 'none';
    }
});

// Login Handler
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    console.log('Login versuchen für:', email);

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            console.log('Login erfolgreich');
            loginError.style.display = 'none';
        })
        .catch(error => {
            console.error('Login Fehler:', error);
            loginError.textContent = '❌ Login fehlgeschlagen: ' + error.message;
            loginError.style.display = 'block';
        });
});

// Logout Handler
function signOut() {
    auth.signOut().then(() => {
        console.log('Logout erfolgreich');
    });
}

// Load Dashboard
async function loadDashboard() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const uid = currentUser.uid;
    console.log('Lade Dashboard für UID:', uid);

    try {
        loadContracts(uid);
        loadStatistics(uid);
        loadCharts(uid);
        loadChairs(uid);
        loadChairPlan(uid);
        loadPrices();
        loadSettings();
    } catch (error) {
        console.error('Dashboard Load Fehler:', error);
    }
}

// Load Contracts
async function loadContracts(uid) {
    try {
        const contractsRef = db.collection('contracts').doc('v2').collection(uid);
        const snapshot = await contractsRef.orderBy('startDateTime', 'desc').get();
        const tbody = document.getElementById('contractsTable');

        console.log('Buchungen geladen:', snapshot.size);

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

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.isDeleted) {
                activeCount++;
                totalRevenue += data.price || 0;
            }
        });

        document.getElementById('activeContractsCount').textContent = activeCount;
        document.getElementById('totalRevenueCount').textContent = totalRevenue.toFixed(2) + '€';

        console.log('Statistiken aktualisiert');
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

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.isDeleted) {
                const date = new Date(data.startDateTime?.toDate?.() || data.startDateTime);
                const monthKey = date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
                months[monthKey] = (months[monthKey] || 0) + (data.price || 0);
            }
        });

        // Revenue Chart
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx && window.Chart) {
            const ctx = revenueCtx.getContext('2d');
            new Chart(ctx, {
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
                        legend: { display: true }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        console.log('Charts geladen');
    } catch (error) {
        console.error('Fehler beim Laden der Charts:', error);
    }
}

// Load Chairs - nutzt die App-Struktur: chairOrder/{uid}
async function loadChairs(uid) {
    try {
        const chairOrderRef = db.collection('chairOrder').doc(uid);
        const snapshot = await chairOrderRef.get();
        const tbody = document.getElementById('chairsTable');

        console.log('Körbe geladen für UID:', uid, 'Exists:', snapshot.exists);

        if (!snapshot.exists) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Keine Körbe gefunden</td></tr>';
            return;
        }

        const data = snapshot.data();
        let html = '';
        let count = 0;

        // Die Daten sind wie: { "0": "Stuhl 1", "1": "Stuhl 2", ... }
        for (const [position, chairName] of Object.entries(data || {})) {
            if (typeof chairName === 'string') {
                // Bestimme Kategorie
                let category = 'Klassik';
                let categoryBadge = 'secondary';

                if (chairName.includes(' K') && !chairName.includes('FKK')) {
                    category = 'K (Komfort)';
                    categoryBadge = 'warning';
                } else if (chairName.includes(' N') || chairName.startsWith('N') || chairName.match(/\bN\b/)) {
                    category = 'N (Komfort)';
                    categoryBadge = 'warning';
                } else if (chairName.includes(' L') || chairName.startsWith('L') || chairName.match(/\bL\b/)) {
                    category = 'L (Komfort)';
                    categoryBadge = 'success';
                } else if (chairName.includes('FKK')) {
                    category = 'FKK';
                    categoryBadge = 'danger';
                } else if (chairName.includes('VM')) {
                    category = 'VM';
                    categoryBadge = 'info';
                }

                html += `
                    <tr>
                        <td><strong>${position}</strong></td>
                        <td>${chairName}</td>
                        <td><span class="badge bg-${categoryBadge}">${category}</span></td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="editChair('${position}', '${uid}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteChair('${position}', '${uid}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                count++;
            }
        }

        if (count === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Keine Körbe gefunden</td></tr>';
        } else {
            tbody.innerHTML = html;
            console.log('Körbe geladen:', count);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Körbe:', error);
        const tbody = document.getElementById('chairsTable');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Fehler beim Laden</td></tr>';
    }
}

// Load All Users - extrahiere aus contracts/v2
async function loadAllUsers() {
    try {
        const tbody = document.getElementById('usersTable');
        const users = {};

        // Lade alle Benutzer aus contracts/v2
        // Struktur: contracts/v2/{uid}/{contractId}
        const contractsV2Ref = db.collection('contracts').doc('v2');
        const snapshot = await contractsV2Ref.listCollections();

        for (const collection of snapshot) {
            const uid = collection.id;
            const contractsSnapshot = await collection.get();

            let contractCount = 0;
            let totalRevenue = 0;

            contractsSnapshot.forEach(doc => {
                const data = doc.data();
                if (!data.isDeleted) {
                    contractCount++;
                    totalRevenue += data.price || 0;
                }
            });

            if (contractCount > 0) {
                users[uid] = {
                    uid: uid,
                    contractCount: contractCount,
                    totalRevenue: totalRevenue
                };
            }
        }

        console.log('Benutzer aus Contracts extrahiert:', Object.keys(users).length);

        if (Object.keys(users).length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Keine Benutzer gefunden</td></tr>';
            return;
        }

        let html = '';
        Object.values(users).forEach(user => {
            html += `
                <tr>
                    <td><code>${user.uid.substring(0, 12)}...</code></td>
                    <td>${user.contractCount}</td>
                    <td>${user.totalRevenue.toFixed(2)}€</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="alert('User ID: ${user.uid}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.log('Fehler beim Laden der Benutzer:', error.message);
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Fehler beim Laden der Benutzer</td></tr>';
    }
}

// Add Chair - fügt einen neuen Stuhl zur nächsten Position hinzu
document.getElementById('addChairForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');

    try {
        const uid = auth.currentUser.uid;
        const chairOrderRef = db.collection('chairOrder').doc(uid);

        // Hole das aktuelle Document
        const doc = await chairOrderRef.get();
        let nextPosition = 0;

        if (doc.exists()) {
            const data = doc.data();
            // Finde die nächste freie Position
            const positions = Object.keys(data)
                .filter(key => !isNaN(parseInt(key)))
                .map(key => parseInt(key));
            nextPosition = Math.max(...positions) + 1;
        }

        // Füge den neuen Stuhl hinzu
        const updateData = {};
        updateData[nextPosition.toString()] = name;

        await chairOrderRef.set(updateData, { merge: true });

        e.target.reset();
        bootstrap.Modal.getInstance(document.getElementById('addChairModal')).hide();
        loadChairs(uid);
        alert('✅ Korb hinzugefügt!');
    } catch (error) {
        alert('❌ Fehler: ' + error.message);
        console.error(error);
    }
});

// Add User
document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newUserEmail')?.value || document.querySelector('[name="email"]').value;
    const password = document.getElementById('newUserPassword')?.value || document.querySelector('[name="password"]').value;

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
        alert('✅ Benutzer erstellt!');
    } catch (error) {
        alert('❌ Fehler: ' + error.message);
        console.error(error);
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
            alert('✅ Buchung aktualisiert!');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
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
            alert('✅ Buchung storniert!');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    }
}

// Edit Chair - aktualisiert den Namen an Position
async function editChair(position, uid) {
    const newName = prompt('Neuer Name:');
    if (newName !== null && newName !== '') {
        try {
            const updateData = {};
            updateData[position] = newName;
            await db.collection('chairOrder').doc(uid).update(updateData);
            loadChairs(uid);
            alert('✅ Korb aktualisiert!');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    }
}

// Delete Chair - löscht den Eintrag an Position
async function deleteChair(position, uid) {
    if (confirm('Möchtest du diesen Korb löschen?')) {
        try {
            const deleteData = {};
            deleteData[position] = firebase.firestore.FieldValue.delete();
            await db.collection('chairOrder').doc(uid).update(deleteData);
            loadChairs(uid);
            alert('✅ Korb gelöscht!');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
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
    alert('✅ CSV exportiert!');
}

// Load Chair Plan - 2-spaltig Grid mit speziellen Cases
async function loadChairPlan(uid) {
    try {
        const chairOrderRef = db.collection('chairOrder').doc(uid);
        const snapshot = await chairOrderRef.get();
        const gridContainer = document.getElementById('chairGrid');

        console.log('Lade Chair Plan für UID:', uid);

        if (!snapshot.exists) {
            gridContainer.innerHTML = '<div class="alert alert-info col-12">Keine Körbe gefunden</div>';
            return;
        }

        const data = snapshot.data();
        let html = '';

        // Sortiere nach Position (auch negative: -1, 0, 1, 2, ...)
        const positions = Object.keys(data || {})
            .filter(key => !isNaN(parseInt(key)) && key !== '')
            .sort((a, b) => parseInt(a) - parseInt(b));

        // Erste: Finde alle Positionen die Wege sind
        const isWegPosition = {};
        positions.forEach(pos => {
            const name = data[pos];
            // Position < 0 ist immer ein Weg
            if (parseInt(pos) < 0) {
                isWegPosition[pos] = true;
            }
            // Name enthält "Zugang" oder "Weg" = Weg
            else if (name && (name.includes('Zugang') || name.includes('Weg'))) {
                isWegPosition[pos] = true;
                // Wenn diese Position ein Weg ist, markiere auch die VORHERIGE Position (pos - 1) als Weg
                const prevPos = (parseInt(pos) - 1).toString();
                if (parseInt(prevPos) >= 0) {
                    isWegPosition[prevPos] = true;
                }
            }
        });

        positions.forEach(position => {
            const chairName = data[position];
            const isWeg = isWegPosition[position];

            // Leere Positionen oder "xxx" als "Freifläche" (aber nicht wenn sie neben einem Weg sind)
            if (!chairName || chairName === '' || chairName.toLowerCase() === 'xxx') {
                if (isWeg) {
                    // Wenn neben einem Weg, als Zugang anzeigen
                    html += `
                        <div class="chair-card weg" onclick="editChairFromPlan('${position}', '${uid}')">
                            <div class="chair-position">Position ${position}</div>
                            <div class="chair-name">ZUGANG</div>
                            <div class="chair-type">ZUGANG</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="chair-card freifläche" onclick="editChairFromPlan('${position}', '${uid}')">
                            <div class="chair-position">Position ${position}</div>
                            <div class="chair-name">FREIFLÄCHE</div>
                            <div class="chair-type">LEER</div>
                        </div>
                    `;
                }
                return;
            }

            if (typeof chairName === 'string') {
                // Bestimme die Farbe und den Typ basierend auf dem Namen
                let typeClass = 'klassik'; // Default
                let displayName = chairName;
                let displayType = 'Klassik';

                // Spezialfälle - Überprüfe auf "N" zuerst (gelb)
                if (chairName.includes(' N') || chairName.startsWith('N') || chairName.match(/\bN\b/)) {
                    typeClass = 'n-marker';
                    displayType = 'N';
                } else if (chairName.includes(' L') || chairName.startsWith('L') || chairName.match(/\bL\b/)) {
                    typeClass = 'l-marker';
                    displayType = 'L';
                } else if (isWeg) {
                    typeClass = 'weg';
                    displayType = 'ZUGANG';
                    displayName = chairName;
                } else if (chairName === 'VM') {
                    typeClass = 'vermietung';
                    displayType = 'VERMIETUNGSWAGEN';
                    displayName = 'VM';
                } else if (chairName.includes('VM')) {
                    typeClass = 'vermietung';
                    displayType = 'VERMIETUNGSWAGEN';
                } else if (chairName.includes('FKK')) {
                    typeClass = 'fkk';
                    displayType = 'FKK';
                } else if (chairName.includes('K') && !chairName.includes('FKK')) {
                    typeClass = 'komfort';
                    displayType = 'KOMFORT';
                } else if (chairName.includes('2026')) {
                    typeClass = 'neu';
                    displayType = 'NEU 2026';
                }

                html += `
                    <div class="chair-card ${typeClass}" onclick="editChairFromPlan('${position}', '${uid}')" draggable="true" ondragstart="dragStart(event, '${position}', '${uid}')" ondrop="dragDrop(event, '${position}', '${uid}')" ondragover="allowDrop(event)">
                        <div class="chair-position">Position ${position}</div>
                        <div class="chair-name">${displayName}</div>
                        <div class="chair-type">${displayType}</div>
                    </div>
                `;
            }
        });

        gridContainer.innerHTML = html || '<div class="alert alert-info col-12">Keine Körbe in Plan</div>';
        console.log('Chair Plan geladen:', positions.length, 'Positionen');
    } catch (error) {
        console.error('Fehler beim Laden des Chair Plans:', error);
        const gridContainer = document.getElementById('chairGrid');
        gridContainer.innerHTML = '<div class="alert alert-danger col-12">Fehler beim Laden des Plans</div>';
    }
}

// Drag & Drop Funktionen
let draggedPosition = null;
let draggedUid = null;

function dragStart(event, position, uid) {
    draggedPosition = position;
    draggedUid = uid;
    event.dataTransfer.effectAllowed = 'move';
}

function allowDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

async function dragDrop(event, targetPosition, uid) {
    event.preventDefault();

    if (!draggedPosition || draggedPosition === targetPosition) return;

    try {
        const chairOrderRef = db.collection('chairOrder').doc(uid);
        const snapshot = await chairOrderRef.get();
        const data = snapshot.data();

        // Tausche die Positionen
        const temp = data[draggedPosition];
        const updateData = {};
        updateData[draggedPosition] = data[targetPosition];
        updateData[targetPosition] = temp;

        await chairOrderRef.update(updateData);
        loadChairPlan(uid);
        alert('✅ Positionen getauscht!');
    } catch (error) {
        alert('❌ Fehler beim Tauschen: ' + error.message);
    }

    draggedPosition = null;
}

// Edit Chair von Plan aus
async function editChairFromPlan(position, uid) {
    const chairOrderRef = db.collection('chairOrder').doc(uid);
    const snapshot = await chairOrderRef.get();
    const data = snapshot.data();
    const currentName = data[position];

    const newName = prompt(`Neuer Name für Position ${position}:`, currentName);
    if (newName !== null && newName !== '') {
        try {
            const updateData = {};
            updateData[position] = newName;
            await chairOrderRef.update(updateData);
            loadChairPlan(uid);
            alert('✅ Korb aktualisiert!');
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    }
}

// ============================================================
// PRICE MANAGEMENT FUNCTIONS
// ============================================================

// Load Prices
async function loadPrices() {
    try {
        const pricingTab = document.getElementById('pricingTab');
        if (!pricingTab) {
            console.warn('pricingTab Element nicht gefunden!');
            return;
        }

        console.log('Lade v2026 Preise...');

        // Lade KLASSIK und KOMFORT Preise von prices/v2026/
        let klassikDoc, komfortDoc;
        try {
            klassikDoc = await db.collection('prices').collection('v2026').doc('KLASSIK').get();
            console.log('v2026 KLASSIK Doc exists:', klassikDoc.exists, klassikDoc.data());
        } catch (e) {
            console.error('Fehler beim Laden von v2026 KLASSIK:', e);
        }

        try {
            komfortDoc = await db.collection('prices').collection('v2026').doc('KOMFORT').get();
            console.log('v2026 KOMFORT Doc exists:', komfortDoc.exists, komfortDoc.data());
        } catch (e) {
            console.error('Fehler beim Laden von v2026 KOMFORT:', e);
        }

        if (klassikDoc && klassikDoc.exists && komfortDoc && komfortDoc.exists) {
            // WICHTIG: Container ZUERST leeren!
            pricingTab.innerHTML = '';
            console.log('Container geleert, zeige v2026 Preise...');

            displayV2026PriceTable('KLASSIK', klassikDoc.data());
            displayV2026PriceTable('KOMFORT', komfortDoc.data());
            console.log('✅ v2026 Preise angezeigt');
        } else {
            console.warn('v2026 Preisdokumente nicht vollständig vorhanden');
            pricingTab.innerHTML = '<div class="alert alert-warning"><strong>⚠️ v2026 Preise nicht konfiguriert</strong><br>KLASSIK exists: ' + (klassikDoc && klassikDoc.exists) + '<br>KOMFORT exists: ' + (komfortDoc && komfortDoc.exists) + '</div>';
        }
    } catch (error) {
        console.error('❌ Fehler beim Laden der v2026 Preise:', error);
        const pricingTab = document.getElementById('pricingTab');
        if (pricingTab) {
            pricingTab.innerHTML = '<div class="alert alert-danger"><strong>❌ Fehler:</strong><br>' + error.message + '<br><br>Öffne Browser Console (F12) für Details.</div>';
        }
    }
}

// Display v2026 Price Table with all 18 products
function displayV2026PriceTable(category, priceData) {
    const container = document.getElementById('pricingTab');
    if (!container) return;

    // Lösche beim ersten Aufruf (KLASSIK) den "Laden..."-Text
    if (category === 'KLASSIK') {
        container.innerHTML = '';
    }

    const durations = priceData.durations || {};
    const productLabels = {
        '1h': '1 Stunde',
        'halfDay': 'Halber Tag',
        'days': 'Tage (siehe unten)',
        'additionalDay': 'Zusätzlicher Tag',
        'oneMonth': '1 Monat'
    };

    let html = `
        <div class="card mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">${category} Preise (v2026)</h5>
            </div>
            <div class="card-body">
    `;

    // 1 Hour Price
    if (durations['1h']) {
        html += `
            <div class="alert alert-info mb-3">
                <strong>⏱️ 1 Stunde:</strong> ${durations['1h']}€
                <button class="btn btn-sm btn-warning ms-2" onclick="editV2026Price('${category}', '1h')">
                    <i class="bi bi-pencil"></i> Bearbeiten
                </button>
            </div>
        `;
    }

    // Half Day Price
    if (durations['halfDay']) {
        const halfDayPrice = durations['halfDay'];
        const price = typeof halfDayPrice === 'object' ? halfDayPrice.price : halfDayPrice;
        html += `
            <div class="alert alert-info mb-3">
                <strong>🌤️ Halber Tag:</strong> ${price}€
                <button class="btn btn-sm btn-warning ms-2" onclick="editV2026Price('${category}', 'halfDay')">
                    <i class="bi bi-pencil"></i> Bearbeiten
                </button>
            </div>
        `;
    }

    // Day Prices Table (1-14 days)
    html += `
        <h6 class="mt-4 mb-3">📅 Tagespreise (1-14 Tage)</h6>
        <table class="table table-hover table-sm">
            <thead>
                <tr>
                    <th>Tage</th>
                    <th>Preis (€)</th>
                    <th>Aktion</th>
                </tr>
            </thead>
            <tbody>
    `;

    const daysData = durations['days'] || {};
    for (let i = 1; i <= 14; i++) {
        const price = daysData[i] || '-';
        html += `
            <tr>
                <td><strong>${i} Tag${i > 1 ? 'e' : ''}</strong></td>
                <td>${price}€</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editV2026DayPrice('${category}', ${i})">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    // Additional Day Price
    html += `
            </tbody>
        </table>
    `;

    if (durations['additionalDay']) {
        html += `
            <div class="alert alert-info mb-3 mt-3">
                <strong>➕ Zusätzlicher Tag:</strong> ${durations['additionalDay']}€
                <button class="btn btn-sm btn-warning ms-2" onclick="editV2026Price('${category}', 'additionalDay')">
                    <i class="bi bi-pencil"></i> Bearbeiten
                </button>
            </div>
        `;
    }

    // One Month Price
    if (durations['oneMonth']) {
        html += `
            <div class="alert alert-info mb-3">
                <strong>📆 1 Monat:</strong> ${durations['oneMonth']}€
                <button class="btn btn-sm btn-warning ms-2" onclick="editV2026Price('${category}', 'oneMonth')">
                    <i class="bi bi-pencil"></i> Bearbeiten
                </button>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML += html;
}

// Edit v2026 Price
async function editV2026Price(category, priceKey) {
    const docRef = db.collection('prices').collection('v2026').doc(category);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        alert('Dokument nicht gefunden!');
        return;
    }

    const data = snapshot.data();
    const durations = data.durations || {};
    let currentValue = durations[priceKey];

    let newValue;
    if (priceKey === 'halfDay' && typeof currentValue === 'object') {
        newValue = prompt(`Neuer Preis für Halben Tag (€):`, currentValue.price);
        if (newValue !== null) {
            durations[priceKey] = { price: parseInt(newValue), startTime: currentValue.startTime || '13:30' };
            await docRef.update({ durations });
            loadPrices();
        }
    } else {
        newValue = prompt(`Neuer Preis für ${priceKey} (€):`, currentValue);
        if (newValue !== null) {
            durations[priceKey] = parseInt(newValue);
            await docRef.update({ durations });
            loadPrices();
        }
    }
}

// Edit v2026 Day Price
async function editV2026DayPrice(category, day) {
    const docRef = db.collection('prices').collection('v2026').doc(category);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        alert('Dokument nicht gefunden!');
        return;
    }

    const data = snapshot.data();
    const durations = data.durations || {};
    if (!durations['days']) durations['days'] = {};

    const currentPrice = durations['days'][day] || '';
    const newPrice = prompt(`Preis für ${day} Tag(e) (€):`, currentPrice);

    if (newPrice !== null && newPrice !== '') {
        durations['days'][day] = parseInt(newPrice);
        await docRef.update({ durations });
        loadPrices();
    }
}
                };
                await savePrices(category, durations);
                loadPrices();
            }
        }
    }
}

// Save Prices
async function savePrices(category, durations) {
    try {
        const docRef = db.collection('prices').doc(category);
        await docRef.update({
            durations: durations,
            lastUpdated: new Date()
        });

        // Aktualisiere auch meta.lastUpdated
        await db.collection('prices').doc('meta').update({
            lastUpdated: new Date()
        });

        console.log(`✅ ${category} Preise gespeichert`);
        alert(`✅ ${category} Preise aktualisiert!`);
    } catch (error) {
        console.error('Fehler beim Speichern der Preise:', error);
        alert(`❌ Fehler beim Speichern: ${error.message}`);
    }
}

// Add New Price Duration
async function addNewPrice(category) {
    const duration = prompt('Neue Dauer in Stunden eingeben (z.B. 3 für 3 Stunden):');
    if (duration === null) return;

    const durationInt = parseInt(duration);
    if (isNaN(durationInt) || durationInt <= 0) {
        alert('❌ Ungültige Eingabe');
        return;
    }

    const price = prompt(`Preis für ${durationInt} Stunden (€):`);
    if (price === null) return;

    const priceInt = parseInt(price);
    if (isNaN(priceInt) || priceInt < 0) {
        alert('❌ Ungültiger Preis');
        return;
    }

    const docRef = db.collection('prices').doc(category);
    const snapshot = await docRef.get();
    const data = snapshot.data();
    const durations = data.durations || {};

    durations[durationInt] = priceInt;
    await savePrices(category, durations);
    loadPrices();
}

// ============================================================
// SETTINGS MANAGEMENT FUNCTIONS
// ============================================================

// Load Settings
async function loadSettings() {
    try {
        const settingsContainer = document.getElementById('settingsContainer');
        if (!settingsContainer) return;

        console.log('Lade Einstellungen...');

        const settingsDoc = await db.collection('settings').doc('config').get();

        if (settingsDoc.exists) {
            displaySettings(settingsDoc.data());
        } else {
            console.warn('Einstellungen nicht in Firebase gefunden');
            settingsContainer.innerHTML = `
                <div class="alert alert-warning">
                    <strong>⚠️ Einstellungen nicht konfiguriert</strong><br>
                    Bitte erstelle ein Dokument unter <code>/settings/config</code> in Firebase mit den Standardwerten.
                </div>
            `;
        }
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
        const settingsContainer = document.getElementById('settingsContainer');
        if (settingsContainer) {
            settingsContainer.innerHTML = `<div class="alert alert-danger">Fehler: ${error.message}</div>`;
        }
    }
}

// Display Settings
function displaySettings(settings) {
    const container = document.getElementById('settingsContainer');
    if (!container) return;

    // Parse available durations
    let durations = [];
    try {
        if (typeof settings.availableDurations === 'string') {
            durations = JSON.parse(settings.availableDurations);
        } else {
            durations = settings.availableDurations || [];
        }
    } catch (e) {
        console.warn('Fehler beim Parsen von availableDurations');
    }

    const durationLabels = {
        1: '1 Stunde',
        2: '2 Stunden',
        3: '3 Stunden',
        6: '6 Stunden',
        24: '1 Tag',
        48: '2 Tage',
        72: '3 Tage',
        96: '4 Tage',
        120: '5 Tage',
        144: '6 Tage',
        168: '7 Tage'
    };

    let html = `
        <div class="row">
            <div class="col-lg-6">
                <div class="card mb-4">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0">Karenzzeit (Grace Period)</h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">Toleranzzeit in Minuten</label>
                            <div class="input-group">
                                <input type="range" class="form-range" id="gracePeriodSlider"
                                       min="0" max="60" value="${settings.gracePeriodMinutes || 15}"
                                       onchange="updateSetting('gracePeriodMinutes', this.value)">
                                <span class="input-group-text ms-2" id="gracePeriodDisplay">${settings.gracePeriodMinutes || 15} Min</span>
                            </div>
                            <small class="text-muted d-block mt-2">
                                Kunden können bis zu ${settings.gracePeriodMinutes || 15} Minuten länger nutzen ohne extra zu zahlen.
                            </small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card mb-4">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0">KOMFORT-Aufschlag</h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">Multiplikator (z.B. 1.2 = 20% teurer)</label>
                            <div class="input-group">
                                <input type="number" class="form-control" id="komfortMultiplier"
                                       value="${settings.komfortPriceMultiplier || 1.2}" step="0.1" min="1.0" max="2.0"
                                       onchange="updateSetting('komfortPriceMultiplier', this.value)">
                                <span class="input-group-text">x</span>
                            </div>
                            <small class="text-muted d-block mt-2">
                                KOMFORT-Preise = KLASSIK-Preise × ${settings.komfortPriceMultiplier || 1.2}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mb-4">
            <div class="card-header bg-primary text-white">
                <h6 class="mb-0">Verfügbare Dauer-Kategorien</h6>
            </div>
            <div class="card-body">
                <div class="row">
    `;

    // Generate checkboxes for durations
    [1, 2, 3, 6, 24, 48, 72, 96, 120, 144, 168].forEach(duration => {
        const checked = durations.includes(duration) ? 'checked' : '';
        const label = durationLabels[duration] || `${duration}h`;
        html += `
                    <div class="col-md-4 mb-2">
                        <div class="form-check">
                            <input type="checkbox" class="form-check-input" id="duration_${duration}"
                                   ${checked} onchange="updateDurations()">
                            <label class="form-check-label" for="duration_${duration}">
                                ${label}
                            </label>
                        </div>
                    </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0">Zeit-Cutoff für 6h/3h</h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">Stunde, ab der Preis wechselt</label>
                            <input type="number" class="form-control" id="cutoffHour"
                                   value="${settings.cutoffHour || 16}" min="0" max="23"
                                   onchange="updateSetting('cutoffHour', this.value)">
                            <small class="text-muted d-block mt-2">
                                6h: vor ${settings.cutoffHour || 16}:00 Uhr teurer, danach günstiger
                            </small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <h6 class="mb-0">Info</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Version:</strong> ${settings.version || '1.0'}</p>
                        <p><strong>Zuletzt aktualisiert:</strong></p>
                        <small>${new Date(settings.lastUpdated).toLocaleString('de-DE')}</small>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Add event listener to gracePeriod slider for live updates
    const slider = document.getElementById('gracePeriodSlider');
    if (slider) {
        slider.addEventListener('input', function() {
            document.getElementById('gracePeriodDisplay').textContent = this.value + ' Min';
        });
    }
}

// Update single setting
async function updateSetting(key, value) {
    try {
        const settingsRef = db.collection('settings').doc('config');
        const updateData = {};
        updateData[key] = isNaN(value) ? value : parseFloat(value);
        updateData['lastUpdated'] = new Date();

        await settingsRef.update(updateData);
        console.log(`✅ ${key} aktualisiert auf ${value}`);
        alert(`✅ ${key} aktualisiert!`);
        loadSettings(); // Refresh display
    } catch (error) {
        console.error('Fehler beim Update:', error);
        alert(`❌ Fehler: ${error.message}`);
    }
}

// Update available durations
async function updateDurations() {
    try {
        const durations = [];
        [1, 2, 3, 6, 24, 48, 72, 96, 120, 144, 168].forEach(duration => {
            const checkbox = document.getElementById(`duration_${duration}`);
            if (checkbox && checkbox.checked) {
                durations.push(duration);
            }
        });

        const settingsRef = db.collection('settings').doc('config');
        await settingsRef.update({
            availableDurations: durations,
            lastUpdated: new Date()
        });

        console.log(`✅ Verfügbare Dauer-Kategorien aktualisiert: ${durations.join(', ')}`);
        alert(`✅ Dauer-Kategorien aktualisiert!\nAktiv: ${durations.join(', ')}`);
        loadSettings();
    } catch (error) {
        console.error('Fehler beim Update:', error);
        alert(`❌ Fehler: ${error.message}`);
    }
}

// Auto-refresh every 30 seconds
setInterval(() => {
    if (auth.currentUser) {
        console.log('Auto-refresh...');
        loadDashboard();
    }
}, 30000);

console.log('App initialisiert und bereit ✓');
