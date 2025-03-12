require('dotenv').config();
const express = require('express');
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
// MySQL/MariaDB Session-Speicher
const MySQLStore = require('express-mysql-session')(session);
const sharp = require('sharp');
const fsPromises = require('fs').promises;

const app = express();
const port = process.env.PORT || 3001;

// Lade Übersetzungen
const translations = {
    de: require('./locales/de.json'),
    tr: require('./locales/tr.json')
};

// Verzeichnisse erstellen, falls sie nicht existieren
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const tempUploadsDir = path.join(__dirname, 'public', 'uploads', 'temp');
try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    if (!fs.existsSync(tempUploadsDir)) fs.mkdirSync(tempUploadsDir, { recursive: true });
} catch (error) {
    console.error('Fehler beim Erstellen der Verzeichnisse:', error);
}

// Multer Konfiguration für Datei-Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'excel') {
            cb(null, 'data/');
        } else if (file.fieldname === 'photo' || file.fieldname === 'galleryPhotos') {
            cb(null, 'public/uploads/temp/');
        }
    },
    filename: function (req, file, cb) {
        if (file.fieldname === 'excel') {
            cb(null, 'doctors.xlsx');
        } else if (file.fieldname === 'photo' || file.fieldname === 'galleryPhotos') {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'photo' || file.fieldname === 'galleryPhotos') {
        // Überprüfe Dateityp
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Nur JPG, JPEG und PNG Dateien sind erlaubt!'), false);
        }
        
        // Überprüfe Dateigröße
        const maxSize = 1024 * 1024; // 1MB für alle Bilder
        if (parseInt(req.headers['content-length']) > maxSize) {
            return cb(new Error('Die Dateigröße darf maximal 1MB betragen!'), false);
        }
    }
    cb(null, true);
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 // 1MB in Bytes
    }
});

// Fachbereiche
const specialties = {
    male: [
        'Facharzt für Allgemeinmedizin',
        'Allgemeinmediziner',
        'Facharzt für Anästhesiologie',
        'Facharzt für Arbeitsmedizin',
        'Facharzt für Chirurgie',
        'Facharzt für Dermatologie und Venerologie',
        'Facharzt für Endokrinologie, Diabetologie und Ernährungsmedizin',
        'Facharzt für Frauenheilkunde und Geburtshilfe',
        'Facharzt für Gastroenterologie',
        'Facharzt für Gefäßchirurgie',
        'Facharzt für Hals-Nasen-Ohren-Heilkunde',
        'Facharzt für Hämatologie und Onkologie',
        'Facharzt für Infektiologie',
        'Facharzt für Innere Medizin',
        'Facharzt für Kinder- und Jugendheilkunde',
        'Facharzt für Kardiologie',
        'Facharzt für Laboratoriumsmedizin',
        'Facharzt für Mund-Kiefer-Gesichtschirurgie',
        'Facharzt für Nephrologie',
        'Facharzt für Neurologie',
        'Facharzt für Notfallmedizin',
        'Facharzt für Nuklearmedizin',
        'Facharzt für Orthopädie und Unfallchirurgie',
        'Facharzt für Pathologie',
        'Facharzt für Plastische, Rekonstruktive und Ästhetische Chirurgie',
        'Facharzt für Pneumologie',
        'Facharzt für Psychiatrie und Psychotherapeutische Medizin',
        'Facharzt für Radiologie',
        'Facharzt für Rechtsmedizin',
        'Facharzt für Rheumatologie',
        'Facharzt für Strahlentherapie',
        'Facharzt für Urologie',
        'Facharzt für Viszeralchirurgie',
        'Facharzt für Zahnmedizin',
        'Facharzt für Zahn-, Mund-, Kieferheilkunde'
    ],
    female: [
        'Fachärztin für Allgemeinmedizin',
        'Allgemeinmedizinerin',
        'Fachärztin für Anästhesiologie',
        'Fachärztin für Arbeitsmedizin',
        'Fachärztin für Chirurgie',
        'Fachärztin für Dermatologie und Venerologie',
        'Fachärztin für Endokrinologie, Diabetologie und Ernährungsmedizin',
        'Fachärztin für Frauenheilkunde und Geburtshilfe',
        'Fachärztin für Gastroenterologie',
        'Fachärztin für Gefäßchirurgie',
        'Fachärztin für Hals-Nasen-Ohren-Heilkunde',
        'Fachärztin für Hämatologie und Onkologie',
        'Fachärztin für Infektiologie',
        'Fachärztin für Innere Medizin',
        'Fachärztin für Kinder- und Jugendheilkunde',
        'Fachärztin für Kardiologie',
        'Fachärztin für Laboratoriumsmedizin',
        'Fachärztin für Mund-Kiefer-Gesichtschirurgie',
        'Fachärztin für Nephrologie',
        'Fachärztin für Neurologie',
        'Fachärztin für Notfallmedizin',
        'Fachärztin für Nuklearmedizin',
        'Fachärztin für Orthopädie und Unfallchirurgie',
        'Fachärztin für Pathologie',
        'Fachärztin für Plastische, Rekonstruktive und Ästhetische Chirurgie',
        'Fachärztin für Pneumologie',
        'Fachärztin für Psychiatrie und Psychotherapeutische Medizin',
        'Fachärztin für Radiologie',
        'Fachärztin für Rechtsmedizin',
        'Fachärztin für Rheumatologie',
        'Fachärztin für Strahlentherapie',
        'Fachärztin für Urologie',
        'Fachärztin für Viszeralchirurgie',
        'Fachärztin für Zahnmedizin',
        'Fachärztin für Zahn-, Mund-, Kieferheilkunde'
    ]
};

