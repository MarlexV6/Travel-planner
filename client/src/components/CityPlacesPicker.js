import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PlaceDetailModal from './PlaceDetailModal';
import '../css/CityPlacesPicker.css';

function CityPlacesPicker({ tripId, onPointsAdded }) {
  const { token } = useAuth();
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [error, setError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);



// components/CityPlacesPicker.js (фрагмент изменений)
const handleAddToTrip = async (place) => {
    if (!tripId) {
        alert('Поездка не выбрана');
        return;
    }
    setAdding(true);
    try {
        await axios.post(`/api/trips/${tripId}/points`, {
            place_name: place.name,
            address: place.address || `${place.latitude}, ${place.longitude}`,
            latitude: place.latitude,
            longitude: place.longitude,
            day_id: null   // можно позже распределить по дням
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        if (onPointsAdded) onPointsAdded();  // обновит карту и список точек
        alert(`"${place.name}" добавлено в маршрут`);
    } catch (err) {
        console.error(err);
        alert('Ошибка добавления');
    } finally {
        setAdding(false);
    }
};


  const searchCity = async () => {
    if (!city.trim()) {
      setError('Введите название города');
      return;
    }
    setLoading(true);
    setError(null);
    setPlaces([]);

    try {
      const response = await axios.get('/api/ai-places/search', {
        params: { city: city.trim(), limit: 10 },
        headers: { Authorization: `Bearer ${token}` }
      });
      const newPlaces = response.data.places || [];
      setPlaces(newPlaces);
      if (newPlaces.length === 0) {
        setError('Не удалось найти достопримечательности. Попробуйте другой город или проверьте подключение.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Ошибка загрузки достопримечательностей');
    } finally {
      setLoading(false);
    }
  };

  const openPlaceDetail = (place) => {
    setSelectedPlace(place);
    setModalOpen(true);
  };

  const handlePointAdded = () => {
    if (onPointsAdded) onPointsAdded();
    setModalOpen(false);
    setSelectedPlace(null);
  };

  return (
    <div className="city-picker">
      <div className="city-input-group">
        <input
          type="text"
          placeholder="Введите город (например: Париж, Заславль)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchCity()}
        />
        <button onClick={searchCity} disabled={loading}>Найти места</button>
      </div>
      {loading && <div className="loader">Загрузка достопримечательностей...</div>}
      {error && <div className="error">{error}</div>}
      {places.length > 0 && (
        <div className="places-list">
          <h4>Достопримечательности в городе {city}:</h4>
          <div className="places-grid">
            {places.map(place => (
              <div key={place.name} className="place-card" onClick={() => openPlaceDetail(place)}>
                {place.image && <img src={place.image} alt={place.name} className="place-image" />}
                <div className="place-info">
                  <strong>{place.name}</strong>
                  <span>{place.category}</span>
                  <p>{place.description}</p>
                  <button onClick={(e) => { e.stopPropagation(); handleAddToTrip(place); }} disabled={adding}>
                {adding ? 'Добавление...' : '➕ Добавить'}
            </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PlaceDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        place={selectedPlace}
        tripId={tripId}
        onPointAdded={handlePointAdded}
      />
    </div>
  );
}

export default CityPlacesPicker;