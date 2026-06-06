import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import '../css/TripDayPlanner.css';

function TripDayPlanner({ tripId, startDate, endDate, onPointsUpdate }) {
  const { token } = useAuth();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [unassignedPoints, setUnassignedPoints] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pointToDelete, setPointToDelete] = useState(null);
  const [newPoint, setNewPoint] = useState({ address: '' });
  const [addingPoint, setAddingPoint] = useState(false);

  useEffect(() => {
    initDaysAndPoints();
  }, [tripId, startDate, endDate]);

  const initDaysAndPoints = async () => {
    setLoading(true);
    await fetchDays();
    await fetchPoints();
    setLoading(false);
  };

  const fetchDays = async () => {
    try {
      const response = await axios.get(`/api/trips/${tripId}/days`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let daysData = response.data;
      if (daysData.length === 0 && startDate && endDate) {
        // Автоматическая генерация дней
        await generateDays();
        const newResponse = await axios.get(`/api/trips/${tripId}/days`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        daysData = newResponse.data;
      }
      setDays(daysData);
      if (daysData.length > 0 && !selectedDay) {
        setSelectedDay(daysData[0].id);
      }
    } catch (error) {
      console.error('Error fetching days:', error);
    }
  };

  const generateDays = async () => {
    try {
      await axios.post(`/api/trips/${tripId}/days/generate`, 
        { start_date: startDate, end_date: endDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error generating days:', error);
      alert('Ошибка генерации дней');
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await axios.get(`/api/trips/${tripId}/points`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allPoints = response.data;
      const unassigned = allPoints.filter(p => !p.day_id);
      setUnassignedPoints(unassigned);
      if (onPointsUpdate) onPointsUpdate(allPoints);
    } catch (error) {
      console.error('Error fetching points:', error);
    }
  };

  const distributePointToDay = async (pointId, dayId) => {
    try {
      await axios.put(`/api/trips/points/${pointId}/assign-day`, 
        { day_id: dayId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchDays();
      await fetchPoints();
      setShowDistributeModal(false);
    } catch (error) {
      console.error('Error distributing point:', error);
      alert('Ошибка распределения точки');
    }
  };

  const addPointToDay = async (e) => {
    e.preventDefault();
    if (!newPoint.address.trim()) {
      alert('Введите адрес места');
      return;
    }
    setAddingPoint(true);
    try {
      await axios.post(`/api/trips/${tripId}/days/${selectedDay}/points`, 
        { address: newPoint.address },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewPoint({ address: '' });
      await fetchDays();
      await fetchPoints();
    } catch (error) {
      console.error('Error adding point:', error);
      alert('Ошибка добавления точки');
    } finally {
      setAddingPoint(false);
    }
  };

  const removePointFromDay = async (pointId) => {
    try {
      await axios.put(`/api/trips/points/${pointId}/unassign`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchDays();
      await fetchPoints();
    } catch (error) {
      console.error('Error removing point from day:', error);
      alert('Ошибка удаления точки из дня');
    }
  };

  const deletePoint = async () => {
    if (pointToDelete) {
      try {
        await axios.delete(`/api/trips/points/${pointToDelete.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setShowDeleteModal(false);
        setPointToDelete(null);
        await fetchDays();
        await fetchPoints();
      } catch (error) {
        console.error('Error deleting point:', error);
        alert('Ошибка удаления точки');
      }
    }
  };

  if (loading) return <div className="day-planner-loading">Загрузка планировщика...</div>;
  if (days.length === 0) return <div className="day-planner-empty">Нет сгенерированных дней</div>;

  const currentDay = days.find(d => d.id === selectedDay);
  const dayPoints = currentDay?.points || [];

  return (
    <div className="day-planner-container">
      <div className="day-planner-header">
        <h3>Планирование по дням</h3>
        {unassignedPoints.length > 0 && (
          <button onClick={() => setShowDistributeModal(true)} className="btn-distribute">
            Распределить точки ({unassignedPoints.length})
          </button>
        )}
      </div>

      <div className="day-navigation">
        {days.map(day => (
          <button
            key={day.id}
            onClick={() => setSelectedDay(day.id)}
            className={`day-button ${selectedDay === day.id ? 'day-button-active' : ''}`}
          >
            День {day.day_number}
            <br />
            <small>{new Date(day.date).toLocaleDateString('ru-RU')}</small>
          </button>
        ))}
      </div>

      {selectedDay && currentDay && (
        <div className="day-content">
          <h4>{currentDay.title || `День ${currentDay.day_number}`}</h4>
          <div className="day-points-list">
            {dayPoints.length === 0 ? (
              <p className="no-points">Нет запланированных мест</p>
            ) : (
              dayPoints.map((point, idx) => (
                <div key={point.id} className="day-point-card">
                  <div className="day-point-number">{idx + 1}</div>
                  <div className="day-point-details">
                    <strong>{point.place_name}</strong>
                    <span className="day-point-address">{point.address}</span>
                  </div>
                  <div className="day-point-actions">
                    <button onClick={() => removePointFromDay(point.id)} className="day-point-remove" title="Убрать из дня">Убрать</button>
                    <button onClick={() => { setPointToDelete(point); setShowDeleteModal(true); }} className="day-point-delete" title="Удалить точку">Удалить</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addPointToDay} className="add-day-point-form">
            <h5>Добавить новое место в этот день</h5>
            <div className="form-row">
              <input
                type="text"
                placeholder="Введите адрес"
                value={newPoint.address}
                onChange={(e) => setNewPoint({ address: e.target.value })}
                required
                className="form-input"
              />
              <button type="submit" disabled={addingPoint} className="btn-add-day-point">
                {addingPoint ? 'Добавление...' : 'Добавить место'}
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal
        isOpen={showDistributeModal}
        onClose={() => setShowDistributeModal(false)}
        title="Распределение точек маршрута"
        type="distribute"
        confirmText="Закрыть"
      >
        <div className="distribute-list">
          <p>Выберите день для каждой точки:</p>
          {unassignedPoints.map(point => (
            <div key={point.id} className="distribute-item">
              <div className="distribute-point-info">
                <strong>{point.place_name}</strong>
                <span className="distribute-point-address">{point.address}</span>
              </div>
              <select
                onChange={(e) => {
                  if (e.target.value) distributePointToDay(point.id, parseInt(e.target.value));
                }}
                className="distribute-select"
                defaultValue=""
              >
                <option value="" disabled>Выбрать день</option>
                {days.map(day => (
                  <option key={day.id} value={day.id}>
                    День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={deletePoint}
        title="Подтверждение удаления"
        message={`Вы уверены, что хотите удалить точку "${pointToDelete?.place_name}"?`}
        type="danger"
        confirmText="Удалить"
        cancelText="Отмена"
      />
    </div>
  );
}

export default TripDayPlanner;