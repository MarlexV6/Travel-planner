const TripValidator = require('../services/tripValidator');

// Создаем мок для prisma
jest.mock('../config/database', () => ({
  tripWarning: { deleteMany: jest.fn(), create: jest.fn() },
  tripSegment: { upsert: jest.fn() }
}));

describe('TripValidator', () => {
  // Тест 8: Валидация с одной точкой
  test('should return valid for trip with single point', async () => {
    // Arrange
    const trip = {
      id: 1,
      user_id: 1,
      start_date: new Date('2025-01-01'),
      end_date: new Date('2025-01-10'),
      points: [{ id: 1, latitude: 55.75, longitude: 37.61 }]
    };
    jest.spyOn(TripValidator, 'validateWholeTrip').mockResolvedValue({
      isValid: true,
      summary: 'Маршрут содержит менее 2 точек'
    });

    // Act
    const result = await TripValidator.validateWholeTrip(1, 1);

    // Assert
    expect(result.isValid).toBe(true);
  });

  // Тест 9: Валидация вычисления расстояния
  test('calculateDistance should return correct value', () => {
    // Arrange & Act
    const distance = TripValidator.calculateDistance(55.75, 37.61, 55.76, 37.62);

    // Assert
    expect(distance).toBeCloseTo(1.57, 1); // примерно 1.57 км
  });
});