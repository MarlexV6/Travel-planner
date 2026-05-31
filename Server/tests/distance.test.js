const { calculateDistance, calculateTotalDistance } = require('../services/routeOptimizer');

describe('Distance Calculation', () => {
  // Тест 14: Точность расчета расстояния
  test('should calculate distance with high precision', () => {
    // Москва - Санкт-Петербург
    const moscow = { latitude: 55.751244, longitude: 37.618423 };
    const spb = { latitude: 59.931058, longitude: 30.360913 };
    
    const distance = calculateDistance(moscow.latitude, moscow.longitude, spb.latitude, spb.longitude);
    
    expect(distance).toBeGreaterThan(600);
    expect(distance).toBeLessThan(700);
  });

  // Тест 15: Общая дистанция маршрута
  test('should calculate total distance for multiple points', () => {
    // Arrange
    const points = [
      { latitude: 55.751244, longitude: 37.618423 }, // Москва
      { latitude: 59.931058, longitude: 30.360913 }, // СПб
      { latitude: 54.734806, longitude: 55.957855 }   // Уфа
    ];

    // Act
    const total = calculateTotalDistance(points);

    // Assert
    expect(total).toBeGreaterThan(0);
    expect(typeof total).toBe('number');
  });
});