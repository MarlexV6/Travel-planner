const axios = require('axios');

async function geocodeAddress(address) {
    try {
        console.log('Geocoding address:', address);
        
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                limit: 1,
                addressdetails: 1,
                'accept-language': 'ru'
            },
            headers: {
                'User-Agent': 'TravelPlannerApp/1.0'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.length > 0) {
            const location = response.data[0];
            
            // Формируем понятный адрес
            let formattedAddress = '';
            if (location.address) {
                const parts = [];
                if (location.address.road) parts.push(location.address.road);
                if (location.address.house_number) parts.push(location.address.house_number);
                if (location.address.city || location.address.town || location.address.village) {
                    parts.push(location.address.city || location.address.town || location.address.village);
                }
                if (location.address.country) parts.push(location.address.country);
                formattedAddress = parts.join(', ');
            }
            
            // Определяем название места
            let placeName = '';
            if (location.address) {
                placeName = location.address.name || 
                           location.address.road || 
                           location.address.city || 
                           location.address.town || 
                           location.address.village ||
                           address.split(',')[0];
            } else {
                placeName = address.split(',')[0];
            }
            
            return {
                latitude: parseFloat(location.lat),
                longitude: parseFloat(location.lon),
                display_name: location.display_name,
                address: formattedAddress || location.display_name,
                place_name: placeName
            };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return null;
    }
}

async function reverseGeocode(lat, lon) {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
                lat: lat,
                lon: lon,
                format: 'json',
                addressdetails: 1,
                'accept-language': 'ru'
            },
            headers: {
                'User-Agent': 'TravelPlannerApp/1.0'
            },
            timeout: 10000
        });
        
        if (response.data) {
            let formattedAddress = '';
            let placeName = '';
            
            if (response.data.address) {
                const addr = response.data.address;
                const parts = [];
                
                // Название места
                placeName = addr.name || 
                           addr.road || 
                           addr.city || 
                           addr.town || 
                           addr.village ||
                           'Новое место';
                
                // Форматируем адрес
                if (addr.road) parts.push(addr.road);
                if (addr.house_number) parts.push(addr.house_number);
                if (addr.city || addr.town || addr.village) {
                    parts.push(addr.city || addr.town || addr.village);
                }
                if (addr.country) parts.push(addr.country);
                formattedAddress = parts.join(', ');
            }
            
            return {
                address: formattedAddress || response.data.display_name,
                place_name: placeName,
                full_address: response.data.display_name
            };
        }
        return null;
    } catch (error) {
        console.error('Reverse geocoding error:', error.message);
        return null;
    }
}

module.exports = { geocodeAddress, reverseGeocode };