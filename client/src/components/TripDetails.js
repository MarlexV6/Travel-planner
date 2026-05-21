import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import TripDayPlanner from './TripDayPlanner';
import '../css/TripDetails.css';

function TripDetails() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('points');
  const [editForm, setEditForm] = useState({
    title: '',
    start_date: '',
    end_date: ''
  });
  const [newPoint, setNewPoint] = useState({
    address: ''
  });
  const [geocoding, setGeocoding] = useState(false);
  const [showDeletePointModal, setShowDeletePointModal] = useState(false);
  const [pointToDelete, setPointToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editWarning, setEditWarning] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteTripModal, setShowDeleteTripModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState(null);

  useEffect(() => {
    fetchTrip();
    fetchPoints();
  }, [id]);

  const fetchTrip = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrip(response.data);
      const startDate = response.data.start_date ? new Date(response.data.start_date).toISOString().split('T')[0] : '';
      const endDate = response.data.end_date ? new Date(response.data.end_date).toISOString().split('T')[0] : '';
      setEditForm({
        title: response.data.title || '',
        start_date: startDate,
        end_date: endDate
      });
    } catch (error) {
      console.error('Error fetching trip:', error);
      setError(error.response?.data?.error || 'Ошибка загрузки поездки');
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}/points`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPoints(response.data);
    } catch (error) {
      console.error('Error fetching points:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
    setEditError(null);
    setEditWarning(null);
  };

  const getTodayString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const updateTrip = async () => {
    setEditError(null);
    setEditWarning(null);
    setIsSaving(true);
    
    const startDate = new Date(editForm.start_date);
    const endDate = new Date(editForm.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!editForm.title.trim()) {
      setEditError('Введите название поездки');
      setIsSaving(false);
      return;
    }
    
    if (startDate < today) {
      setEditError('Дата начала не может быть в прошлом');
      setIsSaving(false);
      return;
    }
    
    if (endDate < startDate) {
      setEditError('Дата окончания не может быть раньше даты начала');
      setIsSaving(false);
      return;
    }
    
    try {
      const response = await axios.put(`/api/trips/${id}`, 
        {
          title: editForm.title,
          start_date: editForm.start_date,
          end_date: editForm.end_date
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.unavailableDates && response.data.unavailableDates.length > 0) {
        setEditWarning({
          message: `Внимание: ${response.data.unavailableDates.length} точек выходят за пределы новых дат`,
          details: response.data.unavailableDates
        });
        setIsSaving(false);
        return;
      }
      
      setSuccess('Поездка успешно обновлена');
      fetchTrip();
      setShowEditModal(false);
      setEditWarning(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error updating trip:', error);
      if (error.response?.data?.error === 'conflict') {
        setEditError(`Конфликт дат: ${error.response.data.message}`);
      } else {
        setEditError(error.response?.data?.error || 'Ошибка обновления поездки');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const addPointByAddress = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setGeocoding(true);
    
    if (!newPoint.address) {
      setError('Введите адрес места');
      setGeocoding(false);
      return;
    }
    
    try {
      const response = await axios.post(`/api/trips/${id}/points`, 
        {
          address: newPoint.address,
          order_index: points.length
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(`Точка добавлена`);
      setNewPoint({ address: '' });
      fetchPoints();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error adding point:', error);
      setError(error.response?.data?.error || 'Ошибка добавления точки. Проверьте адрес.');
    } finally {
      setGeocoding(false);
    }
  };

  const confirmDeletePoint = async () => {
    if (pointToDelete) {
      try {
        await axios.delete(`/api/trips/points/${pointToDelete.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Точка удалена');
        fetchPoints();
        setShowDeletePointModal(false);
        setPointToDelete(null);
        setTimeout(() => setSuccess(null), 2000);
      } catch (error) {
        console.error('Error deleting point:', error);
        setError('Ошибка удаления точки');
      }
    }
  };

  const confirmDeleteTrip = async () => {
    if (tripToDelete) {
      try {
        await axios.delete(`/api/trips/${tripToDelete.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        navigate('/');
      } catch (error) {
        console.error('Error deleting trip:', error);
        setError('Ошибка удаления поездки');
        setShowDeleteTripModal(false);
      }
    }
  };

  const openDeleteTripModal = () => {
    setTripToDelete(trip);
    setShowDeleteTripModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Дата не указана';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Неверная дата';
      return date.toLocaleDateString('ru-RU');
    } catch (e) {
      return 'Ошибка даты';
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  if (!trip) {
    return <div className="error-message">Поездка не найдена</div>;
  }

  return (
    <div className="trip-details-container">
      <div className="trip-details-header">
        <div className="trip-details-title-section">
          <h1>{trip.title || 'Без названия'}</h1>
          <div className="trip-details-actions">
            <button 
              className="btn-edit"
              onClick={() => {
                setEditForm({
                  title: trip.title,
                  start_date: trip.start_date ? new Date(trip.start_date).toISOString().split('T')[0] : '',
                  end_date: trip.end_date ? new Date(trip.end_date).toISOString().split('T')[0] : ''
                });
                setEditError(null);
                setEditWarning(null);
                setShowEditModal(true);
              }}
            >
              Редактировать
            </button>
            <button className="btn-delete" onClick={openDeleteTripModal}>
              Удалить поездку
            </button>
          </div>
        </div>
        <div className="trip-details-info">
          <p className="trip-dates">
            {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
          </p>
          <div className="trip-details-nav">
            <Link to={`/trips/${id}/map`}>
              <button className="btn-map">Посмотреть на карте</button>
            </Link>
            <button onClick={() => navigate('/')} className="btn-back">
              Назад
            </button>
          </div>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="trip-details-tabs">
        <button 
          onClick={() => setActiveTab('points')}
          className={activeTab === 'points' ? 'tab-active' : 'tab-inactive'}
        >
          Точки маршрута
        </button>
        <button 
          onClick={() => setActiveTab('days')}
          className={activeTab === 'days' ? 'tab-active' : 'tab-inactive'}
        >
          Планирование по дням
        </button>
      </div>

      {activeTab === 'points' && (
        <>
          <div className="add-point-section">
            <h2>Добавить новую точку</h2>
            <form onSubmit={addPointByAddress} className="add-point-form">
              <div className="form-group">
                <label>Адрес</label>
                <input
                  type="text"
                  placeholder="Введите адрес: Заславль, Переулок Ленина 3"
                  value={newPoint.address}
                  onChange={(e) => setNewPoint({ address: e.target.value })}
                  required
                  className="form-input"
                />
                <small className="form-hint">
                  Например: "Париж, Эйфелева башня" или "Москва, ул. Тверская, 5"
                </small>
              </div>
              
              <button type="submit" disabled={geocoding} className="btn-add-point">
                {geocoding ? 'Определение координат...' : 'Добавить точку по адресу'}
              </button>
            </form>
          </div>
          
          <div className="points-section">
            <h2>Точки маршрута ({points.length})</h2>
            {points.length === 0 ? (
              <div className="empty-points">
                <p>Нет добавленных точек</p>
                <p>Добавьте первую точку, введя адрес выше!</p>
              </div>
            ) : (
              <div className="points-list">
                {points.map((point, index) => (
                  <div key={point.id} className="point-card">
                    <div className="point-header">
                      <div className="point-number">{index + 1}</div>
                      <div className="point-title">
                        <h3>{point.place_name || 'Без названия'}</h3>
                        <p>{point.address || 'Адрес не указан'}</p>
                      </div>
                      <button 
                        className="point-delete"
                        onClick={() => {
                          setPointToDelete(point);
                          setShowDeletePointModal(true);
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="point-coords">
                      Координаты: {parseFloat(point.latitude).toFixed(6)}, {parseFloat(point.longitude).toFixed(6)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'days' && trip && (
        <TripDayPlanner 
          tripId={id} 
          startDate={trip.start_date} 
          endDate={trip.end_date}
          onPointsUpdate={(updatedPoints) => {
            setPoints(updatedPoints);
          }}
        />
      )}

      {/* Модальное окно редактирования поездки */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => {
          setShowEditModal(false);
          setEditError(null);
          setEditWarning(null);
        }}>
          <div className="modal-content modal-edit" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Редактирование поездки</h2>
              <button 
                className="modal-close-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditError(null);
                  setEditWarning(null);
                }}
              >
                ×
              </button>
            </div>
            
            {editError && (
              <div className="edit-error">
                <strong>Ошибка:</strong> {editError}
              </div>
            )}
            
            {editWarning && (
              <div className="edit-warning">
                <strong>{editWarning.message}</strong>
              </div>
            )}
            
            <div className="edit-form">
              <div className="form-group">
                <label>Название поездки</label>
                <input
                  type="text"
                  name="title"
                  value={editForm.title}
                  onChange={handleEditChange}
                  className="form-input"
                  placeholder="Введите название"
                />
              </div>
              
              <div className="form-group">
                <label>Дата начала</label>
                <input
                  type="date"
                  name="start_date"
                  value={editForm.start_date}
                  onChange={handleEditChange}
                  className="form-input"
                  min={getTodayString()}
                />
              </div>
              
              <div className="form-group">
                <label>Дата окончания</label>
                <input
                  type="date"
                  name="end_date"
                  value={editForm.end_date}
                  onChange={handleEditChange}
                  className="form-input"
                  min={editForm.start_date || getTodayString()}
                />
              </div>
            </div>
            
            <div className="modal-buttons">
              <button 
                onClick={updateTrip} 
                className="modal-button-confirm"
                disabled={isSaving}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
              <button 
                className="modal-button-cancel"
                onClick={() => {
                  setShowEditModal(false);
                  setEditError(null);
                  setEditWarning(null);
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления точки */}
      {showDeletePointModal && pointToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeletePointModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="modal-close-btn" onClick={() => setShowDeletePointModal(false)}>×</button>
            </div>
            <p className="modal-message">Вы уверены, что хотите удалить точку "{pointToDelete.place_name}"?</p>
            <div className="modal-buttons">
              <button onClick={confirmDeletePoint} className="modal-button-danger">
                Удалить
              </button>
              <button onClick={() => setShowDeletePointModal(false)} className="modal-button-cancel">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления поездки */}
      {showDeleteTripModal && tripToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteTripModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="modal-close-btn" onClick={() => setShowDeleteTripModal(false)}>×</button>
            </div>
            <p className="modal-message">Вы уверены, что хотите удалить поездку "{tripToDelete.title}"?</p>
            <p className="modal-warning">Все точки маршрута также будут удалены. Это действие нельзя отменить.</p>
            <div className="modal-buttons">
              <button onClick={confirmDeleteTrip} className="modal-button-danger">
                Удалить
              </button>
              <button onClick={() => setShowDeleteTripModal(false)} className="modal-button-cancel">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TripDetails;