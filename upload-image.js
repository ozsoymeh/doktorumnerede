const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Zielverzeichnis und -dateiname
const targetDir = path.join(__dirname, 'public', 'uploads', 'images');
const targetFile = path.join(targetDir, 'doctors-parallax.jpg');

// Erstelle das Verzeichnis, falls es nicht existiert
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Verzeichnis erstellt: ${targetDir}`);
}

console.log('=============================================');
console.log('UPLOAD-TOOL FÜR PARALLAX-HINTERGRUNDBILD');
console.log('=============================================');
console.log('');
console.log('Dieses Tool kopiert ein Bild als Parallax-Hintergrund.');
console.log('');

rl.question('Bitte geben Sie den Pfad zum Bild ein: ', (imagePath) => {
  // Entferne Anführungszeichen, die beim Drag & Drop hinzugefügt werden können
  imagePath = imagePath.replace(/^['"](.*)['"]$/, '$1').trim();
  
  if (!fs.existsSync(imagePath)) {
    console.error(`Fehler: Die Datei ${imagePath} existiert nicht.`);
    rl.close();
    return;
  }
  
  try {
    // Kopiere das Bild
    fs.copyFileSync(imagePath, targetFile);
    console.log(`Erfolg! Das Bild wurde kopiert nach:`);
    console.log(targetFile);
    console.log('');
    console.log('Starten Sie jetzt den Server neu (node server.js), um die Änderungen zu sehen.');
  } catch (err) {
    console.error(`Fehler beim Kopieren der Datei: ${err.message}`);
  }
  
  rl.close();
}); 