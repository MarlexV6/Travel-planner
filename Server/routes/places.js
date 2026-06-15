const express = require('express');
const { getPlacesNearby, searchPlacesByCity, getPopularPlaces } = require('../services/placesService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();


router.get('/nearby', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Необходимо указать координаты' });
    }
    
    const places = await getPlacesNearby(parseFloat(lat), parseFloat(lng), parseInt(radius));
    res.json(places);
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ error: error.message });
  }
});


router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { city } = req.query;
    
    if (!city) {
      return res.status(400).json({ error: 'Необходимо указать город' });
    }
    
    const places = await searchPlacesByCity(city);
    res.json(places);
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: error.message });
  }
});


router.get('/popular', authenticateToken, async (req, res) => {
  try {
    const { city } = req.query;
    const places = await getPopularPlaces(city || 'Москва');
    res.json(places);
  } catch (error) {
    console.error('Error fetching popular places:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;