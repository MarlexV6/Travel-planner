import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../css/Modal.css';

function PlaceDetailModal({ isOpen, onClose, place, tripId, onPointAdded }) {
  const { token } = useAuth();
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen && tripId) {
      fetchDays();
    }
  }, [isOpen, tripId]);

  const fetchDays = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/trips/${tripId}/days`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDays(response.data);
      if (response.data.length > 0) {
        setSelectedDayId(response.data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching days:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPoint = async () => {
    if (!selectedDayId) {
      alert('Выберите день поездки');
      return;
    }
    setAdding(true);
    try {
      await axios.post(`/api/trips/${tripId}/points`,
        {
          place_name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          day_id: parseInt(selectedDayId)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onPointAdded) onPointAdded();
      onClose();
    } catch (error) {
      console.error('Error adding point:', error);
      alert('Ошибка добавления точки');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen || !place) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{place.name}</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="place-detail-content">
          {place.image && (
            <div className="place-detail-image">
              <img src={place.image} alt={place.name} />
            </div>
          )}
          <div className="place-detail-info">
            <p><strong>Категория:</strong> {place.category}</p>
            <p><strong>Адрес:</strong> {place.address}</p>
            <p><strong>Описание:</strong> {place.description}</p>
            <div className="place-date-selector">
              <label>Выберите день поездки:</label>
              {loading ? (
                <p>Загрузка дней...</p>
              ) : (
                <select
                  value={selectedDayId}
                  onChange={(e) => setSelectedDayId(e.target.value)}
                  className="modal-input"
                >
                  {days.map(day => (
                    <option key={day.id} value={day.id}>
                      День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
        <div className="modal-buttons">
          <button onClick={handleAddPoint} disabled={adding} className="modal-button-confirm">
            {adding ? 'Добавление...' : 'Добавить в маршрут'}
          </button>
          <button onClick={onClose} className="modal-button-cancel">Отмена</button>
        </div>
      </div>
    </div>
  );
}

export default PlaceDetailModal;