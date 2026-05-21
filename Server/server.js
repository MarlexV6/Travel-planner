require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tripRoutes = require('./routes/trips');
const statsRoutes = require('./routes/stats');
const placesRoutes = require('./routes/places');
const { authenticateToken } = require('./middleware/auth');

console.log('DATABASE_URL found:', process.env.DATABASE_URL?.substring(0, 30) + '...');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://localhost', 'http://localhost'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// API маршруты
app.use('/api/places', placesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/stats', statsRoutes);
app.get('/api/me', authenticateToken, (req, res) => {
    res.json(req.user);
});


app.post('/api/test', (req, res) => {
    console.log('Test route hit');
    console.log('Body:', req.body);
    res.json({ message: 'Test OK', body: req.body });
});



app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});