require('dotenv').config({ path: './dzi.env' });

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const sanitizeHtml = require('sanitize-html');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Initialize SQLite database
const db = new sqlite3.Database('orders.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            service TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Configure Nodemailer with Gmail
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
console.log('EMAIL_USER:', emailUser);
console.log('EMAIL_PASS is set:', !!emailPass);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify email configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email configuration error:', error.message);
    } else {
        console.log('Email server is ready to send messages.');
    }
});

// Validate and sanitize input
function validateInput(data) {
    const { name, email, phone, service, details } = data;
    if (!name || !email || !phone || !service || !details) {
        return { isValid: false, error: 'All fields are required.' };
    }
    if (!/^[a-zA-Z\s]+$/.test(name)) {
        return { isValid: false, error: 'Name must contain only letters and spaces.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { isValid: false, error: 'Invalid email format.' };
    }
    if (!/^\+?\d{10,15}$/.test(phone.replace(/[-()\s]/g, ''))) {
        return { isValid: false, error: 'Invalid phone number.' };
    }
    return { isValid: true };
}

// API Endpoint for form submissions
app.post('/api/orders', (req, res) => {
    console.log('Received POST request:', req.body);
    const { name, email, phone, service, details } = req.body;

    const validation = validateInput(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
    }

    const sanitizedName = sanitizeHtml(name);
    const sanitizedEmail = sanitizeHtml(email);
    const sanitizedPhone = sanitizeHtml(phone);
    const sanitizedService = sanitizeHtml(service);
    const sanitizedDetails = sanitizeHtml(details);

    db.run(
        `INSERT INTO orders (name, email, phone, service, details) VALUES (?, ?, ?, ?, ?)`,
        [sanitizedName, sanitizedEmail, sanitizedPhone, sanitizedService, sanitizedDetails],
        function (err) {
            if (err) {
                console.error('Database insert error:', err.message);
                return res.status(500).json({ error: 'Failed to save order.' });
            }

            const mailOptions = {
                from: emailUser,
                to: 'trekuray@gmail.com',
                subject: 'New Order from Dziquist Website',
                text: `
                    New Order Received:
                    Name: ${sanitizedName}
                    Email: ${sanitizedEmail}
                    Phone: ${sanitizedPhone}
                    Service: ${sanitizedService}
                    Details: ${sanitizedDetails}
                    Timestamp: ${new Date().toISOString()}
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Email sending error:', error.message);
                    return res.status(200).json({ message: 'Order saved, but failed to send email.' });
                }
                console.log('Email sent successfully:', info.response);
                res.status(200).json({ message: 'Order submitted successfully!' });
            });
        }
    );
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port} at ${new Date().toLocaleString('en-GB', { timeZone: 'GMT' })}`);
});