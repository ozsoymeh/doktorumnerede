require('dotenv').config();
const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const sharp = require('sharp');
const fsPromises = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Lade Übersetzungen
const translations = {
    de: require('./locales/de.json'),
    tr: require('./locales/tr.json')
};

// Verzeichnisse erstellen, falls sie nicht existieren
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const tempUploadsDir = path.join(__dirname, 'public', 'uploads', 'temp');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(tempUploadsDir)) fs.mkdirSync(tempUploadsDir, { recursive: true });

// Multer Konfiguration für Datei-Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'excel') {
            cb(null, 'data/');
        } else if (file.fieldname === 'photo' || file.fieldname === 'galleryPhoto') {
            cb(null, 'public/uploads/temp/');
        }
    },
    filename: function (req, file, cb) {
        if (file.fieldname === 'excel') {
            cb(null, 'doctors.xlsx');
        } else if (file.fieldname === 'photo' || file.fieldname === 'galleryPhoto') {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'photo' || file.fieldname === 'galleryPhoto') {
        // Überprüfe Dateityp
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Nur JPG, JPEG und PNG Dateien sind erlaubt!'), false);
        }
        
        // Überprüfe Dateigröße
        const maxSize = file.fieldname === 'galleryPhoto' ? 1024 * 1024 : 2 * 1024 * 1024; // 1MB für Galerie, 2MB für Profilbild
        if (parseInt(req.headers['content-length']) > maxSize) {
            return cb(new Error(`Die Dateigröße darf maximal ${maxSize / (1024 * 1024)}MB betragen!`), false);
        }
    }
    cb(null, true);
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB in Bytes
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'geheim',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Auf true setzen, wenn HTTPS verwendet wird
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
    }
}));

