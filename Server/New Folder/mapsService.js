const { Client } = require('@googlemaps/google-maps-services-js');

const client = new Client({});

// База данных портов (для демонстрации)
const ports = {
  airports: [
    { name: "Шереметьево (SVO)", lat: 55.9726, lon: 37.4146, type: "airport" },
    { name: "Домодедово (DME)", lat: 55.4103, lon: 37.9025, type: "airport" },
    { name: "Внуково (VKO)", lat: 55.5915, lon: 37.2615, type: "airport" }
  ],
  seaports: [
    { name: "Морской порт Санкт-Петербург", lat: 59.8814, lon: 30.2869, type: "seaport" },
    { name: "Новороссийский морской порт", lat: 44.7339, lon: 37.7840, type: "seaport" }
  ]
};

// Проверка, можно ли доехать на машине
async function checkCarAccess(lat, lng) {
  try {
    // Здесь можно использовать Google Maps Roads API для проверки
    // или Distance Matrix API для проверки, есть ли дорога
    const response = await client.distancematrix({
      params: {
        origins: [`${lat},${lng}`],
        destinations: [`${lat},${lng}`],
        key: process.env.GOOGLE_MAPS_API_KEY,
        mode: 'driving'
      }
    });
    
    // Если расстояние 0 и есть статус OK, значит точка доступна
    return response.data.rows[0].elements[0].status === 'OK';
  } catch (error) {
    console.error('Error checking car access:', error);
    return false;
  }
}

// Поиск ближайшего порта или аэропорта
function findNearestPort(lat, lng, type = 'both') {
  let allPorts = [];
  if (type === 'both' || type === 'airport') allPorts.push(...ports.airports);
  if (type === 'both' || type === 'seaport') allPorts.push(...ports.seaports);
  
  let nearest = null;
  let minDistance = Infinity;
  
  for (const port of allPorts) {
    const distance = calculateDistance(lat, lng, port.lat, port.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = port;
    }
  }
  
  return { port: nearest, distance: minDistance };
}

// Расчет расстояния по формуле гаверсинуса
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

// Поиск оптимального маршрута между точками
async function findOptimalRoute(points, mode = 'driving') {
  if (!points || points.length < 2) return null;
  
  try {
    const waypoints = points.slice(1, -1).map(p => `${p.latitude},${p.longitude}`);
    const origin = `${points[0].latitude},${points[0].longitude}`;
    const destination = `${points[points.length-1].latitude},${points[points.length-1].longitude}`;
    
    const response = await client.directions({
      params: {
        origin,
        destination,
        waypoints: waypoints,
        mode: mode,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.routes && response.data.routes[0]) {
      const route = response.data.routes[0];
      const leg = route.legs[0];
      
      return {
        distance: leg.distance.text,
        duration: leg.duration.text,
        distance_km: leg.distance.value / 1000,
        duration_seconds: leg.duration.value,
        polyline: route.overview_polyline.points,
        steps: leg.steps.map(step => ({
          instruction: step.html_instructions,
          distance: step.distance.text,
          duration: step.duration.text
        }))
      };
    }
    return null;
  } catch (error) {
    console.error('Error finding route:', error);
    return null;
  }
}

// Расчет времени в пути с учетом пересадок на порты
async function calculateTravelTimeWithTransfers(points, averageSpeed = 60) {
  const segments = [];
  let totalTime = 0;
  
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    const hasCarAccess = await checkCarAccess(start.latitude, start.longitude);
    
    if (hasCarAccess) {
      // Можно ехать на машине
      const route = await findOptimalRoute([start, end], 'driving');
      if (route) {
        segments.push({
          type: 'driving',
          from: start.place_name,
          to: end.place_name,
          distance: route.distance_km,
          duration: route.duration_seconds,
          route: route
        });
        totalTime += route.duration_seconds;
      }
    } else {
      // Нужно искать порт/аэропорт
      const nearestPort = findNearestPort(start.latitude, start.longitude);
      const toPort = await findOptimalRoute([start, nearestPort.port], 'driving');
      const fromPort = await findOptimalRoute([nearestPort.port, end], 'driving');
      
      segments.push({
        type: 'transfer',
        from: start.place_name,
        to: nearestPort.port.name,
        distance: toPort?.distance_km || 0,
        duration: toPort?.duration_seconds || 0,
        via: nearestPort.port.name,
        viaType: nearestPort.port.type
      });
      
      segments.push({
        type: 'transfer',
        from: nearestPort.port.name,
        to: end.place_name,
        distance: fromPort?.distance_km || 0,
        duration: fromPort?.duration_seconds || 0,
        via: nearestPort.port.name,
        viaType: nearestPort.port.type
      });
      
      totalTime += (toPort?.duration_seconds || 0) + (fromPort?.duration_seconds || 0);
    }
  }
  
  return {
    total_seconds: totalTime,
    total_hours: (totalTime / 3600).toFixed(1),
    segments: segments
  };
}

module.exports = {
  findOptimalRoute,
  checkCarAccess,
  findNearestPort,
  calculateTravelTimeWithTransfers
};