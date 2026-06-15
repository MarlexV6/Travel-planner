import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import TripDayPlanner from './TripDayPlanner';
import CityPlacesPicker from './CityPlacesPicker';
import TripMap from './TripMap';
import '../css/TripDetails.css';

function TripDetails() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', start_date: '', end_date: '' });
  const [newPoint, setNewPoint] = useState({ address: '', day_id: '' });
  const [geocoding, setGeocoding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState(null);
  const [showDeletePointModal, setShowDeletePointModal] = useState(false);
  const [pointToDelete, setPointToDelete] = useState(null);
  const [showDeleteTripModal, setShowDeleteTripModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState(null);
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [plannerRefreshKey, setPlannerRefreshKey] = useState(0);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [flyToPoint, setFlyToPoint] = useState(null);

  const handleDaySelect = (dayId) => {
    if (dayId) {
      setSelectedDayId(dayId.toString());
    }
  };

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveryData, setDiscoveryData] = useState(null);
  const [selectedDiscovery, setSelectedDiscovery] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);


  const [showSeaPortModal, setShowSeaPortModal] = useState(false);
  const [seaPortSuggestion, setSeaPortSuggestion] = useState(null);
  const [pendingSeaTargetDetails, setPendingSeaTargetDetails] = useState(null);

  useEffect(() => {
    fetchTrip();
    fetchPoints();
    fetchDays();
  }, [id]);

  const fetchTrip = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrip(response.data);
      setEditForm({
        title: response.data.title,
        start_date: response.data.start_date?.split('T')[0] || '',
        end_date: response.data.end_date?.split('T')[0] || ''
      });
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка загрузки поездки');
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}/points`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPoints(response.data);
    } catch (error) {
      console.error('Error fetching points:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDays = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}/days`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDays(response.data);
      if (response.data.length > 0 && !selectedDayId) {
        setSelectedDayId(response.data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching days:', error);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
    setEditError(null);
  };

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const updateTrip = async () => {
    setEditError(null);
    const startDate = new Date(editForm.start_date);
    const endDate = new Date(editForm.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!editForm.title.trim()) return setEditError('Введите название');
    if (startDate < today) return setEditError('Дата начала не может быть в прошлом');
    if (endDate < startDate) return setEditError('Дата окончания не может быть раньше даты начала');
    
    try {
      const oldStart = trip?.start_date ? trip.start_date.split('T')[0] : '';
      const oldEnd = trip?.end_date ? trip.end_date.split('T')[0] : '';
      const newStart = editForm.start_date;
      const newEnd = editForm.end_date;

      await axios.put(`/api/trips/${id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Поездка обновлена');
      await fetchTrip();

      if (newStart !== oldStart || newEnd !== oldEnd) {
        try {
          await axios.post(`/api/trips/${id}/days/adjust`, {
            start_date: newStart,
            end_date: newEnd
          }, { headers: { Authorization: `Bearer ${token}` } });
          setSuccess('Поездка обновлена. Дни скорректированы (сохранены пересекающиеся дни)');
        } catch (genErr) {
          console.error('Failed to adjust days after date edit:', genErr);
        }
      }

      await fetchDays();
      await fetchPoints();
      setPlannerRefreshKey(k => k + 1);
      setMapRefreshKey(k => k + 1);
      setShowEditModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      if (error.response?.data?.error === 'conflict') {
        setEditError(`Конфликт дат: ${error.response.data.message}`);
      } else {
        setEditError(error.response?.data?.error || 'Ошибка обновления');
      }
    }
  };

  const addPointByAddress = async (e) => {
    e.preventDefault();
    if (!newPoint.address.trim()) return setError('Введите адрес');
    if (!newPoint.day_id) return setError('Выберите день');

    const input = newPoint.address.trim();
    const looksLikePureCity = input.split(',').length === 1 && input.length > 1;

    if (looksLikePureCity) {
      setDiscoveryLoading(true);
      try {
        const res = await axios.get('/api/ai-places/discover', {
          params: { city: input },
          headers: { Authorization: `Bearer ${token}` }
        });
        setDiscoveryData(res.data || { center: null, attractions: [], hotels: [] });
        setSelectedDiscovery([]);
        if (res.data?.center) {
          const c = res.data.center;
          setSelectedDiscovery([{ ...c, kind: 'center', key: `center-${c.name}-${c.latitude}` }]);
        }
        setShowDiscoveryModal(true);
      } catch (e) {
        setError('Не удалось загрузить рекомендации для города');
      } finally {
        setDiscoveryLoading(false);
      }
      return;
    }

    setGeocoding(true);
    try {
      const geoRes = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: input,
          format: 'json',
          limit: 1,
          addressdetails: 1,
          'accept-language': 'ru'
        },
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
      });

      if (!geoRes.data || geoRes.data.length === 0) {
        setError('Не удалось определить координаты по адресу');
        setGeocoding(false);
        return;
      }

      const hit = geoRes.data[0];
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);

      let resolvedName = hit.display_name || input;
      if (hit.address) {
        const a = hit.address;
        const bits = [];
        const poi = a.amenity || a.tourism || a.historic || a.shop;
        if (poi) bits.push(poi);
        if (a.road) bits.push(a.road + (a.house_number ? ' ' + a.house_number : ''));
        const city = a.city || a.town || a.village;
        if (city && bits.length === 0) bits.push(city);
        if (bits.length) resolvedName = bits.join(', ');
      }

      const response = await axios.post(`/api/trips/${id}/points`, {
        place_name: resolvedName,
        address: hit.display_name || input,
        latitude: lat,
        longitude: lng,
        day_id: parseInt(newPoint.day_id)
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (response.data && response.data.needsPort) {
        setPendingSeaTargetDetails(response.data.target);
        setSeaPortSuggestion(response.data.suggestion);
        setShowSeaPortModal(true);
        setGeocoding(false);
        return;
      }

      setSuccess('Точка добавлена');
      setNewPoint({ address: '', day_id: selectedDayId });
      fetchPoints();
      fetchDays();
      setPlannerRefreshKey(k => k + 1);
      setMapRefreshKey(k => k + 1);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка добавления точки');
    } finally {
      setGeocoding(false);
    }
  };

  const confirmDeletePoint = async () => {
    if (!pointToDelete) return;
    try {
      await axios.delete(`/api/trips/points/${pointToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Точка удалена');
      fetchPoints();
      fetchDays();
      setMapRefreshKey(k => k + 1);
      setShowDeletePointModal(false);
      setPointToDelete(null);
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      setError('Ошибка удаления точки');
    }
  };

  const confirmDeleteTrip = async () => {
    if (!tripToDelete) return;
    try {
      await axios.delete(`/api/trips/${tripToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/');
    } catch (error) {
      setError('Ошибка удаления поездки');
      setShowDeleteTripModal(false);
    }
  };

  const toggleDiscoveryItem = (item, kind) => {
    const key = `${kind}-${item.name}-${item.latitude}`;
    setSelectedDiscovery(prev => {
      const exists = prev.findIndex(x => x.key === key);
      if (exists >= 0) return prev.filter((_, i) => i !== exists);
      return [...prev, { ...item, kind, key }];
    });
  };

  const addSelectedDiscoveryItems = async () => {
    if (!discoveryData) {
      setShowDiscoveryModal(false);
      return;
    }

    let itemsToAdd = selectedDiscovery;
    if (itemsToAdd.length === 0) {
      itemsToAdd = [];
      if (discoveryData.center) itemsToAdd.push({ ...discoveryData.center, kind: 'center' });
      if (discoveryData.attractions) itemsToAdd.push(...discoveryData.attractions.map(a => ({ ...a, kind: 'attraction' })));
      if (discoveryData.hotels) itemsToAdd.push(...discoveryData.hotels.map(h => ({ ...h, kind: 'hotel' })));
    }

    const dayIdToUse = newPoint.day_id || selectedDayId;
    if (!dayIdToUse) {
      setError('Выберите день для добавления рекомендаций');
      return;
    }

    try {
      for (const item of itemsToAdd) {
        await axios.post(`/api/trips/${id}/points`, {
          place_name: item.name,
          address: item.address || item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          day_id: parseInt(dayIdToUse)
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
      setSuccess(`Добавлено ${itemsToAdd.length} мест из рекомендаций`);
      fetchPoints();
      fetchDays();
      setPlannerRefreshKey(k => k + 1);
      setMapRefreshKey(k => k + 1);
      setShowDiscoveryModal(false);
      setDiscoveryData(null);
      setSelectedDiscovery([]);
      setNewPoint({ address: '', day_id: selectedDayId });
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError('Ошибка добавления из рекомендаций');
    }
  };

  const confirmAddSeaPortDetails = async (isPair = false) => {
    if (!seaPortSuggestion || !pendingSeaTargetDetails) return;
    const dayId = pendingSeaTargetDetails.day_id || selectedDayId;
    if (!dayId) {
      setError('Не выбран день для порта');
      return;
    }
    try {
      if (isPair && seaPortSuggestion.origin_port && seaPortSuggestion.dest_port) {
        await axios.post(`/api/trips/${id}/points`, {
          place_name: `Порт: ${seaPortSuggestion.origin_port.name}`,
          address: seaPortSuggestion.origin_port.name,
          latitude: seaPortSuggestion.origin_port.latitude,
          longitude: seaPortSuggestion.origin_port.longitude,
          day_id: parseInt(dayId)
        }, { headers: { Authorization: `Bearer ${token}` } });
        await axios.post(`/api/trips/${id}/points`, {
          place_name: `Порт: ${seaPortSuggestion.dest_port.name}`,
          address: seaPortSuggestion.dest_port.name,
          latitude: seaPortSuggestion.dest_port.latitude,
          longitude: seaPortSuggestion.dest_port.longitude,
          day_id: parseInt(dayId)
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else if (seaPortSuggestion.port) {
        await axios.post(`/api/trips/${id}/points`, {
          place_name: `Порт: ${seaPortSuggestion.port.name}`,
          address: seaPortSuggestion.port.name,
          latitude: seaPortSuggestion.port.latitude,
          longitude: seaPortSuggestion.port.longitude,
          day_id: parseInt(dayId)
        }, { headers: { Authorization: `Bearer ${token}` } });
      }

      await axios.post(`/api/trips/${id}/points`, {
        place_name: pendingSeaTargetDetails.place_name,
        address: pendingSeaTargetDetails.address || pendingSeaTargetDetails.place_name,
        latitude: pendingSeaTargetDetails.latitude,
        longitude: pendingSeaTargetDetails.longitude,
        day_id: parseInt(dayId)
      }, { headers: { Authorization: `Bearer ${token}` } });

      setSuccess('Порт(ы) и точка добавлены');
      fetchPoints();
      fetchDays();
      setPlannerRefreshKey(k => k + 1);
      setMapRefreshKey(k => k + 1);
      setShowSeaPortModal(false);
      setSeaPortSuggestion(null);
      setPendingSeaTargetDetails(null);
      setNewPoint({ address: '', day_id: selectedDayId });
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError('Ошибка добавления порта/точки');
    }
  };

  const cancelSeaPortDetails = () => {
    setShowSeaPortModal(false);
    setSeaPortSuggestion(null);
    setPendingSeaTargetDetails(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Дата не указана';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Неверная дата' : date.toLocaleDateString('ru-RU');
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!trip) return <div className="error-message">Поездка не найдена</div>;

  return (
    <div className="trip-details-container">
      <div className="trip-details-header">
        <div className="trip-details-title-section">
          <h1>{trip.title}</h1>
          <div className="trip-details-actions">
            <button className="btn-edit" onClick={() => setShowEditModal(true)}>Редактировать</button>
            <button className="btn-delete" onClick={() => { setTripToDelete(trip); setShowDeleteTripModal(true); }}>Удалить поездку</button>
          </div>
        </div>
        <div className="trip-details-info">
          <p className="trip-dates">{formatDate(trip.start_date)} - {formatDate(trip.end_date)}</p>
          <button onClick={() => navigate('/')} className="btn-back">Назад</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="add-point-section">
        <h3>Добавить новую точку по адресу</h3>
        <form onSubmit={addPointByAddress} className="add-point-form">
          <div className="form-row">
            <input
              type="text"
              placeholder="Введите адрес (например, Эйфелева башня, Париж)"
              value={newPoint.address}
              onChange={(e) => setNewPoint({ ...newPoint, address: e.target.value })}
              required
              className="form-input"
            />
            <select
              value={newPoint.day_id}
              onChange={(e) => setNewPoint({ ...newPoint, day_id: e.target.value })}
              className="form-select"
              required
            >
              <option value="">Выберите день</option>
              {days.map(day => (
                <option key={day.id} value={day.id}>
                  День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})
                </option>
              ))}
            </select>
            <button type="submit" disabled={geocoding} className="btn-add-point">
              {geocoding ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>

      <CityPlacesPicker tripId={id} onPointsAdded={() => { fetchPoints(); fetchDays(); setPlannerRefreshKey(k => k + 1); setMapRefreshKey(k => k + 1); }} />


      <TripDayPlanner
        key={plannerRefreshKey}
        tripId={id}
        startDate={trip.start_date}
        endDate={trip.end_date}
        onPointsUpdate={() => { fetchPoints(); fetchDays(); setMapRefreshKey(k => k + 1); }}
        onDaySelect={handleDaySelect}
        onPointClick={(lat, lng) => setFlyToPoint({ lat, lng })}
      />


      <TripMap
        embedded
        refreshKey={mapRefreshKey}
        selectedDayId={selectedDayId}
        onDaySelect={handleDaySelect}
        flyToPoint={flyToPoint}
        setFlyToPoint={setFlyToPoint}
        onPointsAdded={() => { fetchPoints(); fetchDays(); setPlannerRefreshKey(k => k + 1); }}
      />

      

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Редактирование поездки</h2>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            {editError && <div className="edit-error">{editError}</div>}
            <div className="edit-form">
              <div className="form-group">
                <label>Название</label>
                <input type="text" name="title" value={editForm.title} onChange={handleEditChange} className="form-input" />
              </div>
              <div className="form-group">
                <label>Дата начала</label>
                <input type="date" name="start_date" value={editForm.start_date} onChange={handleEditChange} className="form-input" min={getTodayString()} />
              </div>
              <div className="form-group">
                <label>Дата окончания</label>
                <input type="date" name="end_date" value={editForm.end_date} onChange={handleEditChange} className="form-input" min={editForm.start_date || getTodayString()} />
              </div>
            </div>
            <div className="modal-buttons">
              <button onClick={updateTrip} className="modal-button-confirm">Сохранить</button>
              <button onClick={() => setShowEditModal(false)} className="modal-button-cancel">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showDeletePointModal && pointToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeletePointModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="modal-close-btn" onClick={() => setShowDeletePointModal(false)}>×</button>
            </div>
            <p>Вы уверены, что хотите удалить точку "{pointToDelete.place_name}"?</p>
            <div className="modal-buttons">
              <button onClick={confirmDeletePoint} className="modal-button-danger">Удалить</button>
              <button onClick={() => setShowDeletePointModal(false)} className="modal-button-cancel">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteTripModal && tripToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteTripModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="modal-close-btn" onClick={() => setShowDeleteTripModal(false)}>×</button>
            </div>
            <p>Вы уверены, что хотите удалить поездку "{tripToDelete.title}"?</p>
            <p className="modal-warning">Все точки маршрута также будут удалены. Действие необратимо.</p>
            <div className="modal-buttons">
              <button onClick={confirmDeleteTrip} className="modal-button-danger">Удалить</button>
              <button onClick={() => setShowDeleteTripModal(false)} className="modal-button-cancel">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showDiscoveryModal && discoveryData && (
        <div className="modal-overlay" onClick={() => { setShowDiscoveryModal(false); setDiscoveryData(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: 520}}>
            <div className="modal-header">
              <h3>{discoveryData.center ? `Топ-10 + отели в ${discoveryData.center.name}` : 'Рекомендации для города'}</h3>
              <button className="modal-close-btn" onClick={() => { setShowDiscoveryModal(false); setDiscoveryData(null); }}>×</button>
            </div>

            <div style={{ maxHeight: '420px', overflow: 'auto', marginBottom: 12 }}>
              {discoveryData.center && (
                <div style={{marginBottom: 10, padding: 8, background: '#21262d', borderRadius: 6}}>
                  <label style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input type="checkbox" checked={selectedDiscovery.some(x => x.key === `center-${discoveryData.center.name}-${discoveryData.center.latitude}`)} onChange={() => toggleDiscoveryItem(discoveryData.center, 'center')} />
                    <div><strong>📍 {discoveryData.center.name} (центр города)</strong><br/><small>{discoveryData.center.address}</small></div>
                  </label>
                </div>
              )}

              {discoveryData.attractions && discoveryData.attractions.length > 0 && (
                <>
                  <h4 style={{margin:'8px 0'}}>Топ-10 достопримечательностей</h4>
                  {discoveryData.attractions.map((a,i) => (
                    <div key={i} style={{display:'flex', gap:8, marginBottom:4, fontSize:13}}>
                      <input type="checkbox" checked={selectedDiscovery.some(x => x.key === `attraction-${a.name}-${a.latitude}`)} onChange={() => toggleDiscoveryItem(a, 'attraction')} />
                      <div><strong>{i+1}. {a.name}</strong> — {a.category}<br/><small>{a.address}</small></div>
                    </div>
                  ))}
                </>
              )}

              {discoveryData.hotels && discoveryData.hotels.length > 0 && (
                <>
                  <h4 style={{margin:'8px 0'}}>Ближайшие отели</h4>
                  {discoveryData.hotels.map((h,i) => (
                    <div key={i} style={{display:'flex', gap:8, marginBottom:4, fontSize:13}}>
                      <input type="checkbox" checked={selectedDiscovery.some(x => x.key === `hotel-${h.name}-${h.latitude}`)} onChange={() => toggleDiscoveryItem(h, 'hotel')} />
                      <div><strong>🏨 {h.name}</strong><br/><small>{h.address}</small></div>
                    </div>
                  ))}
                </>
              )}

              {(!discoveryData.attractions?.length && !discoveryData.hotels?.length) && (
                <p style={{color:'#8b949e'}}>Мало данных от внешних сервисов — можно добавить хотя бы центр.</p>
              )}
            </div>

            <div className="modal-buttons">
              <button onClick={addSelectedDiscoveryItems} className="modal-button-confirm">
                {selectedDiscovery.length ? `Добавить выбранные (${selectedDiscovery.length})` : 'Добавить всё'}
              </button>
              <button onClick={() => { setShowDiscoveryModal(false); setDiscoveryData(null); }} className="modal-button-cancel">Отмена</button>
            </div>
            <div style={{fontSize:12, color:'#8b949e', marginTop:8}}>
              Места будут добавлены в выбранный день.
            </div>
          </div>
        </div>
      )}

      {showSeaPortModal && seaPortSuggestion && pendingSeaTargetDetails && (
        <div className="modal-overlay" onClick={cancelSeaPortDetails}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Пересечение моря</h3>
              <button className="modal-close-btn" onClick={cancelSeaPortDetails}>×</button>
            </div>
            <p>{seaPortSuggestion.message || 'Чтобы добраться до места, нужно пересечь море.'}</p>
            <p><strong>Добавляемая точка:</strong> {pendingSeaTargetDetails.place_name}</p>
            {seaPortSuggestion.type === 'redirect_ports_pair' && seaPortSuggestion.origin_port && seaPortSuggestion.dest_port && (
              <div>
                <p><strong>Порт отправления:</strong> {seaPortSuggestion.origin_port.name}</p>
                <p><strong>Порт прибытия:</strong> {seaPortSuggestion.dest_port.name}</p>
              </div>
            )}
            {seaPortSuggestion.type === 'redirect_to_port' && seaPortSuggestion.port && (
              <p><strong>Ближайший порт:</strong> {seaPortSuggestion.port.name}</p>
            )}
            <div className="modal-buttons">
              <button onClick={() => confirmAddSeaPortDetails(seaPortSuggestion.type === 'redirect_ports_pair')} className="modal-button-confirm">
                Добавить порт(ы) и точку
              </button>
              <button onClick={cancelSeaPortDetails} className="modal-button-cancel">Отмена</button>
            </div>
            <p style={{fontSize: '12px', color: '#8b949e', marginTop: 8}}>
              Порт будет добавлен перед точкой в маршруте.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TripDetails;