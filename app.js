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

    // Load chairs
    loadChairs(uid);
}

// Load Contracts
async function loadContracts(uid) {
    try {
        const contractsRef = db.collection('contracts').doc('v2').collection(uid);
        const snapshot = await contractsRef.get();
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
        document.getElementById('totalRevenueCount').textContent = totalRevenue + '€';
    } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
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
        alert('Korb hinzugefügt!');
    } catch (error) {
        alert('Fehler: ' + error.message);
    }
});

// Edit Contract
async function editContract(contractId, uid) {
    const price = prompt('Neuer Preis (€):');
    if (price !== null) {
        try {
            await db.collection('contracts').doc('v2').collection(uid).doc(contractId).update({
                price: parseFloat(price)
            });
            loadContracts(uid);
            loadStatistics(uid);
            alert('Buchung aktualisiert!');
        } catch (error) {
            alert('Fehler: ' + error.message);
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
            alert('Buchung storniert!');
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// Edit Chair
async function editChair(chairId, uid) {
    const newName = prompt('Neuer Name:');
    if (newName !== null) {
        try {
            await db.collection('chairs').doc('v2').collection(uid).doc(chairId).update({
                name: newName
            });
            loadChairs(uid);
            alert('Korb aktualisiert!');
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// Delete Chair
async function deleteChair(chairId, uid) {
    if (confirm('Möchtest du diesen Korb löschen?')) {
        try {
            await db.collection('chairs').doc('v2').collection(uid).doc(chairId).delete();
            loadChairs(uid);
            alert('Korb gelöscht!');
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }
}

// Auto-refresh every 30 seconds
setInterval(() => {
    if (auth.currentUser) {
        loadDashboard();
    }
}, 30000);
