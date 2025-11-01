/**
 * Fachgebiet-Normalisierung
 * Mappt Excel-Fachgebiete auf gültige Optionen aus der Specialty-Liste
 */

function normalizeSpecialty(excelSpecialty, gender = 'male') {
    if (!excelSpecialty || typeof excelSpecialty !== 'string') {
        return '';
    }
    
    const specialty = excelSpecialty.trim();
    const lowerSpecialty = specialty.toLowerCase();
    
    // Mapping von Excel-Fachgebieten zu gültigen Optionen
    const specialtyMappings = {
        // Allgemeinmedizin
        'allgemeinmedizin': 'Allgemeinmedizin',
        'allgemeinmediziner': 'Allgemeinmedizin',
        'allgemeinmedizinerin': 'Allgemeinmedizin',
        'allgemein- und viszeralchirurgie': 'Viszeralchirurgie',
        'allgemeine chirurgie': 'Chirurgie',
        
        // Augenheilkunde
        'augenheilkunde': 'Augenheilkunde',
        'augenheilkunde&optometrie': 'Augenheilkunde',
        
        // Dermatologie
        'dermatologie': 'Dermatologie',
        'dermatologie und zusatzfach angiologie': 'Dermatologie',
        
        // Frauenheilkunde
        'gynäkologie': 'Frauenheilkunde',
        'gynäkologie und geburtshilfe': 'Frauenheilkunde',
        'fa für gynäkologie und geburtshilfe': 'Frauenheilkunde',
        'fä f. gynäkologie und geburtshilfe': 'Frauenheilkunde',
        'fachärztin für gynäkologie und geburtshilfe': 'Frauenheilkunde',
        'fä f. gyn': 'Frauenheilkunde',
        'gynäkologie und geburtshilfe / brust': 'Frauenheilkunde',
        
        // HNO
        'hno': 'HNO',
        'hals-nasen-ohren-heilkunde': 'HNO',
        'hals-nasen-ohren': 'HNO',
        
        // Innere Medizin
        'innere medizin': 'InnereMedizin',
        'internist': 'InnereMedizin',
        'internistin': 'InnereMedizin',
        'kardiologe': 'Kardiologie',
        'kardiologe und internist': 'Kardiologie',
        'fa f innere medizin': 'InnereMedizin',
        'fa für gastroenterologie': 'Gastroenterologie',
        'gastroenterologie': 'Gastroenterologie',
        'innere medizin und nephrologie': 'InnereMedizin',
        'innere medizin-1.medizinische abteilung': 'InnereMedizin',
        'onkologie/innere medizin': 'Hämatologie',
        
        // Kinderheilkunde
        'kinder und jugendheilkunde': 'Kinderheilkunde',
        'kinder- und jugendheilkunde': 'Kinderheilkunde',
        'fä f. kinder- und jugendheilkunde': 'Kinderheilkunde',
        'kinderheilkunde': 'Kinderheilkunde',
        
        // Lungenheilkunde
        'lungenheilkunde': 'Pneumologie',
        'lungenfachärztin': 'Pneumologie',
        'facharzt f. lungenkrankheiten': 'Pneumologie',
        'pneumologie': 'Pneumologie',
        
        // Neurologie
        'neurologie': 'Neurologie',
        'neurologin': 'Neurologie',
        'neurologin i.a.': 'Neurologie',
        
        // Orthopädie
        'orthopädie': 'Orthopädie',
        'orthopädie und orthopädische chirurgie': 'Orthopädie',
        'orthopädie, orthopädische chirurgie und traumatologie': 'Orthopädie',
        
        // Plastische Chirurgie
        'plastische und ästhetische chirurgie': 'PlastischeChirurgie',
        'plastische, ästhetische und rekonstrukrive chirurgie': 'PlastischeChirurgie',
        'plastische-, rekonstruktive und ästhetische chirurgie': 'PlastischeChirurgie',
        
        // Psychiatrie
        'psychiatrie': 'Psychiatrie',
        'psychiatrie und psychotherapie': 'Psychiatrie',
        'psychiatrie und psychotherapeutische medizin': 'Psychiatrie',
        'fachärztin für psychiatrie und psychotherapeutische medizin': 'Psychiatrie',
        'psychiatrie, kinder-u. jugendpsychiatrie': 'Psychiatrie',
        
        // Urologie
        'urologie': 'Urologie',
        'urologie und adrologie': 'Urologie',
        'urologie und andrologie': 'Urologie',
        'urologie und andrologie, febu': 'Urologie',
        
        // Zahnarzt variations
        'zahnarzt, kieferorthopädie, oralchirurgie': 'Zahnmedizin',
        'zahnarzt, kieferorthopädie': 'Zahnmedizin',
        
        // Allgemeinmedizin variations
        'allgemeinmedizin ': 'Allgemeinmedizin',
        'allgemeinmedizin - homöopathie - schröpf-, und blutegeltherapie': 'Allgemeinmedizin',
        'allgemeinmedizin, geriatrie, substitution, orthomol., ernährung ': 'Allgemeinmedizin',
        
        // Augenheilkunde variations
        'augenheilkunde&optometrie, ästhetische medizin': 'Augenheilkunde',
        
        // Neurologie variations
        'neurologie ': 'Neurologie',
        
        // Zahnmedizin
        'zahnmedizin': 'Zahnmedizin',
        'zahnarzt': 'Zahnmedizin',
        'zahnärztin': 'Zahnmedizin',
        'zahn-, mund- & kieferheilkunde': 'Zahnmedizin',
        'zahn-, mund- und kieferheilkunde': 'Zahnmedizin',
        'zahn-, mund-, kieferheilkunde': 'Zahnmedizin',
        'kieferchirurgie': 'KieferChirurgie',
        
        // Physikalische Medizin
        'physikalische medizin': 'Rheumatologie',
        'physikalische medizin und allgemeine rehabilitation': 'Rheumatologie',
    };
    
    // Versuche exaktes Mapping
    if (specialtyMappings[lowerSpecialty]) {
        return specialtyMappings[lowerSpecialty];
    }
    
    // Versuche Partial-Matching
    for (const [key, value] of Object.entries(specialtyMappings)) {
        if (lowerSpecialty.includes(key) || key.includes(lowerSpecialty)) {
            return value;
        }
    }
    
    // Fallback: Prüfe ob bereits gültige Option
    const validSpecialties = [
        'Allgemeinmedizin', 'Anästhesiologie', 'Arbeitsmedizin', 'Augenheilkunde',
        'Chirurgie', 'Dermatologie', 'Endokrinologie', 'Frauenheilkunde',
        'Gastroenterologie', 'Gefäßchirurgie', 'HNO', 'Hämatologie',
        'Infektiologie', 'InnereMedizin', 'Kardiologie', 'KieferChirurgie',
        'Kinderheilkunde', 'Labormedizin', 'Nephrologie', 'Neurologie',
        'Notfallmedizin', 'Nuklearmedizin', 'Orthopädie', 'Pathologie',
        'PlastischeChirurgie', 'Pneumologie', 'Psychiatrie', 'Radiologie',
        'Rechtsmedizin', 'Rheumatologie', 'Strahlentherapie', 'Urologie',
        'Viszeralchirurgie', 'Zahnmedizin'
    ];
    
    // Prüfe ob Specialty bereits gültig ist
    if (validSpecialties.includes(specialty)) {
        return specialty;
    }
    
    // Prüfe ob ähnlich zu gültiger Option
    for (const valid of validSpecialties) {
        const validLower = valid.toLowerCase();
        if (lowerSpecialty.includes(validLower) || validLower.includes(lowerSpecialty)) {
            return valid;
        }
    }
    
    // Fallback: Leer zurückgeben (wird später behandelt)
    return '';
}

module.exports = { normalizeSpecialty };





