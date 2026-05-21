import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../css/Stats.css';

function Stats() {
  const [personalStats, setPersonalStats] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const { token } = useAuth();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role);
    
    fetchPersonalStats();
    if (user.role === 'admin') {
      fetchAdminStats();
    }
  }, []);

  const fetchPersonalStats = async () => {
    try {
      const response = await axios.get('/api/stats/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPersonalStats(response.data);
    } catch (error) {
      console.error('Error fetching personal stats:', error);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const response = await axios.get('/api/stats/admin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminStats(response.data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  if (!personalStats) return <div className="stats-loading">Загрузка статистики...</div>;

  return (
    <div className="stats-container">
      <h1>Статистика путешествий</h1>
      
      <div className="stats-tab-container">
        <button 
          onClick={() => setActiveTab('personal')}
          className={`stats-tab ${activeTab === 'personal' ? 'stats-tab-active' : ''}`}
        >
          Моя статистика
        </button>
        {userRole === 'admin' && (
          <button 
            onClick={() => setActiveTab('admin')}
            className={`stats-tab ${activeTab === 'admin' ? 'stats-tab-active' : ''}`}
          >
            Админ-панель
          </button>
        )}
      </div>

      {activeTab === 'personal' && (
        <div>
          <div className="stats-grid">
            <div className="stats-card">
              <h3>Всего поездок</h3>
              <p className="stats-number">{personalStats.total_trips}</p>
            </div>
            <div className="stats-card">
              <h3>Всего мест</h3>
              <p className="stats-number">{personalStats.total_points}</p>
            </div>
            <div className="stats-card">
              <h3>В среднем мест на поездку</h3>
              <p className="stats-number">{personalStats.average_points_per_trip}</p>
            </div>
            <div className="stats-card">
              <h3>Предстоящих поездок</h3>
              <p className="stats-number">{personalStats.upcoming_trips || 0}</p>
            </div>
          </div>

          {personalStats.longest_trip && (
            <div className="stats-card stats-card-full">
              <h3>Самая длительная поездка</h3>
              <p><strong>{personalStats.longest_trip.title}</strong> - {personalStats.longest_trip.duration_days} дней</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admin' && adminStats && (
        <div>
          <div className="stats-grid">
            <div className="stats-card">
              <h3>Всего пользователей</h3>
              <p className="stats-number">{adminStats.overview?.total_users || 0}</p>
            </div>
            <div className="stats-card">
              <h3>Всего поездок</h3>
              <p className="stats-number">{adminStats.overview?.total_trips || 0}</p>
            </div>
            <div className="stats-card">
              <h3>Всего точек</h3>
              <p className="stats-number">{adminStats.overview?.total_points || 0}</p>
            </div>
            <div className="stats-card">
              <h3>Поездок на пользователя</h3>
              <p className="stats-number">{adminStats.overview?.average_trips_per_user || 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stats;