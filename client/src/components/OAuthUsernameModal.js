import React, { useState } from 'react';
import axios from 'axios';
import '../css/Modal.css';

function OAuthUsernameModal({ token, user, onComplete }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Введите имя пользователя');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axios.put(`/api/users/${user.id}`, 
        { username: username.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedUser = { ...user, username: username.trim() };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      onComplete(updatedUser);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения имени');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Добро пожаловать!</h2>
        <p>Вы вошли через Google. Пожалуйста, укажите имя пользователя:</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Имя пользователя"
            autoFocus
            className="modal-input"
          />
          {error && <div className="error-message">{error}</div>}
          <div className="modal-buttons">
            <button type="submit" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OAuthUsernameModal;