require('dotenv').config();
const express = require('express');
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
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
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(tempUploadsDir)) fs.mkdirSync(tempUploadsDir, { recursive: true });

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
        lang: req.query.lang || req.session.lang || 'de',
        t: res.locals.t
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

app.post('/profile/edit', requireAuth, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'galleryPhotos', maxCount: 2 }
]), async (req, res) => {
    try {
        const doctors = getDoctors();
        const doctorIndex = doctors.findIndex(d => d.email === req.session.doctorId);
        
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
            insurance: {
                noContract: req.body.insuranceType === 'noContract',
                oegk: req.body['insurance[oegk]'] === 'true',
                svs: req.body['insurance[svs]'] === 'true',
                bvaeb: req.body['insurance[bvaeb]'] === 'true',
                kfa: req.body['insurance[kfa]'] === 'true'
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

        res.redirect('/profile');
    } catch (error) {
        console.error('Fehler beim Speichern der Profiländerungen:', error);
        req.session.message = {
            type: 'error',
            text: 'Beim Speichern der Änderungen ist ein Fehler aufgetreten.'
        };
        res.redirect('/profile');
    }
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
app.post('/upload-gallery-photo', requireAuth, upload.single('galleryPhotos'), async (req, res) => {
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