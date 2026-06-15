import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import TripDetails from './components/TripDetails';
import TripCalendar from './components/Calendar';
import Stats from './components/Stats';
import AdminUsers from './components/AdminUsers';
import AdminTrips from './components/AdminTrips';
import Navbar from './components/Navbar';
import OAuthUsernameModal from './components/OAuthUsernameModal'
import OAuthCallback from './components/OAuthCallback.js';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/trips/:id" element={<PrivateRoute><TripDetails /></PrivateRoute>} />
          <Route path="/calendar" element={<PrivateRoute><TripCalendar /></PrivateRoute>} />
          <Route path="/stats" element={<PrivateRoute><Stats /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute adminOnly><AdminUsers /></PrivateRoute>} />
          <Route path="/admin/trips" element={<PrivateRoute adminOnly><AdminTrips /></PrivateRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}


export default App;