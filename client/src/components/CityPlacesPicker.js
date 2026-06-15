import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import '../css/CityPlacesPicker.css';

function CityPlacesPicker({ tripId, onPointsAdded, refreshKey = 0 }) {
  const { token } = useAuth();
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [center, setCenter] = useState(null); 
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [days, setDays] = useState([]);
  const [showDaySelect, setShowDaySelect] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); 
  const [alertMessage, setAlertMessage] = useState(null);

  useEffect(() => {
    if (refreshKey > 0) {
      setDays([]);
    }
  }, [refreshKey]);

  const abortControllerRef = useRef(null);

  const searchCity = useCallback(async () => {
    const trimmed = city.trim();
    if (!trimmed) {
      setError('Введите название города');
      return;
    }
    if (loading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);
    setPlaces([]);
    setHotels([]);
    setSelectedItems([]);

    try {
      const discoverPromise = axios.get('/api/ai-places/discover', {
        params: { city: trimmed },
        headers: { Authorization: `Bearer ${token}` },
        signal
      });
      const searchPromise = axios.get('/api/ai-places/search', {
        params: { city: trimmed, limit: 10 },
        headers: { Authorization: `Bearer ${token}` },
        signal
      });

      const [discoverRes, searchRes] = await Promise.allSettled([discoverPromise, searchPromise]);

      let attractions = [];
      let hotelList = [];
      let cityCenter = null;

      if (discoverRes.status === 'fulfilled') {
        const data = discoverRes.value.data || {};
        attractions = (data.attractions || []).slice(0, 10);
        hotelList = data.hotels || [];
        cityCenter = data.center || null;
      }

      if (attractions.length < 3 && searchRes.status === 'fulfilled') {
        const sData = searchRes.value.data || {};
        if (sData.places && sData.places.length > attractions.length) {
          attractions = (sData.places || []).slice(0, 10);
        }
      }

      setCenter(cityCenter);

      if (attractions.length > 0 || hotelList.length > 0 || cityCenter) {
        setPlaces(attractions);
        setHotels(hotelList);

        if (cityCenter) {
          const centerKey = `center:${cityCenter.name}:${cityCenter.latitude}:${cityCenter.longitude}`;
          setSelectedItems([{ ...cityCenter, type: 'center', key: centerKey }]);
        }
      } else if (searchRes.status === 'fulfilled') {
        setPlaces((searchRes.value.data?.places || []).slice(0, 10));
        setCenter(null);
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return;
      console.error(err);
      try {
        const fallback = await axios.get('/api/ai-places/search', {
          params: { city: trimmed, limit: 10 },
          headers: { Authorization: `Bearer ${token}` }
        });
        if (fallback.data?.places?.length > 0) {
          setPlaces(fallback.data.places.slice(0, 10));
        } else {
          setError(fallback.data?.error || 'Не удалось найти достопримечательности.');
        }
      } catch (e2) {
        setError(err.response?.data?.error || 'Ошибка поиска');
      }
    } finally {
      setLoading(false);
    }
  }, [city, token]);



  const fetchDays = async () => {
    if (!tripId) return [];
    try {
      const response = await axios.get(`/api/trips/${tripId}/days`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (err) {
      console.error('Error fetching days:', err);
      return [];
    }
  };

  const toggleSelect = (item, type) => {
    const key = `${type}:${item.name}:${item.latitude}:${item.longitude}`;
    setSelectedItems(prev => {
      const exists = prev.findIndex(i => i.key === key);
      if (exists >= 0) {
        return prev.filter((_, idx) => idx !== exists);
      } else {
        return [...prev, { ...item, type, key }];
      }
    });
  };

  const isSelected = (item, type) => {
    const key = `${type}:${item.name}:${item.latitude}:${item.longitude}`;
    return selectedItems.some(i => i.key === key);
  };

  const openDaySelectForSelected = async () => {
    if (!tripId) {
      setAlertMessage('Поездка не выбрана');
      return;
    }
    if (selectedItems.length === 0 && places.length === 0) return;

    const daysList = days.length ? days : await fetchDays();
    if (!daysList.length) {
      setAlertMessage('Сначала сгенерируйте дни поездки (в разделе планирования)');
      return;
    }
    setDays(daysList);
    setSelectedDayId(daysList[0].id.toString());
    setShowDaySelect(true);
  };

  const confirmAddSelectedWithDay = async () => {
    if (!selectedDayId) return;

    const toAdd = selectedItems.length > 0 ? selectedItems : [
      ...places.map(p => ({...p, type: 'attraction'})),
      ...hotels.map(h => ({...h, type: 'hotel'})),
      ...(center ? [{...center, type: 'center'}] : [])
    ];

    if (toAdd.length === 0) {
      setShowDaySelect(false);
      return;
    }

    setAdding(true);
    setShowDaySelect(false);

    let addedCount = 0;
    const dayNum = days.find(d => d.id == selectedDayId)?.day_number || '?';

    try {
      for (const item of toAdd) {
        const payload = {
          place_name: item.name,
          address: item.address || item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          day_id: parseInt(selectedDayId)
        };
        await axios.post(`/api/trips/${tripId}/points`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        addedCount++;
      }

      if (onPointsAdded) onPointsAdded();
      setAlertMessage(`Добавлено ${addedCount} мест в день ${dayNum}`);
      setSelectedItems([]);
    } catch (err) {
      console.error(err);
      setAlertMessage('Ошибка добавления некоторых мест: ' + (err.response?.data?.error || err.message));
    } finally {
      setAdding(false);
    }
  };

  const handleAddSingle = async (place, type = 'attraction') => {
    if (!tripId) {
      setAlertMessage('Поездка не выбрана');
      return;
    }
    const daysList = days.length ? days : await fetchDays();
    if (!daysList.length) {
      setAlertMessage('Сначала сгенерируйте дни поездки');
      return;
    }
    setSelectedItems([{ ...place, type, key: `${type}:${place.name}:${place.latitude}:${place.longitude}` }]);
    setDays(daysList);
    setSelectedDayId(daysList[0].id.toString());
    setShowDaySelect(true);
  };

  const hasResults = places.length > 0 || hotels.length > 0 || center;
  const selectedCount = selectedItems.length;

  return (
    <div className="city-picker">
      <div className="city-input-group">
        <input
          type="text"
          placeholder="Введите город (например: Париж, Крит, Исландия)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchCity()}
        />
        <button onClick={searchCity} disabled={loading}>Найти топ-10 + отели</button>
      </div>
      {loading && <div className="loader">Генерация топ-10 достопримечательностей и отелей...</div>}
      {error && <div className="error">{error}</div>}
      
      {hasResults || center ? (
        <div className="places-list">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <button 
              onClick={openDaySelectForSelected} 
              disabled={adding || (selectedCount === 0 && places.length + hotels.length === 0 && !center)}
              style={{background: '#238636'}}
            >
              {selectedCount > 0 ? `Добавить выбранные (${selectedCount})` : 'Добавить все в маршрут'}
            </button>
          </div>

          {center && (
            <div style={{marginBottom: 12}}>
              <div className="place-card" style={{borderLeft: '4px solid #58a6ff'}}>
                <div className="place-info">
                  <label style={{display: 'flex', gap: 8, alignItems: 'flex-start'}}>
                    <input 
                      type="checkbox" 
                      checked={isSelected(center, 'center')}
                      onChange={() => toggleSelect(center, 'center')}
                    />
                    <div>
                      <strong>📍 {center.name} (центр / город)</strong>
                      <span>Город</span>
                      <p>{center.address}</p>
                      <button 
                        onClick={() => handleAddSingle(center, 'center')} 
                        disabled={adding}
                        style={{marginTop: 4, fontSize: '12px'}}
                      >
                        Добавить только центр города
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {places.length > 0 && (
            <>
              <h5 style={{margin: '12px 0 8px', color: '#8b949e'}}>Топ-10 достопримечательностей</h5>
              <div className="places-grid">
                {places.map((place, idx) => (
                  <div key={`attr-${idx}`} className="place-card">
                    {place.image_url && <img src={place.image_url} alt={place.name} className="place-image" />}
                    <div className="place-info">
                      <label style={{display: 'flex', gap: 8, alignItems: 'flex-start'}}>
                        <input 
                          type="checkbox" 
                          checked={isSelected(place, 'attraction')}
                          onChange={() => toggleSelect(place, 'attraction')}
                        />
                        <div>
                          <strong>{idx + 1}. {place.name}</strong>
                          <span>{place.category}</span>
                          <p>{place.description || place.address}</p>
                          <button 
                            onClick={() => handleAddSingle(place, 'attraction')} 
                            disabled={adding}
                            style={{marginTop: 4, fontSize: '12px'}}
                          >
                            Добавить только это
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {hotels.length > 0 && (
            <>
              <h5 style={{margin: '16px 0 8px', color: '#8b949e'}}>Ближайшие отели</h5>
              <div className="places-grid">
                {hotels.map((hotel, idx) => (
                  <div key={`hotel-${idx}`} className="place-card hotel-card">
                    <div className="place-info">
                      <label style={{display: 'flex', gap: 8, alignItems: 'flex-start'}}>
                        <input 
                          type="checkbox" 
                          checked={isSelected(hotel, 'hotel')}
                          onChange={() => toggleSelect(hotel, 'hotel')}
                        />
                        <div>
                          <strong>🏨 {hotel.name}</strong>
                          <span>{hotel.category || 'Отель'}</span>
                          <p>{hotel.address}</p>
                          <button 
                            onClick={() => handleAddSingle(hotel, 'hotel')} 
                            disabled={adding}
                            style={{marginTop: 4, fontSize: '12px'}}
                          >
                            Добавить только этот отель
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {places.length === 0 && hotels.length === 0 && center && (
            <p style={{color: '#8b949e', fontSize: '13px'}}>
              Автоматический поиск достопримечательностей и отелей не дал результатов для этого места. 
              Вы можете добавить центр города (выше).
            </p>
          )}
        </div>
      ) : null}

      {showDaySelect && (
        <div className="modal-overlay" onClick={() => setShowDaySelect(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Выберите день для добавления {selectedItems.length || places.length + hotels.length} мест</h3>
            <select value={selectedDayId} onChange={(e) => setSelectedDayId(e.target.value)} className="modal-input">
              {days.map(day => (
                <option key={day.id} value={day.id}>
                  День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})
                </option>
              ))}
            </select>
            <div className="modal-buttons">
              <button onClick={confirmAddSelectedWithDay} disabled={adding}>
                {adding ? 'Добавление...' : 'Добавить выбранные'}
              </button>
              <button onClick={() => setShowDaySelect(false)}>Отмена</button>
            </div>
            <p style={{fontSize: '12px', color: '#8b949e', marginTop: 8}}>
              Все выбранные места будут добавлены в один день. Потом можно перераспределить.
            </p>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!alertMessage}
        onClose={() => setAlertMessage(null)}
        title="Уведомление"
        message={alertMessage}
        type="info"
      />
    </div>
  );
}

export default CityPlacesPicker;