// Middleware für Übersetzungen
app.use((req, res, next) => {
    // Sprache aus Query-Parameter oder Session oder Default
    const lang = req.query.lang || req.session.lang || 'de';
    req.session.lang = lang;

    // Übersetzungsfunktion
    res.locals.t = (key) => {
        const keys = key.split('.');
        let value = translations[lang];
        for (const k of keys) {
            value = value?.[k];
        }
        return value || key;
    };

    // Aktuelle Sprache
    res.locals.lang = lang;

    next();
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth Middleware
function requireAuth(req, res, next) {
    if (req.session.doctorId) {
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
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const doctors = [];
    for (let row of data) {
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Angepasste Datenzuordnung
        doctors.push({
            academicTitle: row.Titel || '',  // Akademischer Titel
            firstName: row.Name || '',        // Vorname
            lastName: row.Nachname || '',     // Nachname
            specialties: [],                  // Leeres Array für Fachgebiete
            address: `${row.Ordinationsadresse || ''}, ${row.PLZ || ''} ${row.Stadt || ''}`.trim(),
            phone: row.Telefonnummer?.toString() || '',
            email: row['Emailadresse der Ordination'] || '',
            showEmail: false,                 // E-Mail standardmäßig versteckt
            website: row.Webseite || '',
            title: null,                      // Anrede (Herr/Frau) muss beim ersten Login gesetzt werden
            password: hashedPassword,
            plainPassword: password,
            photo: '',
            kassenvertrag: row['Vertrag mit SV'] || '',
            isProfileComplete: false,         // Neues Feld zur Überprüfung, ob das Profil vollständig ist
            originalSpecialty: row.Fachbereich || '', // Ursprüngliches Fachgebiet zur Referenz
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
    if (fs.existsSync(doctorsPath)) {
        return JSON.parse(fs.readFileSync(doctorsPath, 'utf8'));
    }
    return [];
}

function saveDoctors(doctors) {
    fs.writeFileSync(
        path.join(__dirname, 'data', 'doctors.json'),
        JSON.stringify(doctors, null, 2)
    );
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
        lang: req.query.lang || 'de',
        t: (key) => res.locals.t(key)
    });
});

// Neue Route für öffentliche Arztprofile
app.get('/doctor/:nameSlug', (req, res) => {
    const doctors = getDoctors();
    const doctor = doctors.find(d => formatNameForUrl(d.firstName, d.lastName) === req.params.nameSlug);
    
    if (!doctor) {
        return res.status(404).send('Arzt nicht gefunden');
    }

    res.render('doctor', { doctor });
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
        req.session.doctorId = doctor.email;
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
    const doctor = doctors.find(d => d.email === req.session.doctorId);
    
    if (!doctor) {
        req.session.destroy();
        return res.redirect('/login');
    }

    res.render('profile', { 
        doctor: doctor,
        specialties: specialties,
        message: req.session.message
    });
    delete req.session.message;
});

app.post('/update-profile', requireAuth, async (req, res) => {
    const doctors = getDoctors();
    const index = doctors.findIndex(d => d.email === req.session.doctorId);
    
    if (index === -1) {
        req.session.destroy();
        return res.redirect('/login');
    }

    const { 
        title, 
        firstName,
        lastName,
        academicTitle,
        mainSpecialty,
        hasAdditionalSpecialty,
        additionalSpecialty,
        street,
        city,
        zipCode,
        address, 
        phone, 
        email,
        showEmail,
        additionalInfo,
        newPassword,
        website,
        insuranceType,
        insurance
    } = req.body;
    
    // Validierung der Pflichtfelder
    const requiredFields = {
        title: 'Anrede',
        firstName: 'Vorname',
        lastName: 'Nachname',
        mainSpecialty: 'Hauptfachgebiet',
        street: 'Straße',
        city: 'Stadt',
        zipCode: 'PLZ',
        phone: 'Telefonnummer',
        email: 'E-Mail-Adresse'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
        if (!req.body[field]) {
            req.session.message = {
                type: 'error',
                text: `${label} ist ein Pflichtfeld.`
            };
            return res.redirect('/profile');
        }
    }

    // Fachgebiete zusammenstellen
    const specialties = [mainSpecialty];
    if (hasAdditionalSpecialty === 'yes' && additionalSpecialty) {
        specialties.push(additionalSpecialty);
    }

    // Adresse zusammenbauen
    const fullAddress = `${street}, ${zipCode} ${city}`;

    // Update doctor data
    const updatedDoctor = {
        ...doctors[index],
        title,
        firstName,
        lastName,
        academicTitle: academicTitle || '',
        specialties,
        address: fullAddress,
        street,
        city,
        zipCode,
        phone,
        email,
        showEmail: showEmail === 'true',
        additionalInfo: additionalInfo || '',
        website: website || '',
        insurance: insuranceType === 'noContract' 
            ? { noContract: true }
            : {
                noContract: false,
                oegk: insurance?.oegk === 'true',
                svs: insurance?.svs === 'true',
                bvaeb: insurance?.bvaeb === 'true',
                kfa: insurance?.kfa === 'true'
            },
        isProfileComplete: true
    };

    // Update password if provided
    if (newPassword) {
        updatedDoctor.password = await bcrypt.hash(newPassword, 10);
    }

    doctors[index] = updatedDoctor;
    saveDoctors(doctors);
    
    req.session.message = {
        type: 'success',
        text: 'Profil wurde erfolgreich aktualisiert'
    };
    
    res.redirect('/profile');
});

app.post('/upload-photo', requireAuth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Bitte wählen Sie ein Foto aus'
            });
        }

        const doctors = getDoctors();
        const index = doctors.findIndex(d => d.email === req.session.doctorId);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Arzt nicht gefunden'
            });
        }

        // Altes Foto löschen, falls vorhanden
        if (doctors[index].photo) {
            const oldPhotoPath = path.join(__dirname, 'public', 'uploads', doctors[index].photo);
            try {
                await fsPromises.unlink(oldPhotoPath);
            } catch (error) {
                console.error('Fehler beim Löschen des alten Fotos:', error);
            }
        }

        // Verarbeite das neue Foto
        const tempPath = req.file.path;
        const targetFilename = Date.now() + '-' + path.basename(tempPath);
        const targetPath = path.join(uploadsDir, targetFilename);

        // Verarbeite das Bild mit Sharp
        await sharp(tempPath)
            .resize(200, 200, {
                fit: 'cover',
                position: 'center'
            })
            .toFile(targetPath);

        // Lösche das temporäre Bild
        await fsPromises.unlink(tempPath);

        // Aktualisiere den Dateinamen in der Datenbank
        doctors[index].photo = targetFilename;
        saveDoctors(doctors);

        res.json({
            success: true,
            message: 'Foto wurde erfolgreich hochgeladen',
            photo: targetFilename
        });
    } catch (error) {
        console.error('Fehler beim Hochladen des Fotos:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Hochladen des Fotos: ' + error.message
        });
    }
});

