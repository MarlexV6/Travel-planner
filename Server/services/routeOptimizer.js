
function optimizeRoute(points) {
  if (!points || points.length < 3) return points;
  

  const startPoint = points[0];
  const remainingPoints = points.slice(1);
  
  if (remainingPoints.length < 2) return points;
  
  const unvisited = [...remainingPoints];
  const optimized = [startPoint];
  
  let current = startPoint;
  
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistance(
      current.latitude, current.longitude,
      unvisited[0].latitude, unvisited[0].longitude
    );
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(
        current.latitude, current.longitude,
        unvisited[i].latitude, unvisited[i].longitude
      );
      if (distance < minDistance - 0.001) { 
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    current = unvisited[nearestIndex];
    optimized.push(current);
    unvisited.splice(nearestIndex, 1);
  }
  
  return optimized;
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

function calculateTotalDistance(points) {
  if (!points || points.length < 2) return 0;
  
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(
      points[i].latitude, points[i].longitude,
      points[i + 1].latitude, points[i + 1].longitude
    );
  }
  return total;
}


function isDifferentRoute(original, optimized) {
  if (original.length !== optimized.length) return true;
  
  for (let i = 0; i < original.length; i++) {
    if (original[i].id !== optimized[i].id) {
      return true;
    }
  }
  return false;
}

module.exports = { 
  optimizeRoute, 
  calculateDistance, 
  calculateTotalDistance,
  isDifferentRoute
};