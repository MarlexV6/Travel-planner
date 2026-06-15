const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');

const router = express.Router();


router.get('/', authenticateToken, allowRoles('admin'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                created_at: true,
                _count: {
                    select: { trips: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        
        const formattedUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
            total_trips: user._count.trips
        }));
        
        res.json(formattedUsers);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: err.message });
    }
});


router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                created_at: true,
                _count: {
                    select: { trips: true }
                },
                trips: {
                    select: {
                        id: true,
                        title: true,
                        start_date: true,
                        end_date: true,
                        _count: {
                            select: { points: true }
                        }
                    },
                    orderBy: { start_date: 'desc' },
                    take: 5
                }
            }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const formattedUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
            total_trips: user._count.trips,
            recent_trips: user.trips.map(trip => ({
                id: trip.id,
                title: trip.title,
                start_date: trip.start_date,
                end_date: trip.end_date,
                points_count: trip._count.points
            }))
        };
        
        res.json(formattedUser);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ error: err.message });
    }
});


router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role, username, email } = req.body;
        

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        

        if (username) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    username: username,
                    id: { not: userId }
                }
            });
            if (existingUser) {
                return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
            }
        }
        

        if (email) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    email: email,
                    id: { not: userId }
                }
            });
            if (existingUser) {
                return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            }
        }
        

        const updateData = {};
        if (role) updateData.role = role;
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                created_at: true
            }
        });
        
        let message = 'Пользователь обновлен';
        if (role) message = 'Роль пользователя обновлена';
        if (username) message = 'Имя пользователя обновлено';
        if (email) message = 'Email пользователя обновлен';
        
        res.json({ 
            message: message, 
            user: updatedUser 
        });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: err.message });
    }
});


router.delete('/:id', authenticateToken, allowRoles('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Нельзя удалить свой собственный аккаунт' });
        }
        
        await prisma.user.delete({
            where: { id: userId }
        });
        
        res.json({ message: 'Пользователь успешно удален' });
    } catch (err) {
        console.error('Error deleting user:', err);
        if (err.code === 'P2025') {
            res.status(404).json({ error: 'Пользователь не найден' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});



module.exports = router;