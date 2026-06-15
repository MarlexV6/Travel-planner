const axios = require('axios');


function isValidLandLocation(location) {
    if (!location) return false;

    const waterTypes = [
        'sea', 'ocean', 'strait', 'channel', 'bay', 'gulf', 'water',
        'river', 'lake', 'pond', 'creek', 'stream', 'waterway', 'wetland'
    ];
    const waterClasses = ['natural', 'waterway', 'place'];

    const type = (location.type || '').toLowerCase();
    const cls = (location.class || '').toLowerCase();


    if (waterTypes.includes(type)) return false;
    if (cls === 'waterway' || (cls === 'natural' && type === 'water')) return false;

    if ((cls === 'natural' || cls === 'place') && waterTypes.includes(type)) {
        return false;
    }


    if (location.address) {
        const addr = location.address;
        const hasCityLike = !!(addr.city || addr.town || addr.village || addr.municipality || addr.county);
        const hasGoodPlace = !!(addr.road || addr.amenity || addr.tourism || addr.shop || addr.building);
        const hasCountry = !!addr.country;

        if (!hasCityLike && !hasGoodPlace && !hasCountry) {

            if (parseFloat(location.importance || 0) < 0.25) return false;
        }
    }


    const importance = parseFloat(location.importance || location.confidence || 0);
    const isGoodClass = cls === 'place' || cls === 'boundary' || cls === '';
    if (importance < 0.2 && !isGoodClass) {

        return false;
    }
    return true;
}

async function geocodeCity(cityName) {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: cityName,
                format: 'json',
                limit: 5,
                addressdetails: 1,
                'accept-language': 'ru',
            },
            headers: { 'User-Agent': 'TravelPlannerApp/1.0' },
            timeout: 8000
        });

        if (!response.data || response.data.length === 0) return null;

        let best = null;
        let bestScore = -1;

        for (const loc of response.data) {
            if (!isValidLandLocation(loc)) continue;

            const imp = parseFloat(loc.importance || 0);
            const addr = loc.address || {};
            let score = imp;

            if (addr.city || addr.town || addr.village) score += 1.5;
            if (loc.class === 'place') score += 0.8;
            if (loc.type === 'city' || loc.type === 'town') score += 1.0;

            if (score > bestScore) {
                bestScore = score;
                best = loc;
            }
        }

        if (!best) best = response.data[0]; 

        return {
            latitude: parseFloat(best.lat),
            longitude: parseFloat(best.lon),
            display_name: best.display_name,
            address: best.address,
            place_name: best.address?.city || best.address?.town || best.address?.village || cityName,
            importance: parseFloat(best.importance || 0.5)
        };
    } catch (e) {
        console.error('geocodeCity error:', e.message);
        return null;
    }
}

async function geocodeAddress(address) {
    try {
        console.log('Geocoding address:', address);
        const isLikelyCity = address && address.trim().split(',').length <= 2 && !/\d/.test(address);
        let response;

        if (isLikelyCity) {
            const cityResult = await geocodeCity(address);
            if (cityResult) {
                return {
                    latitude: cityResult.latitude,
                    longitude: cityResult.longitude,
                    display_name: cityResult.display_name || address,
                    address: cityResult.address ? 
                        (cityResult.address.city || cityResult.address.town || cityResult.address.village || address) : address,
                    place_name: cityResult.place_name || address.split(',')[0],
                    confidence: cityResult.importance || 0.7
                };
            }
        }

        response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                limit: 8,
                addressdetails: 1,
                'accept-language': 'ru'
            },
            headers: {
                'User-Agent': 'TravelPlannerApp/1.0'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.length > 0) {
            let best = null;
            let bestScore = -1;

            for (const location of response.data) {
                if (!isValidLandLocation(location)) continue;

                const imp = parseFloat(location.importance || 0);
                const addr = location.address || {};
                let score = imp * 10;

                if (addr.city || addr.town || addr.village) score += 15;
                if (location.class === 'place' || location.type === 'city' || location.type === 'town') score += 12;
                if (addr.road || addr.amenity) score += 5;

                if (score > bestScore) {
                    bestScore = score;
                    best = location;
                }
            }

            let validLocation = best || response.data[0];
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
                

                placeName = addr.name || 
                           addr.road || 
                           addr.city || 
                           addr.town || 
                           addr.village ||
                           'Новое место';
                

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