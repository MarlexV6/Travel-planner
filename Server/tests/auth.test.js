const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  // Тест 10: Отсутствие токена
  test('should return 401 when no token provided', () => {
    // Act
    authenticateToken(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied. No token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  // Тест 11: Неверный формат токена
  test('should return 401 when token format is invalid', () => {
    // Arrange
    req.headers.authorization = 'InvalidFormat';

    // Act
    authenticateToken(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // Тест 12: Просроченный токен
  test('should return 403 when token is expired', () => {
    // Arrange
    req.headers.authorization = 'Bearer expired_token';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(new Error('jwt expired'), null);
    });

    // Act
    authenticateToken(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  // Тест 13: Валидный токен
  test('should call next when token is valid', () => {
    // Arrange
    req.headers.authorization = 'Bearer valid_token';
    const mockUser = { id: 1, username: 'test', role: 'user' };
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, mockUser);
    });

    // Act
    authenticateToken(req, res, next);

    // Assert
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });
});