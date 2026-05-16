import express from "express";
import { register, login } from "../Controllers/userController.js";

const amg_router = express.Router();

amg_router.post('/register', register);
amg_router.post('/login', login);

export default amg_router;