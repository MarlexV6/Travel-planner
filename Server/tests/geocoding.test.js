const { geocodeAddress, reverseGeocode } = require('../services/geocoding');
const axios = require('axios');

// Создаем заглушки для axios
jest.mock('axios');

describe('Geocoding Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Тест 1: Успешное геокодирование адреса
  test('should return coordinates for valid address', async () => {
    // Arrange
    const mockResponse = {
      data: [{
        lat: '55.751244',
        lon: '37.618423',
        display_name: 'Москва, Россия',
        address: {
          city: 'Москва',
          country: 'Россия'
        }
      }]
    };
    axios.get.mockResolvedValue(mockResponse);

    // Act
    const result = await geocodeAddress('Москва');

    // Assert
    expect(result).not.toBeNull();
    expect(result.latitude).toBe(55.751244);
    expect(result.longitude).toBe(37.618423);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  // Тест 2: Невалидный адрес
  test('should return null for invalid address', async () => {
    // Arrange
    axios.get.mockResolvedValue({ data: [] });

    // Act
    const result = await geocodeAddress('несуществующий адрес 123456789');

    // Assert
    expect(result).toBeNull();
  });

  // Тест 3: Ошибка сети при геокодировании
  test('should handle network error', async () => {
    // Arrange
    axios.get.mockRejectedValue(new Error('Network Error'));

    // Act
    const result = await geocodeAddress('Москва');

    // Assert
    expect(result).toBeNull();
  });
});