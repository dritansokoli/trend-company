const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');
const db = new Database(DB_PATH);

const newPassword = 'admin123';
const hash = bcrypt.hashSync(newPassword, 10);

db.prepare('DELETE FROM users WHERE username = ?').run('admin');
db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);

console.log('Admin password reset successfully!');
console.log('Username: admin');
console.log('Password: ' + newPassword);

db.close();
