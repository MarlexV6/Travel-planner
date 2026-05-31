const axios = require('axios');

// Проверить, что место находится на суше, а не в воде
function isValidLandLocation(location) {
    // Исключаем водные объекты
    const waterTypes = [
        'sea', 'ocean', 'strait', 'channel', 'bay', 'gulf', 'water',
        'river', 'lake', 'pond', 'creek', 'stream', 'waterway'
    ];
    
    const waterClasses = ['natural', 'waterway'];
    
    // Проверяем тип объекта
    if (location.type && waterTypes.includes(location.type.toLowerCase())) {
        return false;
    }
    
    // Проверяем класс объекта
    if (location.class && waterClasses.includes(location.class) && 
        location.type && waterTypes.includes(location.type.toLowerCase())) {
        return false;
    }
    
    // Для природных объектов проверяем, это не водоем
    if (location.class === 'natural' && location.type === 'water') {
        return false;
    }
    
    // Хорошее место должно иметь хоть какой-то адрес (город, деревню и т.д.)
    if (location.address) {
        const hasCity = location.address.city || location.address.town || 
                       location.address.village || location.address.county ||
                       location.address.state || location.address.country;
        if (!hasCity) {
            return false;
        }
    }
    
    return true;
}

async function geocodeAddress(address) {
    try {
        console.log('Geocoding address:', address);
        
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                limit: 10,  // Получаем несколько результатов
                addressdetails: 1,
                'accept-language': 'ru'
            },
            headers: {
                'User-Agent': 'TravelPlannerApp/1.0'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.length > 0) {
            // Фильтруем результаты: выбираем первый валидный результат
            let validLocation = null;
            for (const location of response.data) {
                if (isValidLandLocation(location)) {
                    validLocation = location;
                    break;
                }
            }
            
            // Если нет валидного результата на суше, используем первый результат с предупреждением
            if (!validLocation) {
                console.warn('No land location found for address:', address);
                validLocation = response.data[0];
            }
            
            // Формируем понятный адрес
            let formattedAddress = '';
            if (validLocation.address) {
                const parts = [];
                if (validLocation.address.road) parts.push(validLocation.address.road);
                if (validLocation.address.house_number) parts.push(validLocation.address.house_number);
                if (validLocation.address.city || validLocation.address.town || validLocation.address.village) {
                    parts.push(validLocation.address.city || validLocation.address.town || validLocation.address.village);
                }
                if (validLocation.address.country) parts.push(validLocation.address.country);
                formattedAddress = parts.join(', ');
            }
            
            // Определяем название места
            let placeName = '';
            if (validLocation.address) {
                placeName = validLocation.address.name || 
                           validLocation.address.road || 
                           validLocation.address.city || 
                           validLocation.address.town || 
                           validLocation.address.village ||
                           address.split(',')[0];
            } else {
                placeName = address.split(',')[0];
            }
            
            return {
                latitude: parseFloat(validLocation.lat),
                longitude: parseFloat(validLocation.lon),
                display_name: validLocation.display_name,
                address: formattedAddress || validLocation.display_name,
                place_name: placeName,
                confidence: parseFloat(validLocation.importance || 0.5)
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
            // Проверяем, не находимся ли мы в воде
            if (response.data.address) {
                const isLand = isValidLandLocation(response.data);
                if (!isLand) {
                    console.warn('Reverse geocoded location appears to be in water:', lat, lon);
                }
            }
            
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