import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import TripDayPlanner from './TripDayPlanner';
import CityPlacesPicker from './CityPlacesPicker';
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
  const [editForm, setEditForm] = useState({ title: '', start_date: '', end_date: '' });
  const [newPoint, setNewPoint] = useState({ address: '', day_id: '' });
  const [geocoding, setGeocoding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState(null);
  const [showDeletePointModal, setShowDeletePointModal] = useState(false);
  const [pointToDelete, setPointToDelete] = useState(null);
  const [showDeleteTripModal, setShowDeleteTripModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState(null);
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState('');

  useEffect(() => {
    fetchTrip();
    fetchPoints();
    fetchDays();
  }, [id]);

  const fetchTrip = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrip(response.data);
      setEditForm({
        title: response.data.title,
        start_date: response.data.start_date?.split('T')[0] || '',
        end_date: response.data.end_date?.split('T')[0] || ''
      });
    } catch (error) {
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

  const fetchDays = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}/days`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDays(response.data);
      if (response.data.length > 0 && !selectedDayId) {
        setSelectedDayId(response.data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching days:', error);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
    setEditError(null);
  };

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const updateTrip = async () => {
    setEditError(null);
    const startDate = new Date(editForm.start_date);
    const endDate = new Date(editForm.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!editForm.title.trim()) return setEditError('Введите название');
    if (startDate < today) return setEditError('Дата начала не может быть в прошлом');
    if (endDate < startDate) return setEditError('Дата окончания не может быть раньше даты начала');
    
    try {
      await axios.put(`/api/trips/${id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Поездка обновлена');
      fetchTrip();
      setShowEditModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      if (error.response?.data?.error === 'conflict') {
        setEditError(`Конфликт дат: ${error.response.data.message}`);
      } else {
        setEditError(error.response?.data?.error || 'Ошибка обновления');
      }
    }
  };

  const addPointByAddress = async (e) => {
    e.preventDefault();
    if (!newPoint.address.trim()) return setError('Введите адрес');
    if (!newPoint.day_id) return setError('Выберите день');
    
    setGeocoding(true);
    try {
      await axios.post(`/api/trips/${id}/points`, {
        address: newPoint.address,
        day_id: parseInt(newPoint.day_id)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Точка добавлена');
      setNewPoint({ address: '', day_id: selectedDayId });
      fetchPoints();
      fetchDays();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка добавления точки');
    } finally {
      setGeocoding(false);
    }
  };

  const confirmDeletePoint = async () => {
    if (!pointToDelete) return;
    try {
      await axios.delete(`/api/trips/points/${pointToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Точка удалена');
      fetchPoints();
      fetchDays();
      setShowDeletePointModal(false);
      setPointToDelete(null);
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      setError('Ошибка удаления точки');
    }
  };

  const confirmDeleteTrip = async () => {
    if (!tripToDelete) return;
    try {
      await axios.delete(`/api/trips/${tripToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/');
    } catch (error) {
      setError('Ошибка удаления поездки');
      setShowDeleteTripModal(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Дата не указана';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Неверная дата' : date.toLocaleDateString('ru-RU');
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!trip) return <div className="error-message">Поездка не найдена</div>;

  return (
    <div className="trip-details-container">
      <div className="trip-details-header">
        <div className="trip-details-title-section">
          <h1>{trip.title}</h1>
          <div className="trip-details-actions">
            <button className="btn-edit" onClick={() => setShowEditModal(true)}>Редактировать</button>
            <Link to={`/trips/${id}/map`}>
              <button className="btn-map">Карта</button>
            </Link>
            <button className="btn-delete" onClick={() => { setTripToDelete(trip); setShowDeleteTripModal(true); }}>Удалить поездку</button>
          </div>
        </div>
        <div className="trip-details-info">
          <p className="trip-dates">{formatDate(trip.start_date)} - {formatDate(trip.end_date)}</p>
          <button onClick={() => navigate('/')} className="btn-back">Назад</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Блок добавления точки по адресу */}
      <div className="add-point-section">
        <h3>Добавить новую точку по адресу</h3>
        <form onSubmit={addPointByAddress} className="add-point-form">
          <div className="form-row">
            <input
              type="text"
              placeholder="Введите адрес (например, Эйфелева башня, Париж)"
              value={newPoint.address}
              onChange={(e) => setNewPoint({ ...newPoint, address: e.target.value })}
              required
              className="form-input"
            />
            <select
              value={newPoint.day_id}
              onChange={(e) => setNewPoint({ ...newPoint, day_id: e.target.value })}
              className="form-select"
              required
            >
              <option value="">Выберите день</option>
              {days.map(day => (
                <option key={day.id} value={day.id}>
                  День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})
                </option>
              ))}
            </select>
            <button type="submit" disabled={geocoding} className="btn-add-point">
              {geocoding ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>

      {/* Рекомендации достопримечательностей */}
      <CityPlacesPicker tripId={id} onPointsAdded={() => { fetchPoints(); fetchDays(); }} />

      {/* Планировщик по дням */}
      <TripDayPlanner
        tripId={id}
        startDate={trip.start_date}
        endDate={trip.end_date}
        onPointsUpdate={() => { fetchPoints(); fetchDays(); }}
      />

      {/* Модальное окно редактирования */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Редактирование поездки</h2>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            {editError && <div className="edit-error">{editError}</div>}
            <div className="edit-form">
              <div className="form-group">
                <label>Название</label>
                <input type="text" name="title" value={editForm.title} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label>Дата начала</label>
                <input type="date" name="start_date" value={editForm.start_date} onChange={handleEditChange} className="form-input" min={getTodayString()} />
              </div>
              <div className="form-group">
                <label>Дата окончания</label>
                <input type="date" name="end_date" value={editForm.end_date} onChange={handleEditChange} className="form-input" min={editForm.start_date || getTodayString()} />
              </div>
            </div>
            <div className="modal-buttons">
              <button onClick={updateTrip} className="modal-button-confirm">Сохранить</button>
              <button onClick={() => setShowEditModal(false)} className="modal-button-cancel">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка удаления точки */}
      {showDeletePointModal && pointToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeletePointModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="modal-close-btn" onClick={() => setShowDeletePointModal(false)}>×</button>
            </div>
            <p>Вы уверены, что хотите удалить точку "{pointToDelete.place_name}"?</p>
            <div className="modal-buttons">
              <button onClick={confirmDeletePoint} className="modal-button-danger">Удалить</button>
              <button onClick={() => setShowDeletePointModal(false)} className="modal-button-cancel">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка удаления поездки */}
      {showDeleteTripModal && tripToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteTripModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="modal-close-btn" onClick={() => setShowDeleteTripModal(false)}>×</button>
            </div>
            <p>Вы уверены, что хотите удалить поездку "{tripToDelete.title}"?</p>
            <p className="modal-warning">Все точки маршрута также будут удалены. Действие необратимо.</p>
            <div className="modal-buttons">
              <button onClick={confirmDeleteTrip} className="modal-button-danger">Удалить</button>
              <button onClick={() => setShowDeleteTripModal(false)} className="modal-button-cancel">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TripDetails;