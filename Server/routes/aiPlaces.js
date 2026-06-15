const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { 
    searchPlacesByCity, 
    getTopAttractions, 
    getCityDiscovery 
} = require('../services/placesService');

const router = express.Router();


router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { city, limit = 10 } = req.query;
        
        if (!city || !city.trim()) {
            return res.status(400).json({ error: 'Необходимо указать город', places: [] });
        }

        let places = await getTopAttractions(city.trim(), parseInt(limit) || 10);

        if (!places || places.length === 0) {
            places = await searchPlacesByCity(city.trim());
            places = places.slice(0, parseInt(limit) || 10);
        }

        res.json({ places });
    } catch (error) {
        console.error('ai-places/search error:', error);
        res.status(500).json({ error: 'Ошибка поиска мест', places: [] });
    }
});


router.get('/discover', authenticateToken, async (req, res) => {
    try {
        const { city } = req.query;
        
        if (!city || !city.trim()) {
            return res.status(400).json({ error: 'Необходимо указать город/страну' });
        }

        const discovery = await getCityDiscovery(city.trim());
        res.json(discovery);
    } catch (error) {
        console.error('ai-places/discover error:', error);
        res.status(500).json({ 
            error: 'Ошибка генерации рекомендаций', 
            center: null, 
            attractions: [], 
            hotels: [] 
        });
    }
});

module.exports = router;