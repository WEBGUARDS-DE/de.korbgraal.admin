// Firebase Configuration - Warte auf Firebase Library
console.log("🔄 Firebase Config loading...");

var auth, db;

// Wait for Firebase to load from CDN
function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn("⏳ Firebase noch nicht geladen, warte 100ms...");
        setTimeout(initFirebase, 100);
        return;
    }

    console.log("✅ Firebase Library gefunden");

    const firebaseConfig = {
        apiKey: "AIzaSyCGs60UfdNt2Tu3-1lHDqXWX1yA31pyHus",
        authDomain: "beach-chair-14245.firebaseapp.com",
        projectId: "beach-chair-14245",
        storageBucket: "beach-chair-14245.appspot.com",
        messagingSenderId: "1033686121750",
        appId: "1:1033686121750:web:abc123"
    };

    try {
        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("✅ Firebase initialized");
        }

        // Get auth and db references
        auth = firebase.auth();
        db = firebase.firestore();

        // Enable session persistence (speichere Login zwischen Reloads)
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                console.log("✅ Session Persistence aktiviert (LOCAL)");
            })
            .catch(err => {
                console.warn("⚠️ Persistence Error:", err);
            });

        // Make global
        window.auth = auth;
        window.db = db;

        console.log("✅✅✅ Firebase services READY (auth & db)");

        // Trigger app initialization with small delay to ensure listeners are ready
        setTimeout(() => {
            console.log("🔥 Firing firebaseReady event");
            document.dispatchEvent(new Event('firebaseReady'));
        }, 100);

    } catch (error) {
        console.error("❌ Firebase Init Error:", error);
        setTimeout(initFirebase, 1000); // Retry
    }
}

// Start initialization immediately
initFirebase();

// ==================== APP CONFIG ====================
const DEV_UID = "dGC8miw2hybTvMHVGvQcc2lCfZH3";
const CHAIR_ORDER_UID = "6B590N5iGVTDF3mubg9rzTeyMYx2";

const APP_CONFIG = {
    appName: "Strandkorb 26",
    appVersion: "1.0",
    databaseVersion: 9,
    gracePeriodMinutes: 15,
    refreshInterval: 30000
};

// v2026 Structure: Duration-based pricing (Stunden/Tage)
const PRICES = {
    KLASSIK: {
        1: 4,
        2: 8,
        3: 9,
        "-1": 10,
        24: 14,
        48: 28,
        72: 42,
        96: 54,
        120: 65,
        144: 75,
        168: 80,
        336: 150,
        "-2": 10,
        "-3": 270
    },
    KOMFORT: {
        1: 4,
        2: 8,
        3: 10,
        "-1": 11,
        24: 15,
        48: 30,
        72: 45,
        96: 57,
        120: 68,
        144: 78,
        168: 85,
        336: 155,
        "-2": 10,
        "-3": 300
    }
};

// Price Duration Labels
const PRICE_LABELS = {
    "1": "1 Stunde",
    "2": "2 Stunden",
    "3": "3 Stunden",
    "-1": "Halber Tag (6h)",
    "24": "1 Tag",
    "48": "2 Tage",
    "72": "3 Tage",
    "96": "4 Tage",
    "120": "5 Tage",
    "144": "6 Tage",
    "168": "7 Tage",
    "336": "14 Tage",
    "-2": "Zusatztag",
    "-3": "1 Monat"
};

// Legacy (not used anymore)
const PRODUCT_TYPES = {
    ONE_HOUR: "1 Stunde",
    TWO_HOURS: "2 Stunden",
    HALF_DAY: "Halber Tag",
    ONE_DAY: "1 Tag",
    MULTI_DAYS: "Mehrere Tage",
    TIMESPAN: "Zeitraum",
    RESERVATION: "Reservierung"
};

const USER_ROLES = {
    ADMIN: "admin",
    CASHIER: "cashier",
    VIEW_ONLY: "view_only"
};

console.log("🚀 Firebase Config Script loaded");
