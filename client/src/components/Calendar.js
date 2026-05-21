import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../css/Calendar.css';

function TripCalendar() {
  const [trips, setTrips] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tripsOnDate, setTripsOnDate] = useState([]);
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await axios.get('/api/trips', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips(response.data);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const getTileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    
    const tripsOnThisDate = trips.filter(trip => {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      return date >= start && date <= end;
    });
    
    if (tripsOnThisDate.length > 0) {
      return (
        <div className="cal-tile-content">
          {tripsOnThisDate.length === 1 ? '!' : `!${tripsOnThisDate.length}`}
        </div>
      );
    }
    return null;
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    const tripsOnSelectedDate = trips.filter(trip => {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      return date >= start && date <= end;
    });
    setTripsOnDate(tripsOnSelectedDate);
  };

  return (
    <div className="cal-container">
      <h1>Календарь поездок</h1>
      
      <div className="cal-calendar-container">
        <Calendar
          onChange={handleDateClick}
          value={selectedDate}
          tileContent={getTileContent}
          locale="ru-RU"
        />
      </div>
      
      {tripsOnDate.length > 0 && (
        <div className="cal-trips-list">
          <h3>Поездки на {selectedDate.toLocaleDateString('ru-RU')}:</h3>
          {tripsOnDate.map(trip => (
            <div key={trip.id} className="cal-trip-card" onClick={() => navigate(`/trips/${trip.id}`)}>
              <h4>{trip.title}</h4>
              <p>{new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TripCalendar;