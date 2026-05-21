import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../css/Navbar.css';

function Navbar() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">Travel Planner</Link>
        
        <div className="navbar-links">
          {isAuthenticated ? (
            <>
              <Link to="/" className="navbar-link">Главная</Link>
              <Link to="/calendar" className="navbar-link">Календарь</Link>
              <Link to="/stats" className="navbar-link">Статистика</Link>
              
              {isAdmin && (
                <div className="navbar-admin-menu">
                  <span className="navbar-admin-label">Админ-панель</span>
                  <Link to="/admin/users" className="navbar-admin-link">Пользователи</Link>
                </div>
              )}
              
              <div className="navbar-user-menu">
                <span className="navbar-username">{user?.username}</span>
                <button onClick={handleLogout} className="navbar-logout-button">
                  Выйти
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">Вход</Link>
              <Link to="/register" className="navbar-link">Регистрация</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;