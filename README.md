# Strandkorb Admin - Web Frontend

Ein modernes, Web-basiertes Admin-Panel zur vollständigen Verwaltung aller Strandkorb-Daten über Firebase Firestore.

## ✨ Premium Features

### 🔐 Sicherheit & Authentifizierung
- Firebase Authentication (Email/Passwort)
- Sichere Benutzer-Verwaltung
- Role-Based Access Control (RBAC)

### 📋 Buchungs-Management
- Alle Buchungen auf einem Blick
- Bearbeitung von Preisen & Details
- Stornierung möglich
- Sortierung nach Datum
- **CSV-Export** aller Buchungen

### 💰 Preismanagement
- Separate Preise für KOMFORT & KLASSIK
- Einfache Anpassung aller Preise
- Live-Updates in der App

### 🪑 Körbe-Verwaltung
- Körbe erstellen, bearbeiten, löschen
- Typ-Kategorisierung
- Status-Übersicht

### 👥 Benutzer-Verwaltung
- Neue Benutzer erstellen
- Email & Passwort-Management
- Benutzer-Statistiken
- Benutzer-Details abrufen

### 📊 Grafiken & Statistiken
- **Umsatz-Verlauf** (Line Chart)
- **Körbe-Verteilung** (Doughnut Chart)
- Monatliche Auswertungen
- Live-Dashboard mit KPIs

### 🔄 Automatische Updates
- Auto-Refresh alle 30 Sekunden
- Echtzeit-Daten
- Toast-Benachrichtigungen

## Schnellstart

### Option 1: Lokal testen (einfach)

1. Öffne `index.html` direkt in deinem Browser
2. Login mit deiner Firebase-Email und Passwort
3. Verwalte alle Daten

### Option 2: Bereitstellen auf Firebase Hosting (empfohlen)

1. **Firebase CLI installieren:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Mit Firebase anmelden:**
   ```bash
   firebase login
   ```

3. **Projekt initialisieren:**
   ```bash
   cd "G:\Meine Ablage\workspace\Kunden\Rosenke\GitLab 2026\strandkorb-app\web-admin"
   firebase init hosting
   ```

4. **Konfiguriere Firebase Hosting:**
   - Wähle dein Projekt: `beach-chair-14245`
   - Public directory: `.` (aktuelles Verzeichnis)
   - Konfiguriere als Single-Page App: `No`

5. **Bereitstellung:**
   ```bash
   firebase deploy
   ```

6. **URL öffnen:**
   Nach erfolgreichem Deploy bekommst du eine URL wie:
   `https://beach-chair-14245.web.app`

### Option 3: Auf eigenem Server bereitstellen

1. Kopiere `index.html` und `app.js` auf deinen Server
2. Serviere sie über HTTPS (wichtig für Firebase!)
3. Öffne die URL in deinem Browser

## Benutzer hinzufügen

1. Gehe zu [Firebase Console](https://console.firebase.google.com)
2. Projekt: `beach-chair-14245` auswählen
3. **Authentication** → **Users** → **User hinzufügen**
4. Email und Passwort eingeben
5. Im Admin-Panel anmelden

## Firebase Security Rules

Füge folgende Rules in Firestore ein:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Nur authentifizierte Benutzer können ihre Daten sehen/ändern
    match /contracts/v2/{uid}/{document=**} {
      allow read, write: if request.auth.uid == uid;
    }
    match /chairs/v2/{uid}/{document=**} {
      allow read, write: if request.auth.uid == uid;
    }
  }
}
```

## Struktur der Firestore-Datenbank

```
/contracts
  /v2
    /{uid}  (Benutzer-ID)
      /{contractId}  (Buchung)
        - startDateTime: Timestamp
        - endDateTime: Timestamp
        - chairName: String
        - price: Number
        - isDeleted: Boolean

/chairs
  /v2
    /{uid}  (Benutzer-ID)
      /{chairId}  (Korb)
        - name: String
        - type: String (KOMFORT, KLASSIK, L_KORB)
        - createdAt: Timestamp
```

## Troubleshooting

### "Unknown AVD name" Fehler
Überprüfe, dass die Firebase-Config in `app.js` korrekt ist.

### Login funktioniert nicht
- Stelle sicher, dass der Benutzer in Firebase Console angelegt wurde
- Überprüfe, dass Authentication aktiviert ist
- Prüfe die Firebase-Sicherheitsregeln

### Daten werden nicht angezeigt
- Öffne die Browser-Konsole (F12) auf Fehler überprüfen
- Stelle sicher, dass Daten in Firestore vorhanden sind
- Überprüfe die Firestore-Sicherheitsregeln

## Support

Für Fragen oder Probleme kontaktiere den Entwickler.
