const bcrypt = require('bcrypt');

const password = 'admin123'; // Das gewünschte Admin-Passwort
const saltRounds = 10;

bcrypt.hash(password, saltRounds).then(hash => {
    console.log('Gehashtes Passwort:', hash);
}); 