// services/googlePlacesService.js
const { Client } = require('@googlemaps/google-maps-services-js');

const client = new Client({});

async function getTopAttractions(cityName, apiKey) {
    try {
        // 1. Получаем координаты города
        const geoResponse = await client.geocode({
            params: {
                address: cityName,
                key: apiKey,
            },
        });

        if (geoResponse.data.results.length === 0) {
            throw new Error(`Город "${cityName}" не найден.`);
        }

        const { lat, lng } = geoResponse.data.results[0].geometry.location;

        // 2. Ищем достопримечательности рядом
        const placesResponse = await client.placesNearby({
            params: {
                location: { lat, lng },
                radius: 15000, // Радиус 15 км
                type: 'tourist_attraction', // Ищем только достопримечательности
                key: apiKey,
            },
            timeout: 1000, // таймаут
        });

        // 3. Форматируем результат так же, как вы ожидаете
        const attractions = placesResponse.data.results.map(place => ({
            name: place.name,
            address: place.vicinity,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            place_id: place.place_id,
            // TODO: можно добавить картинку через place-photos
        }));

        return attractions;

    } catch (error) {
        console.error('Error fetching attractions from Google Places API:', error.response?.data?.error_message || error.message);
        throw error; // Пробросим ошибку дальше
    }
}

module.exports = { getTopAttractions };