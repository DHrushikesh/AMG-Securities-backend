import jwt from 'jsonwebtoken';
import { omitUndefined } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
console.log("JWT_SECRET:", process.env.JWT_SECRET);

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    console.error('JWT verify failed:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'User role not available' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }

    return next();
  };
}

export const adminOnly = authorizeRoles('admin');
export const managerOnly = authorizeRoles('manager', 'admin');
export const userOnly = authorizeRoles('user', 'admin', 'manager');
