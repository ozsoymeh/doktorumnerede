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
const { normalizeSpecialty } = require('./middleware/specialty-normalizer');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3001;

// Lade Übersetzungen
const translations = {
    de: require('./locales/de.json'),
    tr: require('./locales/tr.json')
};

// SMTP Email Configuration
let emailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    // Test SMTP connection
    emailTransporter.verify().then(() => {
        console.log('SMTP Email-Server erfolgreich konfiguriert');
    }).catch((error) => {
        console.error('SMTP Email-Server Konfigurationsfehler:', error);
        emailTransporter = null;
    });
} else {
    console.log('SMTP nicht konfiguriert - E-Mails werden nicht versendet (nur Console-Log)');
}

// Helper function to send emails
async function sendEmail(to, subject, html, text) {
    if (!emailTransporter) {
        console.log('Email würde gesendet werden (SMTP nicht konfiguriert):', { to, subject });
        return false;
    }
    
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to: to,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
        });
        console.log('Email erfolgreich gesendet an:', to);
        return true;
    } catch (error) {
        console.error('Fehler beim Senden der Email:', error);
        return false;
    }
}

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
        const maxSize = 4 * 1024 * 1024; // 4MB für alle Bilder
        if (parseInt(req.headers['content-length']) > maxSize) {
            return cb(new Error('Die Dateigröße darf maximal 4MB betragen!'), false);
        }
    }
    cb(null, true);
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 4 * 1024 * 1024 // 4MB in Bytes
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
        secure: false, // Set to false for HTTP testing
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

// Request-Debug-Logger
app.use((req, res, next) => {
    const startHrTime = process.hrtime.bigint();
    const requestId = Math.random().toString(36).slice(2, 10);
    console.log(`[REQ ${requestId}] ${req.method} ${req.originalUrl} len=${req.headers['content-length'] || 0}`);

    req.on('aborted', () => {
        console.warn(`[REQ ${requestId}] Aborted by client`);
    });

    res.on('finish', () => {
        const durMs = Number(process.hrtime.bigint() - startHrTime) / 1e6;
        console.log(`[RES ${requestId}] ${res.statusCode} in ${durMs.toFixed(1)}ms`);
    });
    next();
});

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
app.set('view cache', false); // Disable view caching to see changes immediately

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

/**
 * Automatically detects gender based on Turkish and German first names
 * Returns 'Herr', 'Frau', or null if uncertain
 */
function detectGenderFromName(firstName) {
    if (!firstName) return null;
    
    const name = firstName.toLowerCase().trim();
    
    // Turkish female names
    const turkishFemaleNames = [
        'ayşe', 'fatma', 'emine', 'hatice', 'zeynep', 'elif', 'meryem', 'zehra', 'sibel', 'özlem',
        'aygül', 'aynur', 'ayşegül', 'gül', 'gülay', 'gülsüm', 'hülya', 'melek', 'nur', 'nurcan',
        'pınar', 'pinar', 'serpil', 'sultan', 'şule', 'tuğba', 'yasemin', 'yeliz', 'zeliha', 'deniz', 'eda',
        'emel', 'esra', 'feride', 'gamze', 'hande', 'ilknur', 'jale', 'kübra', 'leyla', 'meltem',
        'necla', 'özge', 'pelin', 'selin', 'tuba', 'ümmü', 'vildan', 'yıldız', 'zuhal', 'aslı',
        'berna', 'cemre', 'dilek', 'ecem', 'figen', 'gizem', 'hacer', 'ipek', 'jülide', 'kadriye',
        'lale', 'müge', 'nihan', 'özlem', 'pembe', 'seda', 'tülay', 'ünal', 'vildan', 'yaprak',
        'canan', 'derya', 'sema', 'sabiha', 'sevgi', 'medine', 'melisa', 'neslihan'
    ];
    
    // Turkish male names
    const turkishMaleNames = [
        'mehmet', 'mustafa', 'ahmet', 'ali', 'hüseyin', 'hasan', 'ibrahim', 'ismail', 'ömer', 'osman',
        'batuhan', 'berk', 'can', 'cem', 'deniz', 'emre', 'erhan', 'furkan', 'gökhan', 'halil',
        'ibrahim', 'kadir', 'kerem', 'murat', 'onur', 'özkan', 'serkan', 'taner', 'umut', 'yasin',
        'yusuf', 'zafer', 'abdullah', 'adnan', 'burak', 'cihan', 'doğan', 'emir', 'ferhat', 'gürkan',
        'hakan', 'ilker', 'jale', 'kamil', 'levent', 'mert', 'nihat', 'orhan', 'pınar', 'ramazan',
        'selim', 'tayfun', 'ufuk', 'volkan', 'yavuz', 'zeki', 'arif', 'bülent', 'cengiz', 'dursun',
        'engin', 'fahri', 'güven', 'hüseyin', 'ismet', 'jülide', 'kürşat', 'leyla', 'mücahit', 'nuri'
    ];
    
    // German female names
    const germanFemaleNames = [
        'anna', 'maria', 'petra', 'monika', 'elke', 'sabine', 'andrea', 'barbara', 'christina', 'daniela',
        'elena', 'franziska', 'gabriele', 'heike', 'ingrid', 'julia', 'katharina', 'lisa', 'martina', 'nicole',
        'petra', 'regina', 'sandra', 'tina', 'ulrike', 'veronika', 'waltraud', 'yvonne', 'zoe', 'alexandra',
        'britta', 'caroline', 'diana', 'eva', 'friederike', 'gudrun', 'helga', 'iris', 'johanna', 'kristin',
        'lena', 'margarete', 'nina', 'olga', 'patricia', 'renate', 'sylvia', 'theresa', 'ursula', 'viktoria'
    ];
    
    // German male names
    const germanMaleNames = [
        'hans', 'peter', 'wolfgang', 'klaus', 'jürgen', 'dieter', 'horst', 'gerhard', 'helmut', 'werner',
        'alexander', 'bernd', 'christian', 'dirk', 'erik', 'florian', 'günther', 'heinz', 'ingo', 'jens',
        'karl', 'lars', 'michael', 'norbert', 'oliver', 'ralf', 'stefan', 'thomas', 'uwe', 'volker',
        'andreas', 'benedikt', 'carl', 'dennis', 'erwin', 'frank', 'georg', 'herbert', 'ingo', 'jörg',
        'kurt', 'ludwig', 'manfred', 'nicolas', 'otto', 'paul', 'rainer', 'sebastian', 'torsten', 'ulrich'
    ];
    
    // Check Turkish names first (more common in this context)
    if (turkishFemaleNames.includes(name)) return 'Frau';
    if (turkishMaleNames.includes(name)) return 'Herr';
    
    // Check German names
    if (germanFemaleNames.includes(name)) return 'Frau';
    if (germanMaleNames.includes(name)) return 'Herr';
    
    // Check for common Turkish name endings
    if (name.endsWith('e') || name.endsWith('a') || name.endsWith('i') || name.endsWith('ü') || name.endsWith('ö')) {
        // These endings are more common in female Turkish names
        return 'Frau';
    }
    
    // Check for common Turkish male name endings
    if (name.endsWith('t') || name.endsWith('n') || name.endsWith('r') || name.endsWith('k') || name.endsWith('m')) {
        // These endings are more common in male Turkish names
        return 'Herr';
    }
    
    return null; // Uncertain
}

