const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const prisma = require('../config/database');
const { SECRET_KEY, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Регистрация (доступна всем, включая администраторов)
router.post('/register', async (req, res) => {
    try {
        console.log('Registration attempt:', req.body.email);
        const { username, email, password, role = 'user' } = req.body;
        
        // Проверка, есть ли токен (если запрос от администратора)
        const authHeader = req.headers['authorization'];
        let isAdminCreating = false;
        
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                if (decoded.role === 'admin') {
                    isAdminCreating = true;
                }
            } catch (err) {
                // Токен невалидный или отсутствует - продолжаем как обычную регистрацию
            }
        }
        
        // Проверка обязательных полей
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
        }
        
        // Проверка, существует ли пользователь
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { username: username }
                ]
            }
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким email или именем уже существует' });
        }
        
        const hashed = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password_hash: hashed,
                role: isAdminCreating ? role : 'user' // Если админ создает, используем указанную роль
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                created_at: true
            }
        });

        console.log('User registered successfully:', user.id);
        
        // Если админ создает пользователя, возвращаем данные без токена
        if (isAdminCreating) {
            res.status(201).json({ 
                message: 'Пользователь успешно создан', 
                user 
            });
        } else {
            res.status(201).json({ 
                message: 'Регистрация прошла успешно', 
                user 
            });
        }
    } catch(err) {
        console.error('Registration error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Логин
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt:', req.body.email);
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        
        const user = await prisma.user.findUnique({
            where: { email }
        });
        
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        if (!user.password_hash) {
            console.log('User has no password (Google OAuth only):', email);
            return res.status(401).json({ error: 'Этот аккаунт зарегистрирован через Google. Пожалуйста, войдите через Google.' });
        }
        
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            console.log('Invalid password for user:', email);
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            SECRET_KEY,
            { expiresIn: '24h' }
        );
        
        console.log('User logged in successfully:', user.id);
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role,
                email: user.email
            } 
        });
    } catch(err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});



module.exports = router;