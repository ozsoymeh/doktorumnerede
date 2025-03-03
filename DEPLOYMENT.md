# Deployment-Anleitung für Doktorum Nerede

Diese Anleitung beschreibt, wie die Doktorum Nerede Anwendung auf einem Webserver bereitgestellt werden kann.

## Voraussetzungen

- Node.js (v14 oder höher)
- npm oder yarn
- MongoDB (optional, falls in Zukunft implementiert)
- Ein Webserver/Hosting-Dienst, der Node.js-Anwendungen unterstützt (z.B. Heroku, DigitalOcean, Netlify, Vercel)

## Schritt 1: Vorbereitung der Anwendung

1. Klonen Sie das Repository:
   ```
   git clone https://github.com/ozsoymeh/doktorumnerede.git
   cd doktorumnerede
   ```

2. Installieren Sie alle Abhängigkeiten:
   ```
   npm install
   ```

3. Erstellen Sie die Produktionsversion von CSS:
   ```
   npm run build:css:prod
   ```

## Schritt 2: Konfiguration für die Produktion

1. Kopieren Sie die `.env.production` zu `.env`:
   ```
   cp .env.production .env
   ```

2. Bearbeiten Sie die `.env`-Datei und setzen Sie sichere Werte:
   - Generieren Sie ein sicheres `SESSION_SECRET`
   - Setzen Sie sichere Admin-Zugangsdaten
   - Passen Sie andere Einstellungen an

## Schritt 3: Testen der Produktionsversion

1. Starten Sie die Anwendung im Produktionsmodus:
   ```
   NODE_ENV=production npm start
   ```

2. Überprüfen Sie, ob die Anwendung unter http://localhost:3001 (oder dem konfigurierten Port) läuft

## Schritt 4: Deployment auf einem Server

### Option A: Standard-Webserver (z.B. VPS, Dedicated Server)

1. Übertragen Sie alle Dateien auf den Server (außer `node_modules`)
2. Richten Sie die `.env`-Datei ein
3. Installieren Sie die Abhängigkeiten: `npm install`
4. Starten Sie die Anwendung mit einem Process Manager wie PM2:
   ```
   npm install -g pm2
   pm2 start server.js --name "doktorum-nerede"
   ```
5. Konfigurieren Sie einen Reverse-Proxy mit Nginx oder Apache

### Option B: Plattform-as-a-Service (z.B. Heroku)

1. Erstellen Sie eine neue Anwendung auf der Plattform
2. Konfigurieren Sie die Umgebungsvariablen in den Plattform-Einstellungen
3. Pushen Sie den Code zum Plattform-Repository
4. Die Plattform sollte automatisch `npm start` ausführen

## Verzeichnisse

Stellen Sie sicher, dass diese Verzeichnisse existieren und beschreibbar sind:

- `public/uploads/` - Für hochgeladene Bilder
- `data/` - Für JSON-Daten

## Sicherheitshinweise

1. Ändern Sie alle Standardpasswörter, insbesondere für Admin-Zugänge
2. Verwenden Sie HTTPS mit einem gültigen SSL-Zertifikat
3. Beschränken Sie den Dateizugriff auf dem Server
4. Aktivieren Sie regelmäßige Backups der Datendateien 