import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../css/AdminUsers.css';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUserTripsModal, setShowUserTripsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTrips, setUserTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [addingUser, setAddingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const { token, user: currentUser, logout } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      showMessage('error', 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTrips = async (userId) => {
    setLoadingTrips(true);
    try {
      const response = await axios.get(`/api/trips`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userSpecificTrips = response.data.filter(trip => trip.user_id === userId);
      setUserTrips(userSpecificTrips);
    } catch (error) {
      console.error('Error fetching user trips:', error);
      showMessage('error', 'Ошибка загрузки поездок пользователя');
    } finally {
      setLoadingTrips(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const updateUserRole = async (userId, role) => {
    setUpdatingUser(true);
    try {
      await axios.put(`/api/users/${userId}`, 
        { role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showMessage('success', `Роль пользователя изменена на "${role === 'admin' ? 'Администратор' : 'Пользователь'}"`);
      
      if (userId === currentUser?.id) {
        showMessage('warning', 'Ваша роль изменена. Пожалуйста, войдите снова.');
        setTimeout(() => {
          logout();
          window.location.href = '/login';
        }, 2000);
      } else {
        fetchUsers();
      }
      
      setEditingUser(null);
      setEditingField(null);
    } catch (error) {
      console.error('Error updating user:', error);
      showMessage('error', error.response?.data?.error || 'Ошибка обновления роли');
    } finally {
      setUpdatingUser(false);
    }
  };

  const updateUserField = async (userId, field, value) => {
    if (!value.trim()) {
      showMessage('error', 'Поле не может быть пустым');
      setEditingUser(null);
      setEditingField(null);
      return;
    }
    
    setUpdatingUser(true);
    try {
      const updateData = {};
      updateData[field] = value.trim();
      
      await axios.put(`/api/users/${userId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const fieldNames = {
        username: 'Имя пользователя',
        email: 'Email'
      };
      
      showMessage('success', `${fieldNames[field]} успешно обновлено`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user field:', error);
      showMessage('error', error.response?.data?.error || `Ошибка обновления ${field}`);
    } finally {
      setUpdatingUser(false);
      setEditingUser(null);
      setEditingField(null);
      setEditValue('');
    }
  };

  const startEditing = (user, field, value) => {
    setEditingUser(user.id);
    setEditingField(field);
    setEditValue(value);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditingField(null);
    setEditValue('');
  };

  const deleteUser = async (userId, username) => {
    if (window.confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) {
      try {
        await axios.delete(`/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        showMessage('success', `Пользователь "${username}" удален`);
        
        if (userId === currentUser?.id) {
          showMessage('warning', 'Ваш аккаунт удален. Перенаправление...');
          setTimeout(() => {
            logout();
            window.location.href = '/login';
          }, 2000);
        } else {
          fetchUsers();
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('error', 'Ошибка удаления пользователя');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.username.trim()) {
      showMessage('error', 'Введите имя пользователя');
      return;
    }
    
    if (!newUser.email.trim()) {
      showMessage('error', 'Введите email');
      return;
    }
    
    if (!newUser.password.trim()) {
      showMessage('error', 'Введите пароль');
      return;
    }
    
    if (newUser.password.length < 6) {
      showMessage('error', 'Пароль должен содержать минимум 6 символов');
      return;
    }
    
    setAddingUser(true);
    
    try {
      await axios.post('/api/auth/register', {
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showMessage('success', `Пользователь "${newUser.username}" успешно создан`);
      setShowAddModal(false);
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      const errorMsg = error.response?.data?.error || 'Ошибка создания пользователя';
      showMessage('error', errorMsg);
    } finally {
      setAddingUser(false);
    }
  };

  

  const viewUserTrips = async (user) => {
    setSelectedUser(user);
    await fetchUserTrips(user.id);
    setShowUserTripsModal(true);
  };

  const getRoleBadgeClass = (role) => {
    return role === 'admin' ? 'au-role-badge-admin' : 'au-role-badge-user';
  };

  const getRoleBadgeText = (role) => {
    return role === 'admin' ? 'Администратор' : 'Пользователь';
  };

  if (loading) return <div className="au-loading">Загрузка...</div>;

  return (
    <div className="au-container">
      <div className="au-header">
        <h1>Управление пользователями</h1>
        <div className="au-header-buttons">
          <button onClick={() => setShowAddModal(true)} className="au-add-button">
            Добавить пользователя
          </button>

        </div>
      </div>

      {message.text && (
        <div className={`au-message au-message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="au-stats-bar">
        <div><strong>Всего пользователей:</strong> {users.length}</div>
        <div><strong>Администраторов:</strong> {users.filter(u => u.role === 'admin').length}</div>
        <div><strong>Пользователей:</strong> {users.filter(u => u.role === 'user').length}</div>
        <div><strong>Всего поездок:</strong> {users.reduce((sum, u) => sum + (u.total_trips || 0), 0)}</div>
      </div>

      <div className="au-table-wrapper">
        <table className="au-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя пользователя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Дата регистрации</th>
              <th>Поездок</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={user.id === currentUser?.id ? 'au-row-current' : ''}>
                <td>{user.id}{user.id === currentUser?.id && ' (Вы)'}</td>
                
                {/* Имя пользователя - с возможностью редактирования */}
                <td>
                  {editingUser === user.id && editingField === 'username' ? (
                    <div className="au-inline-edit">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="au-inline-input"
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            updateUserField(user.id, 'username', editValue);
                          }
                        }}
                      />
                      <button 
                        onClick={() => updateUserField(user.id, 'username', editValue)}
                        className="au-inline-save"
                        disabled={updatingUser}
                      >
                        ✓
                      </button>
                      <button 
                        onClick={cancelEditing}
                        className="au-inline-cancel"
                        disabled={updatingUser}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="au-editable-field">
                      <strong>{user.username}</strong>
                      {user.id !== currentUser?.id && (
                        <button 
                          onClick={() => startEditing(user, 'username', user.username)}
                          className="au-edit-icon"
                          title="Редактировать имя"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}
                </td>
                
                {/* Email - с возможностью редактирования */}
                <td>
                  {editingUser === user.id && editingField === 'email' ? (
                    <div className="au-inline-edit">
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="au-inline-input"
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            updateUserField(user.id, 'email', editValue);
                          }
                        }}
                      />
                      <button 
                        onClick={() => updateUserField(user.id, 'email', editValue)}
                        className="au-inline-save"
                        disabled={updatingUser}
                      >
                        ✓
                      </button>
                      <button 
                        onClick={cancelEditing}
                        className="au-inline-cancel"
                        disabled={updatingUser}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="au-editable-field">
                      {user.email}
                      {user.id !== currentUser?.id && (
                        <button 
                          onClick={() => startEditing(user, 'email', user.email)}
                          className="au-edit-icon"
                          title="Редактировать email"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}
                </td>
                
                {/* Роль */}
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    className="au-role-select"
                    disabled={user.id === 1 || updatingUser}
                  >
                    <option value="user">Пользователь</option>
                    <option value="admin">Администратор</option>
                  </select>
                </td>
                
                <td>{new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                <td>
                  <button 
                    onClick={() => viewUserTrips(user)}
                    className="au-trips-count-button"
                    title="Посмотреть поездки"
                  >
                    {user.total_trips || 0}
                  </button>
                </td>
                <td>
                  <div className="au-action-buttons">
                    <button 
                      onClick={() => deleteUser(user.id, user.username)} 
                      className="au-delete-button" 
                      disabled={user.id === 1 || user.id === currentUser?.id || updatingUser}
                      title={user.id === currentUser?.id ? "Нельзя удалить себя" : "Удалить пользователя"}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модальное окно добавления пользователя */}
      {showAddModal && (
        <div className="au-modal-overlay" onClick={() => {
          if (!addingUser) setShowAddModal(false);
        }}>
          <div className="au-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="au-modal-header">
              <h2>Добавить нового пользователя</h2>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="au-modal-close"
                disabled={addingUser}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={addUser}>
              <div className="au-form-group">
                <label>Имя пользователя *</label>
                <input
                  type="text"
                  name="username"
                  value={newUser.username}
                  onChange={handleInputChange}
                  placeholder="Введите имя пользователя"
                  required
                  className="au-form-input"
                  disabled={addingUser}
                />
              </div>
              
              <div className="au-form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={newUser.email}
                  onChange={handleInputChange}
                  placeholder="user@example.com"
                  required
                  className="au-form-input"
                  disabled={addingUser}
                />
              </div>
              
              <div className="au-form-group">
                <label>Пароль *</label>
                <input
                  type="password"
                  name="password"
                  value={newUser.password}
                  onChange={handleInputChange}
                  placeholder="Минимум 6 символов"
                  required
                  className="au-form-input"
                  disabled={addingUser}
                />
              </div>
              
              <div className="au-form-group">
                <label>Роль</label>
                <select
                  name="role"
                  value={newUser.role}
                  onChange={handleInputChange}
                  className="au-form-select"
                  disabled={addingUser}
                >
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              
              <div className="au-modal-buttons">
                <button 
                  type="submit" 
                  className="au-modal-submit"
                  disabled={addingUser}
                >
                  {addingUser ? 'Создание...' : 'Создать пользователя'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="au-modal-cancel"
                  disabled={addingUser}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно с поездками пользователя */}
      {showUserTripsModal && selectedUser && (
        <div className="au-modal-overlay" onClick={() => setShowUserTripsModal(false)}>
          <div className="au-modal-content au-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="au-modal-header">
              <h2>Поездки пользователя: {selectedUser.username}</h2>
              <button onClick={() => setShowUserTripsModal(false)} className="au-modal-close">✕</button>
            </div>
            <div className="au-modal-body">
              {loadingTrips ? (
                <div className="au-loading-trips">Загрузка поездок...</div>
              ) : userTrips.length === 0 ? (
                <div className="au-no-trips">У пользователя нет поездок</div>
              ) : (
                <div className="au-user-trips-list">
                  <div className="au-user-trips-grid">
                    {userTrips.map(trip => (
                      <div key={trip.id} className="au-user-trip-card">
                        <div className="au-trip-header">
                          <h4>{trip.title}</h4>
                          <a href={`/trips/${trip.id}`} target="_blank" rel="noopener noreferrer" className="au-trip-link">
                            Открыть →
                          </a>
                        </div>
                        <div className="au-trip-dates">
                          {new Date(trip.start_date).toLocaleDateString('ru-RU')} - {new Date(trip.end_date).toLocaleDateString('ru-RU')}
                        </div>
                        <div className="au-trip-meta">
                          <span>Создана: {new Date(trip.created_at).toLocaleDateString('ru-RU')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="au-modal-footer">
              <button onClick={() => setShowUserTripsModal(false)} className="au-modal-close-button">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;