/**
 * Get translated specialty text for a doctor
 * Normalizes originalSpecialty if needed and returns translated text
 */
function getTranslatedSpecialty(doctor, lang = 'de') {
    if (!doctor) return '';
    
    const genderKey = doctor.title === 'Frau' ? 'female' : 'male';
    const langTranslations = translations[lang] || translations.de;
    const specialtyDict = langTranslations.specialties?.[genderKey] || {};
    
    // Try mainSpecialty or first specialty from specialties array
    let specialtyKey = doctor.mainSpecialty || (doctor.specialties && doctor.specialties[0]);
    
    // If we have a specialty key, try to get translation
    if (specialtyKey && specialtyDict[specialtyKey]) {
        return specialtyDict[specialtyKey];
    }
    
    // If no specialty key but we have originalSpecialty, normalize it
    if (!specialtyKey && doctor.originalSpecialty) {
        specialtyKey = normalizeSpecialty(doctor.originalSpecialty, genderKey);
        if (specialtyKey && specialtyDict[specialtyKey]) {
            return specialtyDict[specialtyKey];
        }
        // If normalization failed, return original as fallback
        return doctor.originalSpecialty;
    }
    
    // Fallback: return empty string (will be handled by templates)
    return '';
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
    
    // Extrahiere einzigartige PLZ und Städte (normalisiert, um Duplikate zu vermeiden)
    // Normalisiere Städte: lowercase für Vergleich, dann title case für Anzeige
    const cityMap = new Map();
    doctors.forEach(doctor => {
        if (doctor.city) {
            const normalized = doctor.city.trim().toLowerCase();
            // Speichere die erste Variante mit korrekter Groß-/Kleinschreibung
            if (!cityMap.has(normalized)) {
                // Erster Buchstabe groß, Rest klein (für einfache Städtenamen wie "Wien")
                const city = doctor.city.trim();
                cityMap.set(normalized, city.charAt(0).toUpperCase() + city.slice(1).toLowerCase());
            }
        }
    });
    const cities = Array.from(cityMap.values()).sort();
    const zipCodes = [...new Set(
        doctors.map(doctor => doctor.zipCode?.trim()).filter(Boolean)
    )].sort();

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
        const normalizedCity = city.trim().toLowerCase();
        filteredDoctors = filteredDoctors.filter(doctor => 
            doctor.city && doctor.city.trim().toLowerCase() === normalizedCity
        );
    }

    const lang = (req.query && req.query.lang) || (req.session && req.session.lang) || 'de';
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const doctorsPerPage = 25;
    const totalDoctors = filteredDoctors.length;
    const totalPages = Math.ceil(totalDoctors / doctorsPerPage);
    const startIndex = (page - 1) * doctorsPerPage;
    const endIndex = startIndex + doctorsPerPage;
    const paginatedDoctors = filteredDoctors.slice(startIndex, endIndex);
    
    // Build query string for pagination while preserving filters
    const queryParams = new URLSearchParams();
    if (name) queryParams.set('name', name);
    if (specialty) queryParams.set('specialty', specialty);
    if (city) queryParams.set('city', city);
    if (zipCode) queryParams.set('zipCode', zipCode);
    if (lang && lang !== 'de') queryParams.set('lang', lang);
    
    res.render('index', {
        title: 'Doktorum nerede - Avusturya',
        doctors: paginatedDoctors,
        totalDoctors,
        currentPage: page,
        totalPages,
        doctorsPerPage,
        cities,
        zipCodes,
        formatNameForUrl,
        lang,
        queryParams: queryParams.toString(),
        specialties: translations[lang]?.specialties || translations.de.specialties,
        getTranslatedSpecialty: getTranslatedSpecialty,
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
            specialties: translations[lang]?.specialties || translations.de.specialties,
            getTranslatedSpecialty: getTranslatedSpecialty,
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' 
        });
    } catch (error) {
        console.error('Fehler beim Laden des Arztprofils:', error);
        res.status(500).send('Ein Fehler ist aufgetreten beim Laden des Arztprofils.');
    }
});


