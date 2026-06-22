# 🏖️ Strandkorb 26 Admin Panel - Vollständige Installation

## ⚡ Quick Start (60 Sekunden)

### Option 1: Python HTTP Server (Empfohlen)

```powershell
# 1. Ins Verzeichnis wechseln
cd "H:\Meine Ablage\admin-panel"

# 2. Python Server starten
python -m http.server 8000

# 3. Browser öffnen
# http://localhost:8000
# Login: ob@webguards.de / <Passwort>
```

**Browser öffnet sich auf:** `http://localhost:8000`

### Option 2: Andere Server

```bash
# Node.js (wenn installiert)
npx http-server

# Ruby
ruby -run -ehttpd . -p8000

# PHP
php -S localhost:8000
```

---

## 🔑 Login Daten

**Test Benutzer bereits erstellt:**
- Email: `ob@webguards.de`
- Password: `<dein Firebase Passwort>`

**Erste Anmeldung:**
1. Starte Python Server
2. Öffne `http://localhost:8000`
3. Melde dich mit Firebase-Credentials an
4. Dashboard lädt automatisch

---

## 📁 Dateistruktur

```
admin-panel/
├── index.html           # Hauptseite mit allen Tabs
├── app.js              # Alle JavaScript Funktionen (~2000 Zeilen)
├── style.css           # Orange Theme Styling
├── firebase-config.js  # Firebase Konfiguration
└── README-SETUP.md     # Diese Datei
```

---

## 🎨 Features im Detail

### Dashboard Tab
- **KPI Cards:** Buchungen heute, Umsatz, Benutzer, Geräte
- **Revenue Chart:** Umsatz-Verlauf (7 Tage Linienchart)
- **Types Chart:** Buchungstypen-Verteilung (Doughnut Chart)
- **Auto-Refresh:** Aktualisiert alle 30 Sekunden

### Buchungen Tab
- **Alle Buchungen anzeigen** (sortiert nach Datum, neueste zuerst)
- **Live-Bearbeitung:** Preise direkt bearbeiten
- **CSV-Export:** Alle Daten als CSV herunterladen
- **Eigenschaften:** ID, Korb, UID, Startzeit, Endzeit, Preis, Status

### Sync-Logs Tab
- **Audit Trail:** Jeder Sync wird geloggt
- **Benutzer tracking:** Wer hat wann synced
- **Status:** success/error Markierungen
- **Error Messages:** Fehlermeldungen für Debugging

### Print-Logs Tab
- **Quittungsdruck Logs:** Jeder Print wird geloggt
- **Umsatz tracking:** Subtotal pro Print
- **Kassierer tracking:** Wer hat die Quittung gedruckt
- **Timestamp:** Exakte Zeit des Drucks

### Preisblatt Tab
- **Live-Editor:** Alle Preise bearbeitbar (Klassik/Komfort)
- **Produkte:** 1h, 2h, Halber Tag, 1 Tag, Mehrere Tage
- **Instant Save:** Speichert sofort in Firebase
- **Preisblatt 25.04.2026:** Alle aktuellen Preise

```
KLASSIK                  KOMFORT
1 Stunde: 4€            1 Stunde: 4€
2 Stunden: 8€           2 Stunden: 8€
Halber Tag: 10€         Halber Tag: 11€
1 Tag: 14€              1 Tag: 15€
Mehrere Tage: 20€       Mehrere Tage: 22€
```

### Refund Config Tab
- **Grace Period:** Minuten nach Buchung für Rückerstattung
- **Default:** 15 Minuten
- **Range:** 0-60 Minuten möglich
- **Live-Update:** Speichert sofort

### Benutzer Tab
- **Alle Benutzer auflisten:** Mit UID, AppVersion, Erstellt-Datum
- **Neuer Benutzer:** Modal zum Erstellen
- **AppVersion:** "new" (Shared UID) oder "2025" (Alt)
- **Löschen:** Benutzer-Account entfernen

### Geräte Tab
- **Geräte-Übersicht:** Alle sync-aktiven Tablets/Phones
- **Seriennummer:** Eindeutige Identifikation
- **Letzter Sync:** Wann das Gerät zuletzt synced
- **Status:** Online/Offline Markierungen

### Einstellungen Tab
- **App-Name:** "Strandkorb 26"
- **App-Version:** Aktuelle Version
- **System-Info:** Firebase Projekt, DB-Version
- **Shared UID:** Angezeigt zur Referenz

---

## 🔗 Firebase Firestore Struktur

### Multi-User Datenstruktur