// Session-Konfiguration
const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'geheim',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Nur in Produktion auf true
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
    }
};

// In Produktion MariaDB/MySQL Session-Speicher verwenden
if (process.env.NODE_ENV === 'production') {
    // Datenbank-Konfiguration
    const dbOptions = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'mehmet',
        // Optional: Für bessere Leistung
        clearExpired: true,
        checkExpirationInterval: 900000, // Alle 15 Minuten aufräumen
        createDatabaseTable: true, // Tabelle automatisch erstellen, falls nicht vorhanden
        schema: {
            tableName: 'sessions',
            columnNames: {
                session_id: 'session_id',
                expires: 'expires',
                data: 'data'
            }
        }
    };
    
    // Prüfen, ob Datenbank-Anmeldedaten vorhanden sind
    if (process.env.DB_USER && process.env.DB_PASSWORD) {
        console.log('Verwende MariaDB/MySQL für Session-Speicher');
        const sessionStore = new MySQLStore(dbOptions);
        sessionOptions.store = sessionStore;
    } else {
        console.warn('Keine Datenbank-Anmeldedaten gefunden. MemoryStore wird verwendet (nicht empfohlen für Produktion)');
    }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session(sessionOptions));

// Middleware für Übersetzungen
app.use((req, res, next) => {
    try {
        // Sprache aus Query-Parameter oder Session oder Default
        // Sicherer Zugriff mit Fallbacks
        const lang = (req.query && req.query.lang) || (req.session && req.session.lang) || 'de';
        
        // Sicherstellen, dass die Session existiert
        if (req.session) {
            req.session.lang = lang;
        }

        // Übersetzungsfunktion
        res.locals.t = (key) => {
            try {
                const keys = key.split('.');
                let value = translations[lang];
                for (const k of keys) {
                    value = value?.[k];
                }
                return value || key;
            } catch (error) {
                console.error(`Fehler bei Übersetzung für Schlüssel '${key}'`, error);
                return key; // Fallback auf den ursprünglichen Schlüssel
            }
        };

        // Aktuelle Sprache
        res.locals.lang = lang;
        next();
    } catch (error) {
        console.error('Fehler in der Übersetzungs-Middleware:', error);
        // Setze trotzdem grundlegende Übersetzungsfunktion und Sprache
        res.locals.t = key => key;
        res.locals.lang = 'de';
        next();
    }
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth Middleware
function requireAuth(req, res, next) {
    if (req.session.userId || req.session.doctorId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Hilfsfunktionen
function generatePassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

// Funktion zur Formatierung des URL-Slugs
function formatNameForUrl(firstName, lastName) {
    return `${firstName}-${lastName}`
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function processExcelFile() {
    const filePath = path.join(__dirname, 'data', 'doctors.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.getWorksheet(1);
    const data = [];
    
    // Die erste Zeile enthält die Überschriften
    const headers = {};
    worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
    });
    
    // Daten aus den weiteren Zeilen lesen
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Überschriften überspringen
        
        const rowData = {};
        row.eachCell((cell, colNumber) => {
            rowData[headers[colNumber]] = cell.value;
        });
        data.push(rowData);
    });

    const doctors = [];
    for (let row of data) {
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        doctors.push({
            academicTitle: row.Titel || '',
            firstName: row.Name || '',
            lastName: row.Nachname || '',
            specialties: [],
            address: `${row.Ordinationsadresse || ''}, ${row.PLZ || ''} ${row.Stadt || ''}`.trim(),
            phone: row.Telefonnummer?.toString() || '',
            email: row['Emailadresse der Ordination'] || '',
            showEmail: false,
            website: row.Webseite || '',
            title: null,
            password: hashedPassword,
            plainPassword: password,
            photo: '',
            kassenvertrag: row['Vertrag mit SV'] || '',
            isProfileComplete: false,
            originalSpecialty: row.Fachbereich || '',
            isApproved: false,
            registrationDate: new Date().toISOString()
        });
    }

    fs.writeFileSync(
        path.join(__dirname, 'data', 'doctors.json'),
        JSON.stringify(doctors, null, 2)
    );

    return doctors;
}

function getDoctors() {
    const doctorsPath = path.join(__dirname, 'data', 'doctors.json');
    try {
        if (!fs.existsSync(doctorsPath)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(doctorsPath, 'utf8'));
    } catch (error) {
        console.error('Fehler beim Laden der Ärztedaten:', error);
        return [];
    }
}

function saveDoctors(doctors) {
    const doctorsPath = path.join(__dirname, 'data', 'doctors.json');
    try {
        fs.writeFileSync(
            doctorsPath,
            JSON.stringify(doctors, null, 2),
            'utf8'
        );
    } catch (error) {
        console.error('Fehler beim Speichern der Ärztedaten:', error);
    }
}

// Routes
app.get('/', (req, res) => {
    const { name, specialty, city, zipCode } = req.query;
    const doctors = getDoctors().filter(doctor => !doctor.isAdmin && doctor.isApproved);
    
    // Extrahiere einzigartige PLZ und Städte
    const cities = [...new Set(doctors.map(doctor => doctor.city).filter(Boolean))].sort();
    const zipCodes = [...new Set(doctors.map(doctor => doctor.zipCode).filter(Boolean))].sort();

    let filteredDoctors = doctors;
    
    if (name) {
        const searchName = name.toLowerCase();
        filteredDoctors = filteredDoctors.filter(doctor => 
            (doctor.firstName?.toLowerCase().includes(searchName) || 
             doctor.lastName?.toLowerCase().includes(searchName))
        );
    }

    if (specialty) {
        filteredDoctors = filteredDoctors.filter(doctor => 
            doctor.specialties && doctor.specialties.includes(specialty)
        );
    }

    if (zipCode) {
        filteredDoctors = filteredDoctors.filter(doctor => 
            doctor.zipCode && doctor.zipCode.includes(zipCode)
        );
    }

    if (city) {
        filteredDoctors = filteredDoctors.filter(doctor => 
            doctor.city && doctor.city === city
        );
    }

    res.render('index', {
        title: 'Doktorum nerede - Avusturya',
        doctors: filteredDoctors,
        cities,
        zipCodes,
        formatNameForUrl,
        lang: (req.query && req.query.lang) || (req.session && req.session.lang) || 'de',
        t: res.locals.t || (key => key)
    });
});

// Neue Route für öffentliche Arztprofile
app.get('/doctor/:nameSlug', (req, res) => {
    try {
        const doctors = getDoctors();
        const doctor = doctors.find(d => formatNameForUrl(d.firstName, d.lastName) === req.params.nameSlug);
        
        if (!doctor) {
            return res.status(404).send('Arzt nicht gefunden');
        }

        // Verwende einfache, robuste Übersetzungslogik
        const lang = (req.query && req.query.lang) || (req.session && req.session.lang) || 'de';
        
        // Erstelle eine Übersetzungsfunktion ähnlich wie in der Middleware
        const t = function(key) {
            try {
                const keys = key.split('.');
                let value = translations[lang];
                if (!value) {
                    value = translations.de; // Fallback auf Deutsch
                }
                
                for (const k of keys) {
                    value = value?.[k];
                    if (value === undefined) break;
                }
                return value || key;
            } catch (error) {
                console.error(`Fehler bei Übersetzung für Schlüssel '${key}'`, error);
                return key; // Fallback auf den ursprünglichen Schlüssel
            }
        };
        
        // Übergebe sowohl den Arzt als auch den API-Schlüssel an das Template
        res.render('doctor', { 
            doctor,
            lang,
            t, // Eine Funktion, keine Objekt
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' 
        });
    } catch (error) {
        console.error('Fehler beim Laden des Arztprofils:', error);
        res.status(500).send('Ein Fehler ist aufgetreten beim Laden des Arztprofils.');
    }
});

// Login Routes
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const doctors = getDoctors();
    const doctor = doctors.find(d => d.email === email);

    if (doctor && await bcrypt.compare(password, doctor.password)) {
        req.session.userId = doctor.email;
        req.session.isAdmin = doctor.isAdmin || false;  // Speichere Admin-Status in der Session
        
        // Wenn das Profil nicht vollständig ist (keine Anrede gesetzt), zur Profilseite weiterleiten
        if (!doctor.title || !doctor.isProfileComplete) {
            req.session.message = {
                type: 'info',
                text: 'Bitte vervollständigen Sie Ihr Profil. Die Anrede ist ein Pflichtfeld.'
            };
            return res.redirect('/profile');
        }
        
        if (doctor.isAdmin) {
            res.redirect('/admin');
        } else {
            res.redirect('/profile');
        }
    } else {
        res.render('login', { error: 'Ungültige E-Mail oder Passwort' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Profil Routes
app.get('/profile', requireAuth, (req, res) => {
    const doctors = getDoctors();
    const doctor = doctors.find(d => d.email === req.session.userId || req.session.doctorId);
    
    if (!doctor) {
        req.session.destroy();
        return res.redirect('/login');
    }

    res.render('profile', { 
        doctor: doctor,
        specialties: specialties,
        message: req.session.message,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
    delete req.session.message;
});

app.get('/edit-profile', requireAuth, (req, res) => {
    const doctors = getDoctors();
    const doctor = doctors.find(d => d.email === req.session.userId);
    
    if (!doctor) {
        return res.redirect('/login');
    }
    
    const success = req.session.success === true;
    const error = req.session.error || null;
    
    // Lösche Statusmeldungen aus der Session
    delete req.session.success;
    delete req.session.error;
    
    res.render('edit-profile', { 
        doctor, 
        specialties,
        success,
        error,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
});

app.post('/profile/edit', requireAuth, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'galleryPhotos', maxCount: 2 }
]), async (req, res) => {
    try {
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.session.userId || req.session.doctorId);
        
        if (doctorIndex === -1) {
            return res.redirect('/login');
        }

        // Überprüfe, ob der Arzt bestätigt ist
        if (!doctors[doctorIndex].isApproved) {
            req.session.message = {
                type: 'error',
                text: 'Ihr Profil muss erst von einem Administrator freigegeben werden.'
            };
            return res.redirect('/profile');
        }

        const updatedDoctor = {
            ...doctors[doctorIndex],
            ...req.body,
            street: req.body.street || doctors[doctorIndex].street || '',
            zipCode: req.body.zipCode || doctors[doctorIndex].zipCode || '',
            city: req.body.city || doctors[doctorIndex].city || '',
            addressLine2: req.body.addressLine2 || doctors[doctorIndex].addressLine2 || '',
            insurance: {
                noContract: req.body.noContract === "true",
                oegk: req.body.insurance_oegk === "true" || req.body["insurance[oegk]"] === "true",
                svs: req.body.insurance_svs === "true" || req.body["insurance[svs]"] === "true",
                bvaeb: req.body.insurance_bvaeb === "true" || req.body["insurance[bvaeb]"] === "true",
                kfa: req.body.insurance_kfa === "true" || req.body["insurance[kfa]"] === "true"
            },
            insuranceType: req.body.insuranceType || 'hasContract',
            showEmail: req.body.showEmail === 'true'
        };

        // Profilfoto verarbeiten
        if (req.files.photo && req.files.photo[0]) {
            const photo = req.files.photo[0];
            const photoFileName = `profile-${Date.now()}.jpg`;
            
            // Altes Foto löschen falls vorhanden
            if (doctors[doctorIndex].photo) {
                const oldPhotoPath = path.join(__dirname, 'public', 'uploads', doctors[doctorIndex].photo);
                try {
                    await fsPromises.unlink(oldPhotoPath);
                } catch (error) {
                    console.error('Fehler beim Löschen des alten Fotos:', error);
                }
            }

            await sharp(photo.path)
                .resize(400, 400, { fit: 'cover' })
                .jpeg({ quality: 90 })
                .toFile(path.join(__dirname, 'public', 'uploads', photoFileName));
            
            // Temporäre Datei löschen
            await fsPromises.unlink(photo.path);
            
            updatedDoctor.photo = photoFileName;
        }

        // Galeriefotos verarbeiten
        if (req.files.galleryPhotos) {
            const newGalleryPhotos = [];
            for (const photo of req.files.galleryPhotos) {
                const photoFileName = `gallery-${Date.now()}-${newGalleryPhotos.length + 1}.jpg`;
                
                await sharp(photo.path)
                    .resize(800, 600, { fit: 'cover' })
                    .jpeg({ quality: 90 })
                    .toFile(path.join(__dirname, 'public', 'uploads', photoFileName));
                
                // Temporäre Datei löschen
                await fsPromises.unlink(photo.path);
                
                newGalleryPhotos.push(photoFileName);
            }

            // Alte Fotos löschen
            if (doctors[doctorIndex].galleryPhotos) {
                for (const oldPhoto of doctors[doctorIndex].galleryPhotos) {
                    const oldPhotoPath = path.join(__dirname, 'public', 'uploads', oldPhoto);
                    try {
                        await fsPromises.unlink(oldPhotoPath);
                    } catch (error) {
                        console.error('Fehler beim Löschen des alten Galeriefotos:', error);
                    }
                }
            }

            updatedDoctor.galleryPhotos = newGalleryPhotos;
        }

        doctors[doctorIndex] = updatedDoctor;
        saveDoctors(doctors);

        req.session.message = {
            type: 'success',
            text: 'Ihre Änderungen wurden erfolgreich gespeichert.'
        };
        req.session.success = true;

        res.redirect('/profile');
    } catch (error) {
        console.error('Fehler beim Speichern der Profiländerungen:', error);
        req.session.message = {
            type: 'error',
            text: 'Beim Speichern der Änderungen ist ein Fehler aufgetreten.'
        };
        req.session.error = 'Beim Speichern der Änderungen ist ein Fehler aufgetreten.';

        res.redirect('/profile');
    }
});

app.post('/upload-photo', requireAuth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Bitte wählen Sie ein Bild zum Hochladen aus.' });
        }

        const email = req.session.userId;
        const doctors = getDoctors();
        const index = doctors.findIndex(d => d.email === email);

        if (index === -1) {
            // Löschen der hochgeladenen Datei, wenn der Arzt nicht gefunden wird
            if (req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
        }

        // Arzt-ID verwenden oder erstellen, wenn sie nicht existiert
        if (!doctors[index].doctorId) {
            let maxId = 0;
            doctors.forEach(doctor => {
                if (doctor.doctorId) {
                    const idNumber = parseInt(doctor.doctorId.split('_')[1]);
                    if (!isNaN(idNumber) && idNumber > maxId) {
                        maxId = idNumber;
                    }
                }
            });
            doctors[index].doctorId = `id_${String(maxId + 1).padStart(4, '0')}`;
        }

        // Arztspezifischen Ordner erstellen
        const doctorDir = path.join(__dirname, 'public', 'uploads', doctors[index].doctorId);
        if (!fs.existsSync(doctorDir)) {
            fs.mkdirSync(doctorDir, { recursive: true });
        }

        // Bildverarbeitung mit Sharp
        const photoFileName = `profile_${Date.now()}.jpg`;
        const fullPhotoPath = path.join(doctorDir, photoFileName);
        
        // Altes Foto löschen falls vorhanden
        if (doctors[index].photo && doctors[index].photo !== '') {
            const oldPhotoPath = path.join(__dirname, 'public', 'uploads', doctors[index].photo);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Bild verarbeiten und speichern
        await sharp(req.file.path)
            .resize({ width: 500, height: 500, fit: 'cover' })
            .jpeg({ quality: 90 })
            .toFile(fullPhotoPath);

        // Temp-Datei löschen
        fs.unlinkSync(req.file.path);

        // Datenbank aktualisieren mit dem relativen Pfad
        doctors[index].photo = `${doctors[index].doctorId}/${photoFileName}`;
        saveDoctors(doctors);

        res.json({ success: true, photoUrl: `/uploads/${doctors[index].doctorId}/${photoFileName}` });
    } catch (error) {
        console.error('Fehler beim Hochladen des Fotos:', error);
        // Versuchen die temporäre Datei zu löschen im Fehlerfall
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: 'Fehler beim Hochladen des Fotos' });
    }
});

// Excel Upload Route
app.post('/upload', requireAdmin, upload.single('excel'), async (req, res) => {
    try {
        const doctors = await processExcelFile();
        res.json({
            success: true,
            message: `${doctors.length} Ärzte wurden erfolgreich importiert`,
            doctors: doctors
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Verarbeiten der Excel-Datei',
            error: error.message
        });
    }
});

// Registrierungs-Routes
app.get('/register', (req, res) => {
    try {
        // Deutsche Fachgebiete für die Registrierung verwenden (einfacherer, robusterer Ansatz)
        res.render('register', {
            error: null,
            specialties: translations.de.specialties
        });
    } catch (error) {
        console.error('Fehler beim Rendern der Registrierungsseite:', error);
        res.status(500).send('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
});

app.post('/register', async (req, res) => {
    try {
        const { email, password, confirmPassword, title, academicTitle, firstName, lastName, mainSpecialty } = req.body;
        
        // Validierung
        if (password !== confirmPassword) {
            return res.render('register', { 
                error: 'Die Passwörter stimmen nicht überein', 
                specialties: translations.de.specialties // Deutsche Fachgebiete
            });
        }
        
        const doctors = getDoctors();
        
        // Überprüfen, ob E-Mail bereits existiert
        if (doctors.some(doc => doc.email === email)) {
            return res.render('register', { 
                error: 'E-Mail wird bereits verwendet', 
                specialties: translations.de.specialties // Deutsche Fachgebiete
            });
        }
        
        // Adressformatierung
        const street = req.body.street || '';
        const zipCode = req.body.zipCode || '';
        const city = req.body.city || '';
        const addressLine2 = req.body.addressLine2 || '';
        const address = `${street}, ${zipCode} ${city}`.trim();
        
        // Generiere eine fortlaufende ID
        let maxId = 0;
        doctors.forEach(doctor => {
            if (doctor.doctorId) {
                const idNumber = parseInt(doctor.doctorId.split('_')[1]);
                if (!isNaN(idNumber) && idNumber > maxId) {
                    maxId = idNumber;
                }
            }
        });
        const doctorId = `id_${String(maxId + 1).padStart(4, '0')}`;
        
        // Neuen Arzt erstellen
        const newDoctor = {
            doctorId,
            email,
            password: await bcrypt.hash(password, 10),
            title,
            academicTitle,
            firstName,
            lastName,
            specialties: mainSpecialty ? [mainSpecialty] : [],
            originalSpecialty: null, // Standardwert für originalSpecialty
            address,
            addressLine2,
            street,
            zipCode,
            city,
            phone: req.body.phone || '',
            showEmail: req.body.showEmail === 'true',
            website: '',
            insurance: {
                noContract: false,
                oegk: false,
                svs: false,
                bvaeb: false,
                kfa: false
            },
            additionalInfo: '',
            galleryPhotos: [],
            photo: '',
            isProfileComplete: false,
            isAdmin: email === process.env.ADMIN_EMAIL,
            isApproved: email === process.env.ADMIN_EMAIL,
            nameSlug: formatNameForUrl(firstName, lastName),
            registrationDate: new Date().toISOString()
        };
        
        doctors.push(newDoctor);
        saveDoctors(doctors);
        
        // Anmeldung nach erfolgreicher Registrierung
        req.session.userId = email;
        req.session.isAdmin = newDoctor.isAdmin;
        req.session.message = {
            type: 'success',
            text: 'Registrierung erfolgreich! Sie können jetzt Ihr Profil vervollständigen.'
        };
        res.redirect('/profile');
    } catch (error) {
        console.error('Fehler bei der Registrierung:', error);
        // Keine Nutzung von res.locals.t hier, um Folgefehler zu vermeiden
        res.render('register', { 
            error: 'Es ist ein Fehler aufgetreten.', 
            specialties: translations.de.specialties // Deutsche Fachgebiete
        });
    }
});

// Admin Middleware
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Admin Routes
app.get('/admin', requireAdmin, (req, res) => {
    const doctors = getDoctors();
    res.render('admin', { doctors });
});

app.post('/admin/approve/:email', requireAdmin, (req, res) => {
    const doctors = getDoctors();
    const index = doctors.findIndex(d => d.email === req.params.email);
    
    if (index !== -1) {
        doctors[index].isApproved = true;
        saveDoctors(doctors);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
    }
});

app.post('/admin/disapprove/:email', requireAdmin, (req, res) => {
    const doctors = getDoctors();
    const index = doctors.findIndex(d => d.email === req.params.email);
    
    if (index !== -1) {
        doctors[index].isApproved = false;
        saveDoctors(doctors);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
    }
});

app.post('/admin/update/:email', requireAdmin, async (req, res) => {
    const doctors = getDoctors();
    const index = doctors.findIndex(d => d.email === req.params.email);
    
    if (index !== -1) {
        const updatedDoctor = {
            ...doctors[index],
            ...req.body
        };
        
        if (req.body.password) {
            updatedDoctor.password = await bcrypt.hash(req.body.password, 10);
        }
        
        doctors[index] = updatedDoctor;
        saveDoctors(doctors);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
    }
});

app.post('/admin/delete/:email', requireAdmin, (req, res) => {
    const doctors = getDoctors();
    const index = doctors.findIndex(d => d.email === req.params.email);
    
    if (index !== -1) {
        doctors.splice(index, 1);
        saveDoctors(doctors);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
    }
});

// Admin Passwort ändern
app.post('/admin/change-password', requireAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const doctors = getDoctors();
    const adminIndex = doctors.findIndex(d => d.email === req.session.userId || req.session.doctorId);
    
    if (adminIndex === -1) {
        return res.status(404).json({ success: false, message: 'Admin nicht gefunden' });
    }

    const admin = doctors[adminIndex];
    
    // Überprüfe das aktuelle Passwort
    const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isPasswordValid) {
        return res.status(400).json({ success: false, message: 'Aktuelles Passwort ist falsch' });
    }

    // Setze das neue Passwort
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    doctors[adminIndex] = admin;
    saveDoctors(doctors);

    res.json({ success: true });
});

// Neue Routen für Galeriefotos
app.post('/upload-gallery-photo', requireAuth, upload.single('galleryPhotos'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Bitte wählen Sie ein Bild zum Hochladen aus.' });
        }

        const email = req.session.userId;
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === email);

        if (doctorIndex === -1) {
            // Löschen der hochgeladenen Datei, wenn der Arzt nicht gefunden wird
            if (req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
        }

        // Arzt-ID verwenden oder erstellen, wenn sie nicht existiert
        if (!doctors[doctorIndex].doctorId) {
            let maxId = 0;
            doctors.forEach(doctor => {
                if (doctor.doctorId) {
                    const idNumber = parseInt(doctor.doctorId.split('_')[1]);
                    if (!isNaN(idNumber) && idNumber > maxId) {
                        maxId = idNumber;
                    }
                }
            });
            doctors[doctorIndex].doctorId = `id_${String(maxId + 1).padStart(4, '0')}`;
        }

        // Arztspezifischen Ordner erstellen
        const doctorDir = path.join(__dirname, 'public', 'uploads', doctors[doctorIndex].doctorId);
        if (!fs.existsSync(doctorDir)) {
            fs.mkdirSync(doctorDir, { recursive: true });
        }

        // Prüfen, ob bereits zwei Fotos vorhanden sind
        if (doctors[doctorIndex].galleryPhotos && doctors[doctorIndex].galleryPhotos.length >= 2) {
            // Löschen der hochgeladenen Datei, da das Maximum erreicht ist
            if (req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ success: false, message: 'Maximale Anzahl an Fotos erreicht (2)' });
        }

        // Bildverarbeitung mit Sharp
        const photoFileName = `gallery_${Date.now()}.jpg`;
        const fullPhotoPath = path.join(doctorDir, photoFileName);
        
        // Bild verarbeiten und speichern
        await sharp(req.file.path)
            .resize({ width: 1200, height: 900, fit: 'inside' })
            .jpeg({ quality: 85 })
            .toFile(fullPhotoPath);

        // Temp-Datei löschen
        fs.unlinkSync(req.file.path);

        // Array initialisieren, falls es noch nicht existiert
        if (!doctors[doctorIndex].galleryPhotos) {
            doctors[doctorIndex].galleryPhotos = [];
        }

        // Foto zur Galerie hinzufügen mit relativem Pfad
        doctors[doctorIndex].galleryPhotos.push(`${doctors[doctorIndex].doctorId}/${photoFileName}`);
        saveDoctors(doctors);

        res.json({ 
            success: true, 
            photoUrl: `/uploads/${doctors[doctorIndex].doctorId}/${photoFileName}`,
            photoCount: doctors[doctorIndex].galleryPhotos.length 
        });
    } catch (error) {
        console.error('Fehler beim Hochladen des Galeriefotos:', error);
        // Versuchen die temporäre Datei zu löschen im Fehlerfall
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: 'Fehler beim Hochladen des Galeriefotos' });
    }
});

