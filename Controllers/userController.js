import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import User from '../Models/User.js';

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
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function sendContactMail(req, res) {
  try {
    const { email, phone, company, services, message } = req.body;

    if (!email || !phone || !company || !services) {
      return res.status(400).json({ error: 'Missing required contact fields' });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const recipient = process.env.CONTACT_TO_EMAIL || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass || !recipient) {
      return res.status(500).json({ error: 'Email sender is not configured' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: smtpUser,
      to: recipient,
      replyTo: email,
      subject: `New contact form submission from ${company}`,
      text: `New contact form submission:\n\nEmail: ${email}\nPhone: ${phone}\nCompany: ${company}\nServices: ${services}\nMessage: ${message || 'N/A'}`,
      html: `
        <h2>New contact form submission</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Services:</strong> ${services}</p>
        <p><strong>Message:</strong> ${message || 'N/A'}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ message: 'Contact email sent successfully' });
  } catch (err) {
    console.error(err);
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
