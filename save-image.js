const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

// URL des Ärztebildes (temporär ersetzen Sie dies mit Ihrer tatsächlichen Bild-URL)
const imageUrl = 'https://raw.githubusercontent.com/ozsoymeh/doktorumnerede/main/public/uploads/images/doctors-parallax.jpg';

// Zielverzeichnis und Dateiname
const targetDir = path.join(__dirname, 'public', 'uploads', 'images');
const targetFile = path.join(targetDir, 'doctors-parallax.jpg');

// Erstellen Sie das Verzeichnis, falls es nicht existiert
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Speichern Sie das Bild vom Objekt und optimieren Sie es
https.get(imageUrl, (response) => {
    const chunks = [];
    
    response.on('data', (chunk) => {
        chunks.push(chunk);
    });
    
    response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        // Verwenden Sie sharp zur Optimierung und Größenanpassung des Bildes
        sharp(buffer)
            .resize(1920, 1080, { fit: 'cover' })
            .toFile(targetFile, (err) => {
                if (err) {
                    console.error('Fehler beim Speichern des Bildes:', err);
                } else {
                    console.log(`Bild erfolgreich als ${targetFile} gespeichert.`);
                }
            });
    });
}).on('error', (err) => {
    console.error('Fehler beim Herunterladen des Bildes:', err);
}); 