app.post('/delete-gallery-photo', requireAuth, async (req, res) => {
    try {
        const { photoName } = req.body;
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.session.userId || req.session.doctorId);
        
        if (doctorIndex === -1) {
            req.session.message = {
                type: 'error',
                text: 'Arzt nicht gefunden'
            };
            return res.redirect('/profile');
        }

        // Foto aus der Galerie entfernen
        if (doctors[doctorIndex].galleryPhotos) {
            const photoIndex = doctors[doctorIndex].galleryPhotos.indexOf(photoName);
            if (photoIndex > -1) {
                doctors[doctorIndex].galleryPhotos.splice(photoIndex, 1);
                
                // Foto aus dem Dateisystem löschen
                const photoPath = path.join(__dirname, 'public', 'uploads', photoName);
                if (fs.existsSync(photoPath)) {
                    await fsPromises.unlink(photoPath);
                }
                
                saveDoctors(doctors);
                
                req.session.message = {
                    type: 'success',
                    text: 'Foto wurde erfolgreich gelöscht.'
                };
            }
        }

        res.redirect('/profile');
    } catch (error) {
        console.error('Fehler beim Löschen des Galeriefotos:', error);
        req.session.message = {
            type: 'error',
            text: 'Fehler beim Löschen des Fotos'
        };
        res.redirect('/profile');
    }
});

// Impressum Route
app.get('/impressum', (req, res) => {
    res.render('impressum', {
        title: 'Impressum - Doktorum nerede'
    });
});

// Datenschutz Route
app.get('/datenschutz', (req, res) => {
    res.render('datenschutz', {
        title: 'Datenschutz - Doktorum nerede'
    });
});

// Server starten
app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
}); 