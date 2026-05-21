const axios = require('axios');

async function getRoute(startLat, startLon, endLat, endLon, mode = 'driving') {
    try {
        let profile = 'driving';
        switch(mode) {
            case 'walking':
                profile = 'foot';
                break;
            case 'bicycle':
                profile = 'cycling';
                break;
            case 'driving':
                profile = 'driving';
                break;
            default:
                profile = 'driving';
        }
        
        if (mode === 'driving' || mode === 'walking' || mode === 'bicycle') {
            const url = `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}`;
            
            const response = await axios.get(url, {
                params: {
                    overview: 'full',
                    geometries: 'polyline',
                    steps: true
                },
                timeout: 10000
            });
            
            if (response.data && response.data.routes && response.data.routes.length > 0) {
                const route = response.data.routes[0];
                const leg = route.legs[0];
                
                return {
                    available: true,
                    distance: route.distance / 1000,
                    duration: route.duration,
                    duration_hours: (route.duration / 3600).toFixed(1),
                    geometry: route.geometry,
                    mode: mode,
                    mode_name: getModeName(mode),
                    steps: leg.steps.map(step => ({
                        instruction: step.maneuver.instruction,
                        distance: step.distance,
                        duration: step.duration
                    }))
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Route calculation error for ${mode}:`, error.message);
        return null;
    }
}

async function checkFlightAvailability(startLat, startLon, endLat, endLon) {
    try {
        const airports = await getNearestAirports(startLat, startLon);
        const nearestAirport = airports[0];
        
        if (!nearestAirport) return null;
        
        const distance = calculateDistance(startLat, startLon, endLat, endLon);
        
        if (distance > 200) {
            const flightDuration = (distance / 800) * 3600;
            
            return {
                available: true,
                distance: distance,
                duration: flightDuration,
                duration_hours: (flightDuration / 3600).toFixed(1),
                mode: 'flight',
                mode_name: 'Самолет',
                from_airport: nearestAirport.name,
                note: 'Примерное время полета'
            };
        }
        return null;
    } catch (error) {
        console.error('Flight check error:', error);
        return null;
    }
}

async function checkFerryAvailability(startLat, startLon, endLat, endLon) {
    try {
        const isStartNearWater = await isNearWater(startLat, startLon);
        const isEndNearWater = await isNearWater(endLat, endLon);
        
        if (isStartNearWater && isEndNearWater) {
            const distance = calculateDistance(startLat, startLon, endLat, endLon);
            
            if (distance > 50) {
                const ferryDuration = (distance / 50) * 3600;
                
                return {
                    available: true,
                    distance: distance,
                    duration: ferryDuration,
                    duration_hours: (ferryDuration / 3600).toFixed(1),
                    mode: 'ferry',
                    mode_name: 'Паром',
                    note: 'Водное сообщение'
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Ferry check error:', error);
        return null;
    }
}

async function getMultiModalRoute(startLat, startLon, endLat, endLon) {
    const results = [];
    
    const modes = ['driving', 'walking', 'bicycle'];
    
    for (const mode of modes) {
        const route = await getRoute(startLat, startLon, endLat, endLon, mode);
        if (route) {
            results.push(route);
        }
    }
    
    const flight = await checkFlightAvailability(startLat, startLon, endLat, endLon);
    if (flight) {
        results.push(flight);
    }
    
    const ferry = await checkFerryAvailability(startLat, startLon, endLat, endLon);
    if (ferry) {
        results.push(ferry);
    }
    
    results.sort((a, b) => a.duration - b.duration);
    
    return results;
}

async function isNearWater(lat, lon) {
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lat: lat,
                lon: lon,
                format: 'json',
                zoom: 10,
                addressdetails: 1
            },
            headers: { 'User-Agent': 'TravelPlannerApp/1.0' },
            timeout: 5000
        });
        
        if (response.data && response.data.address) {
            const waterTags = ['water', 'river', 'lake', 'sea', 'ocean', 'bay', 'harbour'];
            for (const tag of waterTags) {
                if (response.data.address[tag]) {
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function getNearestAirports(lat, lon) {
    const airports = [
        { name: 'Аэропорт Минск', lat: 53.8825, lon: 28.0306 },
        { name: 'Аэропорт Москва (Шереметьево)', lat: 55.9726, lon: 37.4146 },
        { name: 'Аэропорт Санкт-Петербург (Пулково)', lat: 59.8003, lon: 30.2625 },
        { name: 'Аэропорт Киев (Борисполь)', lat: 50.3450, lon: 30.8947 },
        { name: 'Аэропорт Варшава (Шопен)', lat: 52.1657, lon: 20.9671 }
    ];
    
    const nearest = airports.map(airport => ({
        ...airport,
        distance: calculateDistance(lat, lon, airport.lat, airport.lon)
    })).sort((a, b) => a.distance - b.distance);
    
    return nearest.slice(0, 2);
}

function getModeName(mode) {
    const names = {
        'driving': 'Автомобиль',
        'walking': 'Пешком',
        'bicycle': 'Велосипед',
        'flight': 'Самолет',
        'ferry': 'Паром'
    };
    return names[mode] || mode;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.asin(Math.sqrt(a));
    return R * c;
}

module.exports = {
    getRoute,
    getMultiModalRoute,
    getModeName,
    calculateDistance
};