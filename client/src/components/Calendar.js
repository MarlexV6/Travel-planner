import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../css/Calendar.css';

function TripCalendar() {
  const { token } = useAuth();
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeStartDate, setActiveStartDate] = useState(new Date());
  const [tripDays, setTripDays] = useState([]);

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

  const fetchTripDays = async (tripId) => {
    try {
      const response = await axios.get(`/api/trips/${tripId}/days`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTripDays(response.data);
    } catch (error) {
      console.error('Error fetching trip days:', error);
      setTripDays([]);
    }
  };

  const handleTripClick = (trip) => {
    const tripStartDate = new Date(trip.start_date);
    setSelectedTrip(trip);
    setSelectedDate(tripStartDate);
    setActiveStartDate(new Date(tripStartDate.getFullYear(), tripStartDate.getMonth(), 1));
    fetchTripDays(trip.id);
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    if (!selectedTrip) return null;
    const start = new Date(selectedTrip.start_date);
    const end = new Date(selectedTrip.end_date);
    if (date >= start && date <= end) {
      return 'calendar__trip-range';
    }
    const hasPoint = tripDays.some(day => {
      const dayDate = new Date(day.date);
      return dayDate.toDateString() === date.toDateString() && day.points?.length > 0;
    });
    if (hasPoint) return 'calendar__has-points';
    return null;
  };

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const dayPlan = tripDays.find(d => new Date(d.date).toDateString() === date.toDateString());
    if (dayPlan && dayPlan.points && dayPlan.points.length > 0) {
      return <span className="calendar__day-points">{dayPlan.points.length}📍</span>;
    }
    return null;
  };

  return (
    <div className="calendar-page">
      <div className="calendar-container">
        <Calendar
          onChange={setSelectedDate}
          onActiveStartDateChange={({ activeStartDate }) => setActiveStartDate(activeStartDate)}
          activeStartDate={activeStartDate}
          value={selectedDate}
          tileClassName={tileClassName}
          tileContent={tileContent}
          locale="ru-RU"
        />
      </div>
      <div className="trips-list-container">
        <h3>Мои поездки</h3>
        {trips.length === 0 && <p>Нет поездок</p>}
        <div className="trips-list">
          {trips.map(trip => (
            <div
              key={trip.id}
              className={`trip-card ${selectedTrip?.id === trip.id ? 'active' : ''}`}
              onClick={() => handleTripClick(trip)}
            >
              <h4>{trip.title}</h4>
              <p>{new Date(trip.start_date).toLocaleDateString()} – {new Date(trip.end_date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
        {selectedTrip && (
          <div className="selected-trip-details">
            <h4>Детали: {selectedTrip.title}</h4>
            {tripDays.length === 0 && <p>Нет запланированных дней</p>}
            <ul>
              {tripDays.map(day => (
                <li key={day.id}>
                  <strong>День {day.day_number} ({new Date(day.date).toLocaleDateString()})</strong>
                  {day.points?.length > 0 ? (
                    <ul>
                      {day.points.map(point => (
                        <li key={point.id}>{point.place_name}</li>
                      ))}
                    </ul>
                  ) : (
                    <span> – нет точек</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default TripCalendar;


