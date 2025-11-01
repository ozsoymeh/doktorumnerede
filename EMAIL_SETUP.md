# Email/SMTP Konfiguration

Die Website kann jetzt E-Mails senden, benötigt aber eine SMTP-Konfiguration.

## Umgebungsvariablen

Fügen Sie folgende Variablen zu Ihrer `.env`-Datei hinzu:

```env
# SMTP Server Einstellungen
SMTP_HOST=smtp.gmail.com          # Ihr SMTP Server (z.B. smtp.gmail.com, smtp.office365.com)
SMTP_PORT=587                     # Port (587 für TLS, 465 für SSL)
SMTP_SECURE=false                  # true für Port 465 (SSL), false für Port 587 (TLS)
SMTP_USER=ihre-email@example.com  # Ihre SMTP E-Mail-Adresse
SMTP_PASS=ihr-passwort             # Ihr SMTP Passwort oder App-Passwort
EMAIL_FROM=noreply@example.com    # Absender-E-Mail (optional, nutzt SMTP_USER als Fallback)
```

## Gmail Beispiel

Für Gmail benötigen Sie ein "App-Passwort":

1. Google Account → Sicherheit → 2-Faktor-Authentifizierung aktivieren
2. App-Passwörter generieren
3. Verwenden Sie das generierte App-Passwort (nicht Ihr normales Gmail-Passwort)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ihre-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM=noreply@ihre-domain.com
```

## Office 365 / Outlook Beispiel

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ihre-email@outlook.com
SMTP_PASS=ihr-passwort
EMAIL_FROM=noreply@ihre-domain.com
```

## Andere SMTP-Anbieter

Die meisten E-Mail-Anbieter unterstützen SMTP. Hier sind einige Beispiele:

- **SendGrid**: `smtp.sendgrid.net`, Port 587
- **Mailgun**: `smtp.mailgun.org`, Port 587
- **Amazon SES**: Je nach Region (z.B. `email-smtp.eu-central-1.amazonaws.com`)

## Aktuelle Funktionen

✅ **Password Reset E-Mails** - Automatisch aktiviert, wenn SMTP konfiguriert ist

## Testen

Nach dem Hinzufügen der SMTP-Variablen:
1. Server neu starten: `pm2 restart doktorum-nerede`
2. Password Reset testen: Gehen Sie zu `/login` → "Passwort vergessen?"
3. Überprüfen Sie die Server-Logs für Fehler: `pm2 logs doktorum-nerede`

## Status

Wenn SMTP nicht konfiguriert ist:
- Die Website funktioniert weiterhin
- Password Reset Links werden in der Console geloggt (für Entwicklung)
- Keine E-Mails werden versendet

Wenn SMTP konfiguriert ist:
- E-Mails werden automatisch bei Password Reset versendet
- Server-Log zeigt: "SMTP Email-Server erfolgreich konfiguriert"


