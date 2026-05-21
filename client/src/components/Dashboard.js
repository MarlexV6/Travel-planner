import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import '../css/Dashboard.css';

function Dashboard() {
  const [myTrips, setMyTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [newTrip, setNewTrip] = useState({ title: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const { user, token, isAdmin } = useAuth();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState(null);

  const fetchMyTrips = useCallback(async () => {
    try {
      const response = await axios.get('/api/trips/my-only', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyTrips(response.data);
    } catch (error) {
      console.error('Error fetching my trips:', error);
    }
  }, [token]);

  const fetchAllTrips = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await axios.get('/api/trips', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTrips(response.data);
    } catch (error) {
      console.error('Error fetching all trips:', error);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchMyTrips();
      if (isAdmin) {
        await fetchAllTrips();
      }
      setLoading(false);
    };
    loadData();
  }, [fetchMyTrips, fetchAllTrips, isAdmin]);

  const createTrip = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!newTrip.title.trim()) {
      setError('Введите название поездки');
      return;
    }
    
    if (!newTrip.start_date) {
      setError('Выберите дату начала');
      return;
    }
    
    if (!newTrip.end_date) {
      setError('Выберите дату окончания');
      return;
    }
    
    const startDate = new Date(newTrip.start_date);
    const endDate = new Date(newTrip.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      setError('Дата начала не может быть в прошлом');
      return;
    }
    
    if (endDate < startDate) {
      setError('Дата окончания не может быть раньше даты начала');
      return;
    }
    
    try {
      await axios.post('/api/trips', newTrip, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Поездка успешно создана');
      setNewTrip({ title: '', start_date: '', end_date: '' });
      await fetchMyTrips();
      if (isAdmin) {
        await fetchAllTrips();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error creating trip:', error);
    if (error.response?.status === 409 && error.response?.data?.error === 'conflict') {
      const conflict = error.response.data.conflictingTrip;
      setError(
        `Невозможно создать поездку: даты пересекаются с существующей поездкой "${conflict.title}"\n` +
        `${new Date(conflict.start_date).toLocaleDateString('ru-RU')} - ${new Date(conflict.end_date).toLocaleDateString('ru-RU')}`
      );
    } else {
      setError(error.response?.data?.error || 'Ошибка создания поездки');
    }
  }
}

  const confirmDeleteTrip = async () => {
    if (tripToDelete) {
      try {
        await axios.delete(`/api/trips/${tripToDelete.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Поездка удалена');
        await fetchMyTrips();
        if (isAdmin) {
          await fetchAllTrips();
        }
        setShowDeleteModal(false);
        setTripToDelete(null);
        setTimeout(() => setSuccess(null), 3000);
      } catch (error) {
        console.error('Error deleting trip:', error);
        setError('Ошибка удаления поездки');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTrip(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const displayedTrips = showAllTrips && isAdmin ? allTrips : myTrips;

  const getTodayString = () => {
    return new Date().toISOString().split('T')[0];
  };

  if (loading) return <div className="dash-loading">Загрузка...</div>;

  return (
    <div className="dash-container">
      <div className="dash-header">
        <h1>Добро пожаловать, {user?.username}</h1>
        {isAdmin && (
          <div className="dash-admin-toggle">
            <button onClick={() => setShowAllTrips(false)} className={!showAllTrips ? 'dash-toggle-active' : 'dash-toggle'}>
              Мои поездки ({myTrips.length})
            </button>
            <button onClick={() => setShowAllTrips(true)} className={showAllTrips ? 'dash-toggle-active' : 'dash-toggle'}>
              Все поездки ({allTrips.length})
            </button>
          </div>
        )}
      </div>
      
      {error && <div className="dash-error">{error}</div>}
      {success && <div className="dash-success">{success}</div>}
      
      <div className="dash-two-column-layout">
        <div className="dash-form-column">
          <h2>Создать новую поездку</h2>
          <form onSubmit={createTrip}>
            <div className="dash-form-group">
              <label>Название поездки</label>
              <input
                type="text"
                name="title"
                placeholder="Например: Отпуск в Сочи"
                value={newTrip.title}
                onChange={handleInputChange}
                required
                className="dash-input"
              />
            </div>
            
            <div className="dash-form-group">
              <label>Дата начала</label>
              <input
                type="date"
                name="start_date"
                value={newTrip.start_date}
                onChange={handleInputChange}
                required
                className="dash-input"
                min={getTodayString()}
              />
            </div>
            
            <div className="dash-form-group">
              <label>Дата окончания</label>
              <input
                type="date"
                name="end_date"
                value={newTrip.end_date}
                onChange={handleInputChange}
                required
                className="dash-input"
                min={newTrip.start_date || getTodayString()}
              />
            </div>
            
            <button type="submit" className="dash-submit-button">
              Создать поездку
            </button>
          </form>
        </div>
        
        <div className="dash-trips-column">
          <h2>{showAllTrips && isAdmin ? 'Все поездки' : 'Мои поездки'} ({displayedTrips.length})</h2>
          {displayedTrips.length === 0 ? (
            <div className="dash-empty-state">
              <p>Нет поездок</p>
              <p>Создайте первую поездку, заполнив форму слева</p>
            </div>
          ) : (
            <div className="dash-trips-list">
              {displayedTrips.map(trip => (
                <div key={trip.id} className="dash-trip-card">
                  <div className="dash-trip-info">
                    <h3 className="dash-trip-title">{trip.title}</h3>
                    {showAllTrips && isAdmin && trip.user && (
                      <p className="dash-trip-user">Пользователь: {trip.user?.username}</p>
                    )}
                    <p className="dash-trip-date">
                      {new Date(trip.start_date).toLocaleDateString('ru-RU')} - {new Date(trip.end_date).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="dash-button-group">
                    <Link to={`/trips/${trip.id}`}>
                      <button className="dash-details-button">Подробнее</button>
                    </Link>
                    <Link to={`/trips/${trip.id}/map`}>
                      <button className="dash-map-button">Карта</button>
                    </Link>
                    <button 
                      onClick={() => {
                        setTripToDelete(trip);
                        setShowDeleteModal(true);
                      }} 
                      className="dash-delete-button"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteTrip}
        title="Подтверждение удаления"
        message={`Вы уверены, что хотите удалить поездку "${tripToDelete?.title}"?`}
        type="danger"
        confirmText="Удалить"
        cancelText="Отмена"
      />
    </div>
  );
}

export default Dashboard;