```
/contracts/v2/{uid}/
  - contractId: {startDateTime, endDateTime, chairName, price, isDeleted}

/chairOrder/v2/{uid}/
  - chairOrderId: {data}

/users/{uid}/
  - email: String
  - appVersion: "new" | "2025"
  - createdAt: Timestamp

/sync-logs/
  - logId: {user, cashier, timestamp, status, error}

/print-logs/
  - logId: {user, cashier, timestamp, subtotal, type}

/refund-config/config
  - gracePeriodMinutes: 15

/prices/{category}
  - ONE_HOUR: 4, TWO_HOURS: 8, ONE_DAY: 14, ...
```

### Shared UID
**Alle neuen Benutzer teilen diese UID:**
```
dGC8miw2hybTvMHVGvQcc2lCfZH3
```

**Paths für Shared UID:**
- `/contracts/v2/dGC8miw2hybTvMHVGvQcc2lCfZH3`
- `/chairOrder/v2/dGC8miw2hybTvMHVGvQcc2lCfZH3`
- `/price-check` (shared)
- `/settings/config` (shared)

---

## 🔐 Firebase Security Rules

Folgende Rules müssen in Firestore hinterlegt sein:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Contracts - Personal UID oder Shared UID
    match /contracts/v2/{uid}/{document=**} {
      allow read, write: if request.auth.uid == uid || uid == 'dGC8miw2hybTvMHVGvQcc2lCfZH3';
    }

    // ChairOrder - Personal UID oder Shared UID
    match /chairOrder/v2/{uid}/{document=**} {
      allow read, write: if request.auth.uid == uid || uid == 'dGC8miw2hybTvMHVGvQcc2lCfZH3';
    }

    // Users
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth.uid == uid;
    }

    // Audit Logs (Admin only - or shared writes)
    match /sync-logs/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    match /print-logs/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Prices (Public read, admin write)
    match /prices/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Settings
    match /settings/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Refund Config
    match /refund-config/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📊 Orange Theme Colors

```css
Primary Orange:    #FF9800
Dark Orange:       #FF6F00
Light Orange:      #FFAB40
```

**Alle Buttons, Tabs, Charts und Cards verwenden diese Farben**

---

## 🔄 Auto-Refresh Interval

```javascript
refreshInterval: 30000  // 30 Sekunden
```

- Contracts
- Sync-Logs
- Print-Logs
- Dashboard Stats

**Kann geändert werden in `firebase-config.js` → `APP_CONFIG.refreshInterval`**

---

## 🛠️ Troubleshooting

### "Firebase ist nicht definiert"
**Fehler:** `Uncaught ReferenceError: firebase is not defined`
**Lösung:** Browser-Cache löschen (Ctrl+Shift+Delete), Seite neuladen

### "PERMISSION_DENIED"
**Fehler:** `Permission denied for collection 'contracts'`
**Lösung:** Firestore Security Rules überprüfen (s.o.), Shared UID hinzufügen

### Login funktioniert nicht
**Fehler:** "Login fehlgeschlagen: User not found"
**Lösung:** Benutzer in Firebase Console erstellen oder neuen erstellen via Admin Panel

### Keine Daten sichtbar
**Fehler:** Tabellen sind leer
**Lösung:** 
- Firestore Console öffnen
- Daten in `/contracts/v2/...` vorhanden?
- Refresh klicken oder F5 drücken

### Charts werden nicht angezeigt
**Fehler:** Canvas sind leer
**Lösung:** 
- Chart.js Library Verbindung prüfen (F12 Console)
- Browser-Reload (Ctrl+Shift+R hard-reload)

---

## 📱 Browser-Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE11: Nicht unterstützt

---

## 🚀 Deployment

### Lokal (Entwicklung)
```powershell
python -m http.server 8000
# → http://localhost:8000
```

### Apache PHP Server
```powershell
# 1. Dateien in Apache htdocs kopieren
# C:\xampp\htdocs\strandkorb-admin\

# 2. XAMPP starten
# 3. http://localhost/strandkorb-admin/
```

### Firebase Hosting (Produktion)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## 📞 Support

**Kontakt:** ob@webguards.de
**Projekt:** Strandkorb 26 Admin Panel
**Firebase Projekt:** beach-chair-14245
**Version:** 1.0

---

## ✨ Version History

### v1.0 (2026-06-22)
- ✅ Komplettes Admin Panel mit 9 Tabs
- ✅ Orange Theme (#FF9800, #FF6F00)
- ✅ Firebase Firestore Integration
- ✅ Multi-User Support mit Shared UID
- ✅ Sync-Logs Audit Trail
- ✅ Print-Logs Tracking
- ✅ Real-time Charts (Chart.js)
- ✅ CSV Export
- ✅ Responsive Design
- ✅ Auto-Refresh (30s)

---

**Erstellt:** 2026-06-22
**Entwickler:** Claude Code
**Python HTTP Server bereit: `python -m http.server 8000`**
