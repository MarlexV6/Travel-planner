// routes/aiPlaces.js
const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { geocodeAddress } = require('../services/geocoding');

const router = express.Router();

// Функция получения картинки из Wikipedia (без изменений)
async function getImageForPlace(placeName) {
    try {
        const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                format: 'json',
                titles: placeName,
                prop: 'pageimages',
                pithumbsize: 300,
                origin: '*'
            },
            timeout: 3000
        });
        const pages = searchResponse.data.query.pages;
        for (const page of Object.values(pages)) {
            if (page.thumbnail) return page.thumbnail.source;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Основная функция получения мест через OpenAI
async function getPlacesFromAI(city, lat, lon, limit = 10) {
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set, AI unavailable');
        return null;
    }

    const prompt = `Ты — эксперт-гид. Назови топ-${limit} реальных достопримечательностей в городе ${city} (центр: ${lat}, ${lon}). 
Для каждой достопримечательности укажи:
- "name" – название на русском,
- "category" – категория (Музей, Парк, Собор, Замок, Площадь, Театр, Галерея, Памятник, Другое),
- "description" – краткое описание на русском (1 предложение),
- "address" – реальный адрес (улица, номер, город),
- "latitude" – широта (число),
- "longitude" – долгота (число).

Координаты должны быть точными (можно взять из OpenStreetMap или Google Maps). 
Верни ТОЛЬКО валидный JSON массив, без дополнительных комментариев. Пример:
[
  {
    "name": "Эйфелева башня",
    "category": "Памятник",
    "description": "Знаменитая металлическая башня, символ Парижа.",
    "address": "Champ de Mars, 5 Avenue Anatole France, 75007 Paris",
    "latitude": 48.8584,
    "longitude": 2.2945
  }
]`;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        let content = response.data.choices[0].message.content;
        // Очистка от возможных маркеров кода
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const places = JSON.parse(content);
        
        // Дополнительная проверка: если координаты отсутствуют или равны 0 – пытаемся получить через geocoding
        for (const place of places) {
            if (!place.latitude || !place.longitude || (place.latitude === 0 && place.longitude === 0)) {
                try {
                    const geo = await geocodeAddress(`${place.name}, ${city}`);
                    if (geo) {
                        place.latitude = geo.latitude;
                        place.longitude = geo.longitude;
                        if (!place.address) place.address = geo.address;
                    }
                } catch(e) { console.warn(`Geocoding failed for ${place.name}`); }
            }
        }
        
        return places.slice(0, limit);
    } catch (error) {
        console.error('AI places error:', error.message);
        return null;
    }
}

// Ручной fallback через Overpass (на случай отсутствия AI)
async function getPlacesViaOverpass(lat, lon, radius = 10000) {
    try {
        const latMin = lat - (radius / 90000);
        const latMax = lat + (radius / 90000);
        const lonMin = lon - (radius / (90000 * Math.cos(lat * Math.PI / 180)));
        const lonMax = lon + (radius / (90000 * Math.cos(lat * Math.PI / 180)));
        const overpassQuery = `
            [out:json][timeout:25];
            (
                node["tourism"](${latMin},${lonMin},${latMax},${lonMax});
                node["historic"](${latMin},${lonMin},${latMax},${lonMax});
                node["leisure"="park"](${latMin},${lonMin},${latMax},${lonMax});
                node["amenity"="museum"](${latMin},${lonMin},${latMax},${lonMax});
                way["tourism"](${latMin},${lonMin},${latMax},${lonMax});
            );
            out body;
            out skel qt;
        `;
        const response = await axios.post('https://overpass-api.de/api/interpreter',
            `data=${encodeURIComponent(overpassQuery)}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TravelPlannerApp/1.0' }, timeout: 10000 }
        );
        const elements = response.data.elements || [];
        const places = [];
        for (const el of elements) {
            let name = el.tags?.name || el.tags?.name_ru || '';
            if (!name) continue;
            let latCoord = el.lat;
            let lonCoord = el.lon;
            if (!latCoord && el.center) {
                latCoord = el.center.lat;
                lonCoord = el.center.lon;
            }
            if (!latCoord || !lonCoord) continue;
            places.push({
                name,
                category: el.tags?.tourism ? 'Туристическое место' : (el.tags?.historic ? 'Историческое' : 'Достопримечательность'),
                description: el.tags?.description || el.tags?.description_ru || `Посетите ${name}`,
                address: el.tags?.['addr:street'] || el.tags?.['addr:city'] || '',
                latitude: latCoord,
                longitude: lonCoord
            });
            if (places.length >= 10) break;
        }
        return places;
    } catch (error) {
        console.error('Overpass fallback error:', error.message);
        return [];
    }
}

// Эндпоинт /api/ai-places/search
router.get('/search', authenticateToken, async (req, res) => {
    try {
        let { city, lat, lon, limit = 10 } = req.query;
        if (!city && (!lat || !lon)) {
            return res.status(400).json({ error: 'Укажите city или координаты (lat,lon)' });
        }

        let latitude = lat ? parseFloat(lat) : null;
        let longitude = lon ? parseFloat(lon) : null;

        if (!latitude || !longitude) {
            const geoResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { q: city, format: 'json', limit: 1, addressdetails: 1 },
                headers: { 'User-Agent': 'TravelPlannerApp/1.0' },
                timeout: 5000
            });
            if (geoResponse.data && geoResponse.data.length > 0) {
                latitude = parseFloat(geoResponse.data[0].lat);
                longitude = parseFloat(geoResponse.data[0].lon);
            } else {
                return res.status(404).json({ error: 'Город не найден' });
            }
        }

        let places = [];
        let usedAI = false;

        if (process.env.OPENAI_API_KEY) {
            const aiPlaces = await getPlacesFromAI(city, latitude, longitude, parseInt(limit));
            if (aiPlaces && aiPlaces.length > 0) {
                places = aiPlaces;
                usedAI = true;
            }
        }

        if (!usedAI || places.length === 0) {
            console.log(`AI not used or returned empty, using Overpass fallback for ${city}`);
            places = await getPlacesViaOverpass(latitude, longitude, 15000);
        }

        if (!places.length) {
            return res.json({ places: [], hasMore: false, usedAI: false });
        }

        // Добавляем изображения
        const placesWithImages = await Promise.all(places.map(async (place) => {
            const imageUrl = await getImageForPlace(place.name);
            return { ...place, image: imageUrl };
        }));

        res.json({
            places: placesWithImages,
            hasMore: false,
            usedAI: usedAI
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Ошибка поиска достопримечательностей' });
    }
});

module.exports = router;