import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../css/AdminTrips.css';

function AdminTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    fetchAllTrips();
  }, []);

  const fetchAllTrips = async () => {
    try {
      const response = await axios.get('/api/trips', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips(response.data);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (id, title) => {
    if (window.confirm(`Удалить поездку "${title}"?`)) {
      try {
        await axios.delete(`/api/trips/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchAllTrips();
      } catch (error) {
        console.error('Error deleting trip:', error);
        alert('Ошибка удаления поездки');
      }
    }
  };

  const filteredTrips = trips.filter(trip =>
    trip.title.toLowerCase().includes(filter.toLowerCase()) ||
    trip.user?.username?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="at-loading">Загрузка...</div>;

  return (
    <div className="at-container">
      <h1>Все поездки пользователей</h1>
      
      <div className="at-search-bar">
        <input
          type="text"
          placeholder="Поиск по названию или пользователю..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="at-search-input"
        />
        <div className="at-stats">
          Всего поездок: {trips.length}
        </div>
      </div>

      <div className="at-trips-grid">
        {filteredTrips.map(trip => (
          <div key={trip.id} className="at-trip-card">
            <div className="at-trip-header">
              <h3>{trip.title}</h3>
              <button onClick={() => deleteTrip(trip.id, trip.title)} className="at-delete-button">
                Удалить
              </button>
            </div>
            <div className="at-trip-info">
              <p><strong>Пользователь:</strong> {trip.user?.username || 'Неизвестно'}</p>
              <p><strong>Даты:</strong> {new Date(trip.start_date).toLocaleDateString('ru-RU')} - {new Date(trip.end_date).toLocaleDateString('ru-RU')}</p>
              <p><strong>Создана:</strong> {new Date(trip.created_at).toLocaleDateString('ru-RU')}</p>
            </div>
            <div className="at-trip-actions">
              <Link to={`/trips/${trip.id}`}>
                <button className="at-details-button">Подробнее</button>
              </Link>
              <Link to={`/trips/${trip.id}/map`}>
                <button className="at-map-button">Карта</button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredTrips.length === 0 && (
        <div className="at-empty-state">
          <p>Нет поездок, соответствующих поиску</p>
        </div>
      )}
    </div>
  );
}

export default AdminTrips;