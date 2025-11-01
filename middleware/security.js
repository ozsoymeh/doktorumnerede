/**
 * Security Middleware Module
 * Enthält alle Sicherheits-Funktionen für die Anwendung
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * HTML Escape für EJS Templates
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') return String(text);
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Validierung von E-Mail-Adressen
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validierung von Namen (nur Buchstaben, Leerzeichen, Bindestriche, Umlaute)
 */
function validateName(name) {
    if (!name || typeof name !== 'string') return false;
    const nameRegex = /^[a-zA-ZäöüÄÖÜß\s\-']{1,100}$/;
    return nameRegex.test(name);
}

/**
 * Validierung von Telefonnummern (internationales Format)
 */
function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const phoneRegex = /^[\d\s\+\-\(\)]{5,20}$/;
    return phoneRegex.test(phone);
}

/**
 * Validierung von URLs
 */
function validateUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        return false;
    }
}

/**
 * Validierung von Postleitzahlen (österreichisches Format)
 */
function validateZipCode(zipCode) {
    if (!zipCode || typeof zipCode !== 'string') return false;
    const zipRegex = /^\d{4}$/;
    return zipRegex.test(zipCode);
}

/**
 * Path Traversal Prävention
 */
function sanitizePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    
    // Entferne path traversal Sequenzen
    const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    
    // Nur Dateinamen erlauben (keine Verzeichnisse)
    const filename = path.basename(normalized);
    
    // Erlaube nur alphanumerische Zeichen, Bindestriche, Punkte und Unterstriche
    if (!/^[a-zA-Z0-9.\-_]+$/.test(filename)) {
        return null;
    }
    
    return filename;
}

/**
 * Magic Bytes Prüfung für Bilddateien
 */
async function validateImageFile(filePath) {
    try {
        const buffer = await fs.readFile(filePath);
        const bytes = buffer.slice(0, 12);
        
        // JPEG: FF D8 FF
        const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
        
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
        
        return isJPEG || isPNG;
    } catch (error) {
        return false;
    }
}

/**
 * CSRF Token generieren
 */
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Rate Limiting Store (In-Memory für Demo, sollte in Produktion Redis verwenden)
 */
const rateLimitStore = new Map();

/**
 * Rate Limiting Middleware
 */
function rateLimit(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 Minuten
        max = 100, // Max Requests pro Window
        message = 'Zu viele Anfragen, bitte versuchen Sie es später erneut.',
        skipSuccessfulRequests = false,
        skipFailedRequests = false
    } = options;

    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        
        // Bereinige alte Einträge
        for (const [k, v] of rateLimitStore.entries()) {
            if (now - v.resetTime > windowMs) {
                rateLimitStore.delete(k);
            }
        }
        
        let record = rateLimitStore.get(key);
        
        if (!record) {
            record = {
                count: 0,
                resetTime: now + windowMs
            };
            rateLimitStore.set(key, record);
        }
        
        if (now > record.resetTime) {
            record.count = 0;
            record.resetTime = now + windowMs;
        }
        
        record.count++;
        
        if (record.count > max) {
            return res.status(429).json({
                success: false,
                message: message
            });
        }
        
        // Tracking für Request-Status
        res.on('finish', () => {
            if (skipSuccessfulRequests && res.statusCode < 400) {
                record.count--;
            }
            if (skipFailedRequests && res.statusCode >= 400) {
                record.count--;
            }
        });
        
        next();
    };
}

module.exports = {
    escapeHtml,
    validateEmail,
    validateName,
    validatePhone,
    validateUrl,
    validateZipCode,
    sanitizePath,
    validateImageFile,
    generateCSRFToken,
    rateLimit
};

