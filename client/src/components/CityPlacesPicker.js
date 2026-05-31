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

  const searchCity = async () => {
    if (!city.trim()) {
      setError('Введите название города');
      return;
    }
    setLoading(true);
    setError(null);
    setPlaces([]);
    try {
      const geocode = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
      });
      if (!geocode.data.length) {
        setError('Город не найден');
        setLoading(false);
        return;
      }
      const geo0 = geocode.data[0];
      // Если пользователь указал страну или слишком общий регион, предлагаем популярные места
      if (geo0.type === 'country' || geo0.type === 'state' || (geo0.importance && geo0.importance < 0.3)) {
        try {
          const countryName = geo0.display_name.split(',')[0];
          // Use server search to obtain top places for the region (will use getPopularPlaces or Overpass fallback)
          const resp = await axios.get(`/api/places/search`, { params: { city: countryName }, headers: { Authorization: `Bearer ${token}` } });
          setPlaces(resp.data.slice(0,5));
        } catch (err) {
          console.error(err);
          setError('Не удалось загрузить популярные места для указанного региона');
        }
        setLoading(false);
        return;
      }
      const { lat, lon } = geo0;
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["tourism"](around:5000,${lat},${lon});
          node["historic"](around:5000,${lat},${lon});
          node["leisure"="park"](around:5000,${lat},${lon});
          node["amenity"="museum"](around:5000,${lat},${lon});
          node["amenity"="theatre"](around:5000,${lat},${lon});
          node["tourism"="attraction"](around:5000,${lat},${lon});
        );
        out body;
      `;
      const response = await axios.post('https://overpass-api.de/api/interpreter',
        `data=${encodeURIComponent(overpassQuery)}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const elements = response.data.elements || [];
      const unique = [];
      const seen = new Set();
      for (const el of elements) {
        let name = el.tags?.name || el.tags?.name_ru || '';
        if (!name) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        let imageUrl = '';
        try {
          const wikiRes = await axios.get(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=pageimages&format=json&pithumbsize=300&origin=*`);
          const pages = wikiRes.data.query.pages;
          for (let pageId in pages) {
            if (pages[pageId].thumbnail) {
              imageUrl = pages[pageId].thumbnail.source;
              break;
            }
          }
        } catch(e) { /* ignore */ }
        if (!imageUrl) {
          imageUrl = 'https://via.placeholder.com/300x200?text=No+Image';
        }
        unique.push({
          id: el.id,
          name: name,
          address: city,
          lat: el.lat,
          lon: el.lon,
          category: el.tags?.tourism || el.tags?.historic || 'Достопримечательность',
          description: el.tags?.description || `Посетите ${name} в городе ${city}.`,
          image: imageUrl
        });
        if (unique.length >= 5) break;
      }
      setPlaces(unique.slice(0,5));
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить достопримечательности');
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
          placeholder="Введите город (например: Париж)"
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
          <h4>Топ мест в городе {city}:</h4>
          {places.map(place => (
            <div key={place.id} className="place-card" onClick={() => openPlaceDetail(place)}>
              {place.image && <img src={place.image} alt={place.name} className="place-image" />}
              <div className="place-info">
                <strong>{place.name}</strong>
                <span>{place.category}</span>
                <p>{place.description}</p>
                <button onClick={(e) => { e.stopPropagation(); openPlaceDetail(place); }}>
                  Подробнее
                </button>
              </div>
            </div>
          ))}
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