// Login Routes
app.get('/login', (req, res) => {
    const error = req.query.error || (req.session.message && req.session.message.type === 'error' ? req.session.message.text : null);
    const success = req.session.message && req.session.message.type === 'success' ? req.session.message.text : null;
    delete req.session.message;
    res.render('login', { error, success });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const doctors = getDoctors();
    const doctor = doctors.find(d => d.email.toLowerCase() === email.toLowerCase());

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

// Password recovery route
app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const doctors = getDoctors();
        const doctor = doctors.find(d => d.email.toLowerCase() === email.toLowerCase());
        
        // Always return success message for security (don't reveal if email exists)
        if (doctor) {
            // Generate a reset token (simple implementation - in production, use crypto.randomBytes)
            const crypto = require('crypto');
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = Date.now() + 3600000; // 1 hour
            
            // Store reset token (in production, use a database or Redis)
            // For now, we'll store it in the doctor object temporarily
            doctor.resetToken = resetToken;
            doctor.resetTokenExpiry = resetTokenExpiry;
            saveDoctors(doctors);
            
            const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
            
            // Send email with reset link
            const emailSubject = 'Passwort zurücksetzen - Doktorum nerede';
            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                        .footer { margin-top: 30px; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Passwort zurücksetzen</h2>
                        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
                        <p>Klicken Sie auf den folgenden Link, um ein neues Passwort festzulegen:</p>
                        <a href="${resetLink}" class="button">Passwort zurücksetzen</a>
                        <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
                        <p style="word-break: break-all; color: #666;">${resetLink}</p>
                        <p style="color: #999; font-size: 14px;">Dieser Link ist 1 Stunde gültig.</p>
                        <div class="footer">
                            <p>Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
                            <p>© ${new Date().getFullYear()} Doktorum nerede - Avusturya</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            const emailSent = await sendEmail(email, emailSubject, emailHtml);
            
            if (!emailSent) {
                // Fallback: log to console if email not configured
                console.log('Password reset link for', email, ':', resetLink);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir Ihnen einen Link zum Zurücksetzen des Passworts gesendet.' 
        });
    } catch (error) {
        console.error('Fehler bei der Passwort-Wiederherstellung:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' 
        });
    }
});

// Reset password page
app.get('/reset-password', (req, res) => {
    const { token, email } = req.query;
    if (!token || !email) {
        return res.redirect('/login?error=Invalid reset link');
    }
    
    res.render('reset-password', { token, email, error: null });
});

