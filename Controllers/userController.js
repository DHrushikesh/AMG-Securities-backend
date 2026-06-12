import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import User from '../Models/User.js';

const uploadBasePath = path.join(process.cwd(), 'uploads');
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const userId = req.params.id;
    const dest = path.join(uploadBasePath, userId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname) || '';
    cb(null, `${file.fieldname}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadUserDocumentsMiddleware = upload.fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'bankDetails', maxCount: 1 },
  { name: 'qualification', maxCount: 1 },
  { name: 'policeVerification', maxCount: 1 },
]);

function makePublicPath(userId, filename) {
  return `/uploads/${userId}/${filename}`;
}

export async function uploadUserDocuments(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const allowedSelf = req.user.id === id;
    const allowedManager = ['admin', 'manager'].includes(req.user.role);
    if (!allowedSelf && !allowedManager) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const files = req.files || {};
    const requiredFields = ['aadharCard', 'panCard', 'bankDetails', 'qualification', 'policeVerification'];

    for (const field of requiredFields) {
      if (!files[field] || !files[field].length) {
        return res.status(400).json({ error: `Missing ${field} file upload` });
      }
    }

    const documents = {
      name,
      aadharCard: makePublicPath(id, files.aadharCard[0].filename),
      panCard: makePublicPath(id, files.panCard[0].filename),
      bankDetails: makePublicPath(id, files.bankDetails[0].filename),
      qualification: makePublicPath(id, files.qualification[0].filename),
      policeVerification: makePublicPath(id, files.policeVerification[0].filename),
      uploadedAt: new Date(),
    };

    const user = await User.findByIdAndUpdate(
      id,
      { documents },
      { returnDocument: 'after', runValidators: true, context: 'query' }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'Documents uploaded successfully', documents: user.documents });
  } catch (err) {
    console.error('Upload documents error:', err);
    return res.status(500).json({ error: 'Server error uploading documents' });
  }
}

export async function getUserDocuments(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const allowedSelf = req.user.id === id;
    const allowedAdmin = req.user.role === 'admin';
    if (!allowedSelf && !allowedAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(id).select('documents').lean().exec();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.documents || Object.keys(user.documents).length === 0) {
      return res.status(404).json({ error: 'No documents found for this user' });
    }

    return res.json({ documents: user.documents });
  } catch (err) {
    console.error('Fetch documents error:', err);
    return res.status(500).json({ error: 'Server error fetching documents' });
  }
}

export async function register(req, res) {
  try {
    const { fullName, username, password, phone, role } = req.body;
    if (!fullName || !username || !password || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ username }).exec();
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ fullName, username, password: hashed, phone ,role: role || 'user' });
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.password;
    return res.status(201).json({ message: 'User registered', user: safeUser });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const user = await User.findOne({ username }).exec();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username , role: user.role , phone: user.phone , fullName: user.fullName },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '1h' }
    );

    const safeUser = user.toObject();
    delete safeUser.password;
    return res.json({ message: 'Login successful', token, user: safeUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllUsers(req, res) {
  try {
    const users = await User.find({}, '-password').lean().exec();
    return res.json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error ' });
  }
}

async function sendViaBrevoApi({ senderEmail, recipientEmail, subject, text, html, replyTo }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing BREVO_API_KEY for Brevo API email delivery');
  }

  const payload = {
    sender: { email: senderEmail },
    to: [{ email: recipientEmail }],
    subject,
    textContent: text,
    htmlContent: html,
    replyTo: { email: replyTo },
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Brevo API request failed: ${response.status} ${response.statusText} - ${body}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export async function sendContactMail(req, res) {
  try {
    const { email, phone, company, services, message } = req.body;

    if (!email || !phone || !company || !services) {
      return res.status(400).json({ error: 'Missing required contact fields' });
    }

    const senderEmail = process.env.SENDER_EMAIL;
    const recipientEmail = email;
    const useBrevoApi = Boolean(process.env.BREVO_API_KEY);

    if (!senderEmail || !recipientEmail) {
      return res.status(500).json({ error: 'Email sender or recipient is not configured' });
    }

    const subject = `New contact form submission from ${company}`;
    const text = `New contact form submission:\n\nEmail: ${email}\nPhone: ${phone}\nCompany: ${company}\nServices: ${services}\nMessage: ${message || 'N/A'}`;
    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Company:</strong> ${company}</p>
      <p><strong>Services:</strong> ${services}</p>
      <p><strong>Message:</strong> ${message || 'N/A'}</p>
    `;

    if (useBrevoApi) {
      await sendViaBrevoApi({
        senderEmail,
        recipientEmail,
        subject,
        text,
        html,
        replyTo: email,
      });
    } else {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpHost || !smtpPass) {
        return res.status(500).json({ error: 'SMTP connection details are not configured' });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: senderEmail, pass: smtpPass },
      });

      await transporter.sendMail({
        from: senderEmail,
        to: recipientEmail,
        replyTo: email,
        subject,
        text,
        html,
      });
    }

    return res.json({ message: 'Contact email sent successfully' });
  } catch (err) {
    console.error('Contact mail error:', err);

    if (err.status === 401 || err.status === 403 || err.code === 'EAUTH') {
      return res.status(502).json({ error: 'Email provider authentication failed' });
    }

    return res.status(500).json({ error: 'Failed to send contact email' });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const allowedFields = ['fullName', 'username', 'phone', 'role', 'password'];
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );

    const user = await User.findByIdAndUpdate(id, filteredUpdates, {
      returnDocument: 'after',
      runValidators: true,
      context: 'query',
    }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'User updated successfully', user });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
}
