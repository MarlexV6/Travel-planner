import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import '../css/TripDayPlanner.css';

function TripDayPlanner({ tripId, startDate, endDate, onPointsUpdate }) {
  const { token } = useAuth();
  const [days, setDays] = useState([]);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [unassignedPoints, setUnassignedPoints] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pointToDelete, setPointToDelete] = useState(null);
  const [newPoint, setNewPoint] = useState({
    address: ''
  });
  const [addingPoint, setAddingPoint] = useState(false);

  const fetchDays = async () => {
    try {
      const response = await axios.get(`/api/trips/${tripId}/days`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDays(response.data);
      if (response.data.length > 0 && !selectedDay) {
        setSelectedDay(response.data[0].id);
      }
      return true;
    } catch (error) {
      console.error('Error fetching days:', error);
      return false;
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await axios.get(`/api/trips/${tripId}/points`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPoints(response.data);
      
      const unassigned = response.data.filter(p => !p.day_id);
      setUnassignedPoints(unassigned);
      
      if (onPointsUpdate) {
        onPointsUpdate(response.data);
      }
      return true;
    } catch (error) {
      console.error('Error fetching points:', error);
      return false;
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await fetchDays();
    await fetchPoints();
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, [tripId]);

  const generateDays = async () => {
    try {
      await axios.post(`/api/trips/${tripId}/days/generate`, 
        { start_date: startDate, end_date: endDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchAllData();
    } catch (error) {
      console.error('Error generating days:', error);
      alert('Ошибка генерации дней');
    }
  };

  const distributePointToDay = async (pointId, dayId) => {
    try {
      await axios.put(`/api/trips/points/${pointId}/assign-day`, 
        { day_id: dayId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchAllData();
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
      await fetchAllData();
    } catch (error) {
      console.error('Error adding point:', error);
      alert('Ошибка добавления точки');
    } finally {
      setAddingPoint(false);
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
        await fetchAllData();
      } catch (error) {
        console.error('Error deleting point:', error);
        alert('Ошибка удаления точки');
      }
    }
  };

  const removePointFromDay = async (pointId) => {
    try {
      await axios.put(`/api/trips/points/${pointId}/unassign`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchAllData();
    } catch (error) {
      console.error('Error removing point from day:', error);
      alert('Ошибка удаления точки из дня');
    }
  };

  if (loading) {
    return <div className="day-planner-loading">Загрузка планировщика...</div>;
  }

  if (days.length === 0) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return (
      <div className="day-planner-empty">
        <h3>Планирование по дням</h3>
        <p>Поездка длится {daysCount} дней</p>
        <button onClick={generateDays} className="btn-generate-days">
          Сгенерировать дни поездки
        </button>
      </div>
    );
  }

  const currentDay = days.find(d => d.id === selectedDay);
  const dayPoints = currentDay?.points || [];
  
  // Получить последнюю точку из предыдущего дня, если текущий день пустой
  let lastPointFromPreviousDay = null;
  if (dayPoints.length === 0 && currentDay) {
    const currentDayIndex = days.findIndex(d => d.id === selectedDay);
    if (currentDayIndex > 0) {
      const previousDay = days[currentDayIndex - 1];
      const previousDayPoints = previousDay?.points || [];
      if (previousDayPoints.length > 0) {
        lastPointFromPreviousDay = previousDayPoints[previousDayPoints.length - 1];
      }
    }
  }

  return (
    <div className="day-planner-container">
      <div className="day-planner-header">
        <h3>Планирование по дням</h3>
        {unassignedPoints.length > 0 && (
          <button 
            onClick={() => setShowDistributeModal(true)} 
            className="btn-distribute"
          >
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
              <>
                {lastPointFromPreviousDay ? (
                  <div>
                    <p className="no-points-info">На этот день не запланировано новых мест</p>
                    <div className="day-point-card last-point-from-previous">
                      <div className="day-point-number" style={{ color: '#999' }}>↑</div>
                      <div className="day-point-details">
                        <strong>{lastPointFromPreviousDay.place_name}</strong>
                        <span className="day-point-address">{lastPointFromPreviousDay.address}</span>
                        <span className="day-point-label">(Последняя точка из предыдущего дня)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="no-points">Нет запланированных мест</p>
                )}
              </>
            ) : (
              dayPoints.map((point, idx) => (
                <div key={point.id} className="day-point-card">
                  <div className="day-point-number">{idx + 1}</div>
                  <div className="day-point-details">
                    <strong>{point.place_name}</strong>
                    <span className="day-point-address">{point.address}</span>
                  </div>
                  <div className="day-point-actions">
                    <button 
                      onClick={() => removePointFromDay(point.id)}
                      className="day-point-remove"
                      title="Убрать из дня"
                    >
                      Убрать
                    </button>
                    <button 
                      onClick={() => {
                        setPointToDelete(point);
                        setShowDeleteModal(true);
                      }}
                      className="day-point-delete"
                      title="Удалить точку"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addPointToDay} className="add-day-point-form">
            <h5>Добавить новое место</h5>
            <div className="form-row">
              <input
                type="text"
                placeholder="Введите адрес *"
                value={newPoint.address}
                onChange={(e) => setNewPoint({ address: e.target.value })}
                required
                className="form-input"
              />
            </div>
            <button type="submit" disabled={addingPoint} className="btn-add-day-point">
              {addingPoint ? 'Добавление...' : 'Добавить место'}
            </button>
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
                  if (e.target.value) {
                    distributePointToDay(point.id, parseInt(e.target.value));
                  }
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