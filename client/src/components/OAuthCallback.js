import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import OAuthUsernameModal from './OAuthUsernameModal';

function OAuthCallback() {
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [tempUser, setTempUser] = useState(null);
  const { updateUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userParam = params.get('user');
    const isNew = params.get('newUser') === 'true';

    if (token && userParam) {
      if (isNew) {
        setTempToken(token);
        setTempUser(JSON.parse(userParam));
        setShowUsernameModal(true);
      } else {
        localStorage.setItem('token', token);
        localStorage.setItem('user', userParam);
        window.location.href = '/';
      }
    }
  }, []);

  const handleUsernameComplete = (updatedUser) => {
    localStorage.setItem('token', tempToken);
    updateUser(updatedUser);
    window.location.href = '/';
  };

  if (showUsernameModal) {
    return (
      <OAuthUsernameModal
        token={tempToken}
        user={tempUser}
        onComplete={handleUsernameComplete}
      />
    );
  }

  return <div className="loading">Выполняется вход...</div>;
}

export default OAuthCallback;