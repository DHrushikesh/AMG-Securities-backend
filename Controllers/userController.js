import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../Models/User.js';

export async function register(req, res) {
  try {
    const { fullName, username, password, phone } = req.body;
    if (!fullName || !username || !password || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ username }).exec();
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ fullName, username, password: hashed, phone });
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
