const { calculateDistance, optimizeRoute } = require('../services/routeOptimizer');

describe('Route Optimization Service', () => {
  // Тест 4: Расчет расстояния между точками
  test('should calculate correct distance between two points', () => {
    // Arrange
    const point1 = { latitude: 55.751244, longitude: 37.618423 };
    const point2 = { latitude: 55.752244, longitude: 37.619423 };

    // Act
    const distance = calculateDistance(point1.latitude, point1.longitude, point2.latitude, point2.longitude);

    // Assert
    expect(distance).toBeGreaterThan(0);
    expect(typeof distance).toBe('number');
    expect(distance).toBeLessThan(1); // Расстояние менее 1 км
  });

  // Тест 5: Расстояние между одинаковыми точками
  test('should return zero distance for same point', () => {
    // Arrange
    const point = { latitude: 55.751244, longitude: 37.618423 };

    // Act
    const distance = calculateDistance(point.latitude, point.longitude, point.latitude, point.longitude);

    // Assert
    expect(distance).toBe(0);
  });

  // Тест 6: Оптимизация маршрута (с 3 точками)
  test('should optimize route order for 3 points', () => {
    // Arrange
    const points = [
      { id: 1, latitude: 0, longitude: 0, place_name: 'A' },
      { id: 2, latitude: 10, longitude: 0, place_name: 'B' },
      { id: 3, latitude: 5, longitude: 5, place_name: 'C' }
    ];

    // Act
    const optimized = optimizeRoute(points);

    // Assert
    expect(optimized.length).toBe(3);
    expect(optimized[0].id).toBe(1); // Первая точка сохраняется
  });

  // Тест 7: Оптимизация с 2 точками (без изменений)
  test('should not change order for 2 points', () => {
    // Arrange
    const points = [
      { id: 1, latitude: 0, longitude: 0 },
      { id: 2, latitude: 10, longitude: 10 }
    ];

    // Act
    const optimized = optimizeRoute(points);

    // Assert
    expect(optimized).toEqual(points);
  });
});