// Excel Upload Route
app.post('/upload', upload.single('excel'), async (req, res) => {
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
    res.render('register', { error: null, specialties: specialties });
});

app.post('/register', async (req, res) => {
    const { 
        email, 
        password, 
        confirmPassword, 
        title, 
        academicTitle,
        firstName, 
        lastName,
        mainSpecialty,
        street,
        city,
        zipCode,
        phone,
        additionalInfo
    } = req.body;
    
    if (password !== confirmPassword) {
        return res.render('register', { error: 'Die Passwörter stimmen nicht überein', specialties: specialties });
    }

    const doctors = getDoctors();
    
    if (doctors.find(d => d.email === email)) {
        return res.render('register', { error: 'Diese E-Mail-Adresse ist bereits registriert', specialties: specialties });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const fullAddress = `${street}, ${zipCode} ${city}`;

    const newDoctor = {
        email,
        password: hashedPassword,
        title,
        academicTitle,
        firstName,
        lastName,
        specialties: [mainSpecialty],
        address: fullAddress,
        street,
        city,
        zipCode,
        phone,
        additionalInfo,
        photo: '',
        showEmail: false,
        isProfileComplete: true,
        isApproved: false,
        registrationDate: new Date().toISOString()
    };

    doctors.push(newDoctor);
    saveDoctors(doctors);

    req.session.doctorId = email;
    req.session.message = {
        type: 'success',
        text: 'Registrierung erfolgreich. Ihr Profil wird vom Administrator überprüft.'
    };
    res.redirect('/profile');
});

// Admin Middleware
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(403).render('error', { 
            message: 'Zugriff verweigert',
            error: { status: 403, stack: '' }
        });
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
    const adminIndex = doctors.findIndex(d => d.email === req.session.doctorId);
    
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
app.post('/upload-gallery-photo', requireAuth, upload.single('galleryPhoto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen' });
        }

        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.session.doctorId);
        
        if (doctorIndex === -1) {
            return res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
        }

        // Überprüfe Anzahl der vorhandenen Fotos
        if (doctors[doctorIndex].galleryPhotos && doctors[doctorIndex].galleryPhotos.length >= 2) {
            return res.status(400).json({ success: false, message: 'Maximale Anzahl an Fotos erreicht (2)' });
        }

        // Bild verarbeiten
        const processedFileName = `gallery-${Date.now()}.jpg`;
        await sharp(req.file.path)
            .resize(600, 450, { // 4:3 Format
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(path.join(uploadsDir, processedFileName));

        // Temporäre Datei löschen
        await fsPromises.unlink(req.file.path);

        // Galeriefoto zur Arztdaten hinzufügen
        if (!doctors[doctorIndex].galleryPhotos) {
            doctors[doctorIndex].galleryPhotos = [];
        }
        doctors[doctorIndex].galleryPhotos.push(processedFileName);
        saveDoctors(doctors);

        res.redirect('/profile');
    } catch (error) {
        console.error('Fehler beim Hochladen des Galeriefotos:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Hochladen des Fotos' });
    }
});

app.post('/delete-gallery-photo', requireAuth, async (req, res) => {
    try {
        const { photoName } = req.body;
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.session.doctorId);
        
        if (doctorIndex === -1) {
            return res.status(404).json({ success: false, message: 'Arzt nicht gefunden' });
        }

        // Foto aus der Galerie entfernen
        if (doctors[doctorIndex].galleryPhotos) {
            const photoIndex = doctors[doctorIndex].galleryPhotos.indexOf(photoName);
            if (photoIndex > -1) {
                doctors[doctorIndex].galleryPhotos.splice(photoIndex, 1);
                
                // Foto aus dem Dateisystem löschen
                const photoPath = path.join(uploadsDir, photoName);
                if (fs.existsSync(photoPath)) {
                    await fsPromises.unlink(photoPath);
                }
                
                saveDoctors(doctors);
            }
        }

        res.redirect('/profile');
    } catch (error) {
        console.error('Fehler beim Löschen des Galeriefotos:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Löschen des Fotos' });
    }
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
}); 