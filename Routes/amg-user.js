import express from "express";
import { register, login, getAllUsers, updateUser, sendContactMail, uploadUserDocuments, uploadUserDocumentsMiddleware, getUserDocuments } from "../Controllers/userController.js";
import { authenticate, adminOnly, managerOnly, userOnly } from "../middleawre/middleware.js";

const amg_router = express.Router();

amg_router.post('/register', register);
amg_router.post('/login', login);

amg_router.get('/test', authenticate , (req, res) => {
  res.json({ message: 'AMG User route is working!' });
});

// Editinguser
amg_router.get('/users', authenticate, managerOnly, getAllUsers);
amg_router.put('/users/:id', authenticate, managerOnly, updateUser);
amg_router.post('/contact', sendContactMail);

// Test routes to verify authentication and role-based access control
amg_router.get('/profile', authenticate, (req, res) => {
  res.json({ message: 'Authenticated user', user: req.user });
});
amg_router.get('/admin-area', authenticate, adminOnly, (req, res) => {
  res.json({ message: 'Admin access granted', user: req.user });
});
amg_router.get('/manager-area', authenticate, managerOnly, (req, res) => {
  res.json({ message: 'Manager access granted', user: req.user });
});
// Dcocuments routes
amg_router.post('/users/:id/documents', authenticate, uploadUserDocumentsMiddleware, uploadUserDocuments);
amg_router.get('/users/:id/documents', authenticate, getUserDocuments);

amg_router.get('/user-area', authenticate, userOnly, (req, res) => {
  res.json({ message: 'User access granted', user: req.user });
});

export default amg_router;