// Reset password submission
app.post('/reset-password', async (req, res) => {
    try {
        const { token, email, password, confirmPassword } = req.body;
        
        if (password !== confirmPassword) {
            return res.render('reset-password', { 
                token, 
                email, 
                error: 'Die Passwörter stimmen nicht überein' 
            });
        }
        
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email.toLowerCase() === email.toLowerCase());
        
        if (doctorIndex === -1) {
            return res.render('reset-password', { 
                token, 
                email, 
                error: 'Ungültiger Reset-Link' 
            });
        }
        
        const doctor = doctors[doctorIndex];
        
        // Verify token
        if (!doctor.resetToken || doctor.resetToken !== token) {
            return res.render('reset-password', { 
                token, 
                email, 
                error: 'Ungültiger oder abgelaufener Reset-Link' 
            });
        }
        
        // Check if token expired
        if (!doctor.resetTokenExpiry || doctor.resetTokenExpiry < Date.now()) {
            return res.render('reset-password', { 
                token, 
                email, 
                error: 'Der Reset-Link ist abgelaufen. Bitte fordern Sie einen neuen Link an.' 
            });
        }
        
        // Reset password
        doctor.password = await bcrypt.hash(password, 10);
        delete doctor.resetToken;
        delete doctor.resetTokenExpiry;
        doctors[doctorIndex] = doctor;
        saveDoctors(doctors);
        
        req.session.message = {
            type: 'success',
            text: 'Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.'
        };
        
        res.redirect('/login');
    } catch (error) {
        console.error('Fehler beim Zurücksetzen des Passworts:', error);
        res.render('reset-password', { 
            token: req.body.token, 
            email: req.body.email, 
            error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' 
        });
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
        specialties: translations.de.specialties,
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
        console.log('Profile edit request received:', {
            email: req.session.userId,
            isApproved: !!getDoctors().find(d => d.email === (req.session.userId || req.session.doctorId))?.isApproved,
            bodyKeys: Object.keys(req.body || {}),
            hasPhoto: !!(req.files && req.files.photo && req.files.photo.length),
            hasGallery: !!(req.files && req.files.galleryPhotos && req.files.galleryPhotos.length),
            fullBody: JSON.stringify(req.body, null, 2)
        });
        
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.session.userId || req.session.doctorId);
        
        if (doctorIndex === -1) {
            return res.redirect('/login');
        }

        // Arzt kann sein Profil auch vor Freigabe bearbeiten; Hinweis anzeigen, aber nicht blockieren
        if (!doctors[doctorIndex].isApproved) {
            req.session.message = {
                type: 'info',
                text: 'Ihr Profil ist noch nicht freigegeben. Änderungen werden gespeichert, sind aber noch nicht öffentlich.'
            };
        }

        // Vereinheitliche Insurance-Eingaben von beiden Formularvarianten
        const incomingInsuranceType = req.body.insuranceType;
        const noContractRaw = req.body.noContract;
        
        // With multer (multipart/form-data), nested objects like insurance[oegk] might not parse correctly
        // Check all possible formats - prioritize flat keys since we're using hidden inputs with flat names
        let oegkRaw = req.body.insurance_oegk;
        let svsRaw = req.body.insurance_svs;
        let bvaebRaw = req.body.insurance_bvaeb;
        let kfaRaw = req.body.insurance_kfa;
        
        // Fallback to nested object format (if form uses it)
        if (oegkRaw === undefined && req.body.insurance) {
            oegkRaw = req.body.insurance.oegk;
            svsRaw = req.body.insurance.svs;
            bvaebRaw = req.body.insurance.bvaeb;
            kfaRaw = req.body.insurance.kfa;
        }
        
        // Final fallback to bracket notation (if Express parses it as string key)
        if (oegkRaw === undefined) oegkRaw = req.body["insurance[oegk]"];
        if (svsRaw === undefined) svsRaw = req.body["insurance[svs]"];
        if (bvaebRaw === undefined) bvaebRaw = req.body["insurance[bvaeb]"];
        if (kfaRaw === undefined) kfaRaw = req.body["insurance[kfa]"];

        // Normalisiere Werte (Checkboxen senden 'on' oder definierte 'true')
        const normalizeBool = (val) => val === true || val === 'true' || val === 'on' || val === '1';

        // Bestimme InsuranceType, falls nicht explizit gesetzt
        const computedNoContract = normalizeBool(noContractRaw) || incomingInsuranceType === 'noContract';
        const hasAnyInsurance = normalizeBool(oegkRaw) || normalizeBool(svsRaw) || normalizeBool(bvaebRaw) || normalizeBool(kfaRaw);
        const computedInsuranceType = computedNoContract ? 'noContract' : (incomingInsuranceType || (hasAnyInsurance ? 'hasContract' : 'hasContract'));

        // Debug logging AFTER computing values
        console.log('Insurance form data:', {
            insuranceType: incomingInsuranceType,
            computedInsuranceType: computedInsuranceType,
            insurance_from_body: req.body.insurance,
            insurance_oegk_from_body: req.body.insurance_oegk,
            oegkRaw,
            svsRaw,
            bvaebRaw,
            kfaRaw,
            normalized_oegk: normalizeBool(oegkRaw),
            normalized_svs: normalizeBool(svsRaw),
            normalized_bvaeb: normalizeBool(bvaebRaw),
            normalized_kfa: normalizeBool(kfaRaw),
            allBodyKeys: Object.keys(req.body).filter(k => k.includes('insurance'))
        });

        // Fallback: parse combined address if single fields are missing
        if ((!req.body.street || !req.body.zipCode || !req.body.city) && req.body.address) {
            try {
                const addressRaw = String(req.body.address).trim();
                const parts = addressRaw.split(',');
                if (parts.length > 1) {
                    const streetParsed = parts[0].trim();
                    const rest = parts[1].trim().split(/\s+/);
                    const zipParsed = rest[0] || '';
                    const cityParsed = rest.slice(1).join(' ').trim();
                    req.body.street = req.body.street || streetParsed;
                    req.body.zipCode = req.body.zipCode || zipParsed;
                    req.body.city = req.body.city || cityParsed;
                } else {
                    req.body.street = req.body.street || addressRaw;
                }
            } catch (e) {
                console.warn('Adress-Fallback-Parsing fehlgeschlagen:', e);
            }
        }

        // Build insurance object FIRST
        const insuranceObject = {
            noContract: computedInsuranceType === 'noContract',
            oegk: computedInsuranceType === 'hasContract' ? normalizeBool(oegkRaw) : false,
            svs: computedInsuranceType === 'hasContract' ? normalizeBool(svsRaw) : false,
            bvaeb: computedInsuranceType === 'hasContract' ? normalizeBool(bvaebRaw) : false,
            kfa: computedInsuranceType === 'hasContract' ? normalizeBool(kfaRaw) : false
        };
        
        console.log('Computed insurance object:', insuranceObject);

        // Remove insurance-related fields from req.body to avoid conflicts
        const { insurance, insurance_oegk, insurance_svs, insurance_bvaeb, insurance_kfa, ...cleanBody } = req.body;

        const updatedDoctor = {
            ...doctors[doctorIndex],
            ...cleanBody,
            street: req.body.street || doctors[doctorIndex].street || '',
            zipCode: req.body.zipCode || doctors[doctorIndex].zipCode || '',
            city: req.body.city || doctors[doctorIndex].city || '',
            addressLine2: req.body.addressLine2 || doctors[doctorIndex].addressLine2 || '',
            insurance: insuranceObject,  // Use our computed object
            insuranceType: computedInsuranceType,
            showEmail: normalizeBool(req.body.showEmail)
        };

        // Map mainSpecialty to specialties array for public display
        if (req.body.mainSpecialty) {
            updatedDoctor.mainSpecialty = req.body.mainSpecialty;
            updatedDoctor.specialties = [req.body.mainSpecialty];
        }

        // Profilfoto verarbeiten (nur wenn vorhanden)
        if (req.files && req.files.photo && req.files.photo[0]) {
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
                .resize(1200, 1200, { fit: 'cover' })
                .jpeg({ quality: 90 })
                .toFile(path.join(__dirname, 'public', 'uploads', photoFileName));
            
            // Temporäre Datei löschen
            await fsPromises.unlink(photo.path);
            
            updatedDoctor.photo = photoFileName;
        }

        // Galeriefotos verarbeiten (nur wenn vorhanden)
        if (req.files && req.files.galleryPhotos) {
            const existingPhotos = doctors[doctorIndex].galleryPhotos || [];
            const remainingSlots = 3 - existingPhotos.length;
            
            if (remainingSlots > 0) {
                const newGalleryPhotos = [];
                const photosToProcess = req.files.galleryPhotos.slice(0, remainingSlots); // Limit to available slots
                
                for (const photo of photosToProcess) {
                    const photoFileName = `gallery-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
                    
                    await sharp(photo.path)
                        .resize(800, 600, { fit: 'cover' })
                        .jpeg({ quality: 90 })
                        .toFile(path.join(__dirname, 'public', 'uploads', photoFileName));
                    
                    // Temporäre Datei löschen
                    await fsPromises.unlink(photo.path);
                    
                    newGalleryPhotos.push(photoFileName);
                }

                // Bereinige nicht verarbeitete Dateien (falls mehr als remainingSlots hochgeladen wurden)
                if (req.files.galleryPhotos.length > remainingSlots) {
                    for (let i = remainingSlots; i < req.files.galleryPhotos.length; i++) {
                        try {
                            await fsPromises.unlink(req.files.galleryPhotos[i].path);
                        } catch (error) {
                            console.error('Fehler beim Löschen der nicht verarbeiteten Datei:', error);
                        }
                    }
                    if (!req.session.message) {
                        req.session.message = {
                            type: 'info',
                            text: `${photosToProcess.length} Foto(s) hinzugefügt. Sie haben bereits 3 Ordinationsfotos (Maximum).`
                        };
                    }
                }

                // Neue Fotos zu bestehenden hinzufügen (nicht ersetzen!)
                updatedDoctor.galleryPhotos = [...existingPhotos, ...newGalleryPhotos];
            } else {
                // Wenn bereits 3 Fotos vorhanden, alle temporären Dateien löschen
                for (const photo of req.files.galleryPhotos) {
                    try {
                        await fsPromises.unlink(photo.path);
                    } catch (error) {
                        console.error('Fehler beim Löschen der temporären Datei:', error);
                    }
                }
                req.session.message = {
                    type: 'info',
                    text: 'Sie können maximal 3 Ordinationsfotos haben. Bitte löschen Sie zuerst ein Foto, um ein neues hochzuladen.'
                };
            }
        }

        // Adresse zusammenführen, wenn Felder vorhanden
        if (updatedDoctor.street && updatedDoctor.zipCode && updatedDoctor.city) {
            updatedDoctor.address = `${updatedDoctor.street}, ${updatedDoctor.zipCode} ${updatedDoctor.city}`;
        }

        // Optional: Passwort ändern, wenn Felder gesetzt
        const currentPassword = (req.body.currentPassword || '').trim();
        const newPassword = (req.body.newPassword || '').trim();
        const confirmPassword = (req.body.confirmPassword || '').trim();

        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                req.session.message = { type: 'error', text: 'Bitte aktuelles Passwort und neues Passwort zweimal eingeben.' };
                return res.redirect('/profile');
            }
            if (newPassword !== confirmPassword) {
                req.session.message = { type: 'error', text: 'Die neuen Passwörter stimmen nicht überein.' };
                return res.redirect('/profile');
            }
            const isValid = await bcrypt.compare(currentPassword, doctors[doctorIndex].password || '');
            if (!isValid) {
                req.session.message = { type: 'error', text: 'Aktuelles Passwort ist falsch.' };
                return res.redirect('/profile');
            }
            updatedDoctor.password = await bcrypt.hash(newPassword, 10);
        }

        doctors[doctorIndex] = updatedDoctor;
        saveDoctors(doctors);

        console.log('Profile edit saved for:', doctors[doctorIndex].email, {
            street: updatedDoctor.street,
            zipCode: updatedDoctor.zipCode,
            city: updatedDoctor.city,
            insurance: updatedDoctor.insurance,
            insuranceType: updatedDoctor.insuranceType
        });
        
        // Verify the saved insurance values
        const savedDoctor = getDoctors().find(d => d.email === req.session.userId || req.session.doctorId);
        if (savedDoctor) {
            console.log('VERIFICATION - Saved insurance values:', savedDoctor.insurance);
        }

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

// Delete profile photo
app.post('/profile/photo/delete', requireAuth, (req, res) => {
    try {
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.session.userId || req.session.doctorId);
        
        if (doctorIndex === -1) {
            return res.redirect('/login');
        }

        const doctor = doctors[doctorIndex];
        if (doctor.photo) {
            const photoPath = path.join(__dirname, 'public', 'uploads', doctor.photo);
            try {
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
            } catch (error) {
                console.error('Fehler beim Löschen des Profilfotos:', error);
            }
        }
        
        doctors[doctorIndex].photo = '';
        saveDoctors(doctors);

        req.session.message = {
            type: 'success',
            text: 'Profilfoto wurde erfolgreich gelöscht.'
        };

        res.redirect('/profile');
    } catch (error) {
        console.error('Fehler beim Löschen des Profilfotos:', error);
        req.session.message = {
            type: 'error',
            text: 'Beim Löschen des Profilfotos ist ein Fehler aufgetreten.'
        };
        res.redirect('/profile');
    }
});

// Zentrale Error-Handler Middleware (Debug)
// Muss nach den Routen registriert sein
app.use((err, req, res, next) => {
    try {
        console.error('Unhandled error:', err);
        if (res.headersSent) return next(err);
        res.status(500).send('Interner Serverfehler');
    } catch (e) {
        try { res.status(500).end(); } catch (_) {}
    }
});

app.post('/upload-photo', requireAuth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
            if (acceptsHtml) {
                req.session.message = { type: 'error', text: 'Bitte wählen Sie ein Bild zum Hochladen aus.' };
                return res.redirect('/profile');
            }
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
            .resize({ width: 1200, height: 1200, fit: 'cover' })
            .jpeg({ quality: 90 })
            .toFile(fullPhotoPath);

        // Temp-Datei löschen
        fs.unlinkSync(req.file.path);

        // Datenbank aktualisieren mit dem relativen Pfad
        doctors[index].photo = `${doctors[index].doctorId}/${photoFileName}`;
        saveDoctors(doctors);

        const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
        if (acceptsHtml) {
            req.session.message = { type: 'success', text: 'Profilfoto erfolgreich hochgeladen.' };
            return res.redirect('/profile');
        }
        res.json({ success: true, photoUrl: `/uploads/${doctors[index].doctorId}/${photoFileName}` });
    } catch (error) {
        console.error('Fehler beim Hochladen des Fotos:', error);
        // Versuchen die temporäre Datei zu löschen im Fehlerfall
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
        if (acceptsHtml) {
            req.session.message = { type: 'error', text: 'Fehler beim Hochladen des Fotos' };
            return res.redirect('/profile');
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
            specialties: translations.de.specialties,
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
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
    const success = req.query.success || null;
    res.render('admin', { doctors, success });
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

// Admin route to edit any doctor's profile
app.get('/admin/edit/:email', requireAdmin, (req, res) => {
    const doctors = getDoctors();
    const doctor = doctors.find(d => d.email === req.params.email);
    
    if (!doctor) {
        return res.status(404).send('Arzt nicht gefunden');
    }
    
    res.render('admin-edit-profile', { 
        doctor, 
        specialties: translations.de.specialties,
        isAdminEdit: true,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
});

// Admin route to save doctor profile edits
app.post('/admin/edit/:email', requireAdmin, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'galleryPhotos', maxCount: 10 }
]), async (req, res) => {
    try {
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.params.email);
        
        if (doctorIndex === -1) {
            return res.status(404).send('Arzt nicht gefunden');
        }

        // Auto-detect title if not provided
        let title = req.body.title;
        if (!title && req.body.firstName) {
            const detectedTitle = detectGenderFromName(req.body.firstName);
            if (detectedTitle) {
                title = detectedTitle;
                console.log(`Auto-detected title "${title}" for ${req.body.firstName}`);
            }
        }

        // Remove password from req.body to handle it separately
        const { password, ...bodyWithoutPassword } = req.body;
        
        // Normalize boolean-like values
        const normalizeBool = (val) => val === true || val === 'true' || val === 'on' || val === '1';

        // Parse insurance values (same logic as profile edit)
        const insuranceType = req.body.insuranceType || 'hasContract';
        
        // With multer (multipart/form-data), use flat keys first
        let oegkRaw = req.body.insurance_oegk;
        let svsRaw = req.body.insurance_svs;
        let bvaebRaw = req.body.insurance_bvaeb;
        let kfaRaw = req.body.insurance_kfa;
        
        // Fallback to nested object format
        if (oegkRaw === undefined && req.body.insurance) {
            oegkRaw = req.body.insurance.oegk;
            svsRaw = req.body.insurance.svs;
            bvaebRaw = req.body.insurance.bvaeb;
            kfaRaw = req.body.insurance.kfa;
        }
        
        // Final fallback to bracket notation
        if (oegkRaw === undefined) oegkRaw = req.body["insurance[oegk]"];
        if (svsRaw === undefined) svsRaw = req.body["insurance[svs]"];
        if (bvaebRaw === undefined) bvaebRaw = req.body["insurance[bvaeb]"];
        if (kfaRaw === undefined) kfaRaw = req.body["insurance[kfa]"];

        console.log('Admin insurance form data:', {
            insuranceType,
            insurance: req.body.insurance,
            oegkRaw,
            svsRaw,
            bvaebRaw,
            kfaRaw
        });

        const updatedDoctor = {
            ...doctors[doctorIndex],
            ...bodyWithoutPassword,
            title: title || doctors[doctorIndex].title,
            street: req.body.street || doctors[doctorIndex].street || '',
            zipCode: req.body.zipCode || doctors[doctorIndex].zipCode || '',
            city: req.body.city || doctors[doctorIndex].city || '',
            addressLine2: req.body.addressLine2 || doctors[doctorIndex].addressLine2 || '',
            insurance: {
                noContract: insuranceType === 'noContract',
                oegk: insuranceType === 'hasContract' ? normalizeBool(oegkRaw) : false,
                svs: insuranceType === 'hasContract' ? normalizeBool(svsRaw) : false,
                bvaeb: insuranceType === 'hasContract' ? normalizeBool(bvaebRaw) : false,
                kfa: insuranceType === 'hasContract' ? normalizeBool(kfaRaw) : false
            },
            insuranceType: insuranceType,
            showEmail: normalizeBool(req.body.showEmail)
        };

        // Profilfoto verarbeiten
        if (req.files && req.files.photo && req.files.photo[0]) {
            const photoFile = req.files.photo[0];
            const sourcePath = photoFile.path; // temp path (public/uploads/temp/...)
            const destPath = path.join(__dirname, 'public', 'uploads', photoFile.filename);

            // Altes Foto löschen
            if (doctors[doctorIndex].photo) {
                const oldPhotoPath = path.join(__dirname, 'public', 'uploads', doctors[doctorIndex].photo);
                try { if (fs.existsSync(oldPhotoPath)) fs.unlinkSync(oldPhotoPath); } catch(_) {}
            }

            // Neues Foto verarbeiten und in endgültigen Ordner schreiben
            await sharp(sourcePath)
                .resize(400, 400, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toFile(destPath);

            // Temp-Datei entfernen
            try { if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath); } catch(_) {}

            updatedDoctor.photo = photoFile.filename;
        }

        // Galerie-Fotos verarbeiten
        if (req.files && req.files.galleryPhotos) {
            const galleryPhotos = [];
            for (const file of req.files.galleryPhotos) {
                const sourcePath = file.path; // temp path
                const destPath = path.join(__dirname, 'public', 'uploads', file.filename);

                await sharp(sourcePath)
                    .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 85 })
                    .toFile(destPath);

                try { if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath); } catch(_) {}

                galleryPhotos.push(file.filename);
            }
            updatedDoctor.galleryPhotos = [...(doctors[doctorIndex].galleryPhotos || []), ...galleryPhotos];
        }

        // Passwort aktualisieren, falls angegeben
        if (password && password.trim() !== '') {
            console.log(`Password change requested for ${req.params.email}: ${password}`);
            updatedDoctor.password = await bcrypt.hash(password, 10);
            console.log(`Password updated successfully for ${req.params.email}`);
        } else {
            console.log(`No password change for ${req.params.email} - password field empty or not provided`);
        }

        // Adresse zusammenstellen
        if (updatedDoctor.street && updatedDoctor.zipCode && updatedDoctor.city) {
            updatedDoctor.address = `${updatedDoctor.street}, ${updatedDoctor.zipCode} ${updatedDoctor.city}`;
        }

        // Profil als vollständig markieren, wenn alle Pflichtfelder ausgefüllt sind
        updatedDoctor.isProfileComplete = !!(updatedDoctor.title && updatedDoctor.firstName && updatedDoctor.lastName);

        doctors[doctorIndex] = updatedDoctor;
        saveDoctors(doctors);

        res.redirect(`/admin/edit/${encodeURIComponent(req.params.email)}`);
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Arztprofils:', error);
        res.status(500).send('Ein Fehler ist aufgetreten beim Aktualisieren des Arztprofils.');
    }
});

// Admin: delete profile photo
app.post('/admin/photo/delete/:email', requireAdmin, (req, res) => {
    try {
        const doctors = getDoctors();
        const idx = doctors.findIndex(d => d.email === req.params.email);
        if (idx === -1) return res.status(404).send('Arzt nicht gefunden');
        const current = doctors[idx];
        if (current.photo) {
            const filePath = path.join(__dirname, 'public', 'uploads', current.photo);
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(_) {}
        }
        doctors[idx].photo = '';
        saveDoctors(doctors);
        res.redirect(`/admin/edit/${encodeURIComponent(req.params.email)}`);
    } catch (e) {
        console.error('Fehler beim Löschen des Profilfotos:', e);
        res.redirect(`/admin/edit/${encodeURIComponent(req.params.email)}`);
    }
});

// Admin: delete gallery photo
app.post('/admin/gallery/delete/:email', requireAdmin, (req, res) => {
    try {
        const { photoName } = req.body || {};
        if (!photoName) return res.redirect(`/admin/edit/${encodeURIComponent(req.params.email)}`);
        const doctors = getDoctors();
        const idx = doctors.findIndex(d => d.email === req.params.email);
        if (idx === -1) return res.status(404).send('Arzt nicht gefunden');
        const current = doctors[idx];
        const uploadsPath = path.join(__dirname, 'public', 'uploads', photoName);
        try { if (fs.existsSync(uploadsPath)) fs.unlinkSync(uploadsPath); } catch(_) {}
        current.galleryPhotos = (current.galleryPhotos || []).filter(p => p !== photoName);
        doctors[idx] = current;
        saveDoctors(doctors);
        res.redirect(`/admin/edit/${encodeURIComponent(req.params.email)}`);
    } catch (e) {
        console.error('Fehler beim Löschen des Galeriefotos:', e);
        res.redirect(`/admin/edit/${encodeURIComponent(req.params.email)}`);
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
            const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
            if (acceptsHtml) {
                req.session.message = { type: 'error', text: 'Bitte wählen Sie ein Bild zum Hochladen aus.' };
                return res.redirect('/profile');
            }
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
            const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
            if (acceptsHtml) {
                req.session.message = { type: 'error', text: 'Arzt nicht gefunden' };
                return res.redirect('/profile');
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

        // Prüfen, ob bereits drei Fotos vorhanden sind
        if (doctors[doctorIndex].galleryPhotos && doctors[doctorIndex].galleryPhotos.length >= 3) {
            // Löschen der hochgeladenen Datei, da das Maximum erreicht ist
            if (req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
            if (acceptsHtml) {
                req.session.message = { type: 'error', text: 'Maximale Anzahl an Fotos erreicht (3)' };
                return res.redirect('/profile');
            }
            return res.status(400).json({ success: false, message: 'Maximale Anzahl an Fotos erreicht (3)' });
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

        const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
        if (acceptsHtml) {
            req.session.message = { type: 'success', text: 'Foto erfolgreich zur Galerie hinzugefügt.' };
            return res.redirect('/profile');
        }
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
        const acceptsHtml = (req.headers['accept'] || '').includes('text/html');
        if (acceptsHtml) {
            req.session.message = { type: 'error', text: 'Fehler beim Hochladen des Galeriefotos' };
            return res.redirect('/profile');
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

// Test Email Route (for testing SMTP configuration)
app.get('/test-email', async (req, res) => {
    const testEmail = req.query.to || process.env.ADMIN_EMAIL;
    
    if (!testEmail) {
        return res.status(400).json({ 
            success: false, 
            message: 'Bitte geben Sie eine E-Mail-Adresse an: /test-email?to=ihre@email.com' 
        });
    }
    
    const testSubject = 'Test E-Mail - Doktorum nerede';
    const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .success { background-color: #10b981; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .info { background-color: #3b82f6; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">
                    <h2>✅ Test E-Mail erfolgreich!</h2>
                </div>
                <div class="info">
                    <p>Diese E-Mail wurde von Ihrem SMTP Server gesendet.</p>
                    <p><strong>Server:</strong> ${process.env.SMTP_HOST || 'Nicht konfiguriert'}</p>
                    <p><strong>Port:</strong> ${process.env.SMTP_PORT || 'Nicht konfiguriert'}</p>
                    <p><strong>Zeit:</strong> ${new Date().toLocaleString('de-DE')}</p>
                </div>
                <p>Wenn Sie diese E-Mail erhalten haben, funktioniert Ihre SMTP-Konfiguration korrekt!</p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    © ${new Date().getFullYear()} Doktorum nerede - Avusturya
                </p>
            </div>
        </body>
        </html>
    `;
    
    try {
        const emailSent = await sendEmail(testEmail, testSubject, testHtml);
        
        if (emailSent) {
            res.json({ 
                success: true, 
                message: `Test E-Mail wurde erfolgreich an ${testEmail} gesendet!`,
                to: testEmail
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'E-Mail konnte nicht gesendet werden. Überprüfen Sie die SMTP-Konfiguration und Server-Logs.',
                to: testEmail
            });
        }
    } catch (error) {
        console.error('Fehler beim Senden der Test-E-Mail:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Fehler beim Senden der E-Mail: ' + error.message,
            to: testEmail
        });
    }
});

// Server starten
app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
}); 