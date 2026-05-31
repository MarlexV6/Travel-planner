const { allowRoles } = require('../middleware/roleCheck');

describe('Role Check Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: null };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  // Тест 16: Нет пользователя
  test('should return 401 when user not authenticated', () => {
    const middleware = allowRoles('admin');
    
    middleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  // Тест 17: Роль не разрешена
  test('should return 403 when role not allowed', () => {
    req.user = { role: 'user' };
    const middleware = allowRoles('admin');
    
    middleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
  });

  // Тест 18: Роль разрешена
  test('should call next when role is allowed', () => {
    req.user = { role: 'admin' };
    const middleware = allowRoles('admin');
    
    middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});