import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import PlaceDetailModal from './PlaceDetailModal';
import CityPlacesPicker from './CityPlacesPicker';
import '../css/TripMap.css';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapController({ center, zoom, onMapReady }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);
  useEffect(() => {
    if (center && map) map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

function AddMarkerOnClick({ onAddPoint }) {
  useMapEvents({
    click(e) {
      onAddPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function TripMap() {
  const { id } = useParams();
  const { token } = useAuth();
  const [trip, setTrip] = useState(null);
  const [points, setPoints] = useState([]);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [mapInstance, setMapInstance] = useState(null);
  const [flyToPoint, setFlyToPoint] = useState(null);
  const [addingPoint, setAddingPoint] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pointToDelete, setPointToDelete] = useState(null);
  const [showAddPointModal, setShowAddPointModal] = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [pointName, setPointName] = useState('');
  const [showOptimizeResultModal, setShowOptimizeResultModal] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [portSuggestion, setPortSuggestion] = useState(null);
  const [showPortSuggestionModal, setShowPortSuggestionModal] = useState(false);
  const [portsPairSuggestion, setPortsPairSuggestion] = useState(null);
  const [showPortsPairModal, setShowPortsPairModal] = useState(false);
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [showSelectDayModal, setShowSelectDayModal] = useState(false);
  const [pendingAddress, setPendingAddress] = useState('');

  // Загрузка данных
  useEffect(() => {
    fetchTripDetails();
    fetchPoints();
    fetchDays();
  }, [id]);

  useEffect(() => {
    if (points.length >= 2) fetchRoute();
    setMapKey(prev => prev + 1);
    setLoading(false);
  }, [points]);

  useEffect(() => {
    if (flyToPoint && mapInstance) {
      mapInstance.flyTo([flyToPoint.lat, flyToPoint.lng], 15, { duration: 1.5 });
      setFlyToPoint(null);
    }
  }, [flyToPoint, mapInstance]);

  const fetchTripDetails = async () => {
    try {
      const res = await axios.get(`/api/trips/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setTrip(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchPoints = async () => {
    try {
      const res = await axios.get(`/api/trips/${id}/points`, { headers: { Authorization: `Bearer ${token}` } });
      setPoints(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchDays = async () => {
    try {
      const res = await axios.get(`/api/trips/${id}/days`, { headers: { Authorization: `Bearer ${token}` } });
      setDays(res.data);
      if (res.data.length > 0) setSelectedDayId(res.data[0].id.toString());
    } catch (err) {
      console.error('Error fetching days:', err);
      setDays([]);
    }
  };

  const fetchRoute = async () => {
    try {
      const response = await axios.post(`/api/trips/${id}/route`, { mode: 'driving' }, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data && response.data.route_possible === false && response.data.suggestion) {
        const sug = response.data.suggestion;
        if (sug.type === 'redirect_to_port') {
          setPortSuggestion(sug.port);
          if (days.length === 0) await fetchDays();
          setShowPortSuggestionModal(true);
        } else if (sug.type === 'redirect_ports_pair') {
          setPortsPairSuggestion({ origin: sug.origin_port, dest: sug.dest_port });
          if (days.length === 0) await fetchDays();
          setShowPortsPairModal(true);
        }
      }
      setRoute(response.data);
    } catch (err) { console.error(err); }
  };

  const optimizeRoute = async () => {
    if (points.length < 3) {
      alert('Для оптимизации нужно минимум 3 точки');
      return;
    }
    setOptimizing(true);
    try {
      const response = await axios.post(`/api/trips/${id}/optimize`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setOptimizeResult(response.data);
      setShowOptimizeResultModal(true);
      if (response.data.improvement > 0) await fetchPoints();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка оптимизации');
    } finally {
      setOptimizing(false);
    }
  };

  const showAddPointDialog = (lat, lng, defaultName = '') => {
    setPendingPoint({ lat, lng });
    setPointName(defaultName);
    if (days.length === 0) fetchDays();
    setShowAddPointModal(true);
  };

  const addPointWithName = async () => {
    if (!pointName.trim()) {
      alert('Введите название места');
      return;
    }
    if (!selectedDayId) {
      alert('Выберите день поездки');
      return;
    }
    setAddingPoint(true);
    try {
      const addressResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: { lat: pendingPoint.lat, lon: pendingPoint.lng, format: 'json', addressdetails: 1, 'accept-language': 'ru' },
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
      });
      let address = '';
      if (addressResponse.data) {
        const addr = addressResponse.data.address || {};
        const parts = [];
        if (addr.road) parts.push(addr.road);
        if (addr.house_number) parts.push(addr.house_number);
        const city = addr.city || addr.town || addr.village;
        if (city) parts.push(city);
        address = parts.join(', ');
      }
      const response = await axios.post(`/api/trips/${id}/points`, {
        place_name: pointName,
        address: address,
        latitude: pendingPoint.lat,
        longitude: pendingPoint.lng,
        order_index: points.length,
        day_id: parseInt(selectedDayId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPoints([...points, response.data]);
      setShowAddPointModal(false);
      setPointName('');
      setPendingPoint(null);
    } catch (err) {
      console.error(err);
      alert('Ошибка добавления точки');
    } finally {
      setAddingPoint(false);
    }
  };

  const addPointByClick = async (lat, lng) => {
    if (addingPoint) return;
    try {
      const addressResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: { lat, lon: lng, format: 'json', addressdetails: 1, 'accept-language': 'ru' },
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
      });
      let defaultName = 'Новая точка';
      if (addressResponse.data) {
        const data = addressResponse.data;
        const addr = data.address || {};
        if (addr.name) defaultName = addr.name;
        else if (addr.amenity) defaultName = addr.amenity;
        else if (addr.tourism) defaultName = addr.tourism;
        else if (addr.historic) defaultName = addr.historic;
        else if (addr.road) defaultName = addr.road;
        else if (addr.city || addr.town || addr.village) defaultName = addr.city || addr.town || addr.village;
        defaultName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
      }
      showAddPointDialog(lat, lng, defaultName);
    } catch (err) {
      showAddPointDialog(lat, lng, 'Новая точка');
    }
  };

  const addPointByAddress = async (e) => {
    e.preventDefault();
    if (!addressInput.trim()) {
      alert('Введите адрес');
      return;
    }
    setAddressLoading(true);
    setPendingAddress(addressInput);
    if (days.length === 0) await fetchDays();
    setShowSelectDayModal(true);
    setAddressLoading(false);
  };

  const confirmAddAddressPoint = async () => {
    if (!pendingAddress) return;
    if (!selectedDayId) {
      alert('Выберите день поездки');
      return;
    }
    try {
      const response = await axios.post(`/api/trips/${id}/points`, {
        address: pendingAddress,
        order_index: points.length,
        day_id: parseInt(selectedDayId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPoints([...points, response.data]);
      setPendingAddress('');
      setShowSelectDayModal(false);
      setAddressInput('');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Ошибка добавления точки');
    }
  };

  const confirmAddPort = async () => {
    if (!portSuggestion) return;
    if (!selectedDayId) {
      alert('Выберите день поездки');
      return;
    }
    try {
      const response = await axios.post(`/api/trips/${id}/points`, {
        place_name: `Порт: ${portSuggestion.name}`,
        address: portSuggestion.name,
        latitude: portSuggestion.latitude,
        longitude: portSuggestion.longitude,
        order_index: points.length,
        day_id: parseInt(selectedDayId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPoints([...points, response.data]);
      setShowPortSuggestionModal(false);
      setPortSuggestion(null);
      await fetchRoute();
    } catch (err) { alert('Ошибка добавления порта'); }
  };

  const confirmAddPortsPair = async () => {
    if (!portsPairSuggestion) return;
    if (!selectedDayId) {
      alert('Выберите день для портов');
      return;
    }
    try {
      const resp1 = await axios.post(`/api/trips/${id}/points`, {
        place_name: `Порт: ${portsPairSuggestion.origin.name}`,
        address: portsPairSuggestion.origin.name,
        latitude: portsPairSuggestion.origin.latitude,
        longitude: portsPairSuggestion.origin.longitude,
        order_index: points.length,
        day_id: parseInt(selectedDayId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      const resp2 = await axios.post(`/api/trips/${id}/points`, {
        place_name: `Порт: ${portsPairSuggestion.dest.name}`,
        address: portsPairSuggestion.dest.name,
        latitude: portsPairSuggestion.dest.latitude,
        longitude: portsPairSuggestion.dest.longitude,
        order_index: points.length + 1,
        day_id: parseInt(selectedDayId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPoints([...points, resp1.data, resp2.data]);
      setShowPortsPairModal(false);
      setPortsPairSuggestion(null);
      await fetchRoute();
    } catch (err) { alert('Ошибка добавления портов'); }
  };

  const confirmDeletePoint = async () => {
    if (pointToDelete) {
      try {
        await axios.delete(`/api/trips/points/${pointToDelete.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setPoints(points.filter(p => p.id !== pointToDelete.id));
        setShowDeleteModal(false);
        setPointToDelete(null);
      } catch (err) { alert('Ошибка удаления'); }
    }
  };

  const centerOnPoint = (lat, lng) => setFlyToPoint({ lat, lng });

  if (loading && points.length === 0) return <div className="tm-loading">Загрузка карты...</div>;

  const defaultCenter = [53.893009, 27.567444];
  const positions = points.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
  const center = positions.length > 0 ? positions[0] : defaultCenter;
  const routePositions = route?.polyline && route.polyline.length > 0
    ? route.polyline.map(p => [p.lat, p.lng])
    : positions;

  return (
    <div className="tm-container">
      <div className="tm-header">
        <h1>{trip?.title || 'Маршрут'} - Карта</h1>
        <Link to={`/trips/${id}`}>
          <button className="tm-back-button">Назад к поездке</button>
        </Link>
      </div>

      <div className="tm-add-form">
        <form onSubmit={addPointByAddress} className="tm-address-form">
          <input
            type="text"
            placeholder="Введите адрес (например: Эйфелева башня, Париж)"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="tm-address-input"
          />
          <button type="submit" disabled={addressLoading} className="tm-address-button">
            {addressLoading ? 'Поиск...' : 'Добавить по адресу'}
          </button>
        </form>
        <div className="tm-hint">Кликните на карту, чтобы добавить точку в выбранном месте</div>
      </div>

      {/* Рекомендации достопримечательностей через AI */}
      <div className="tm-places-section">
        <h3>Рекомендации достопримечательностей</h3>
        <CityPlacesPicker tripId={id} onPointsAdded={fetchPoints} />
      </div>

      {route?.distance && points.length >= 2 && (
        <div className="tm-route-info">
          <div className="tm-route-card">
            <div>
              <div><strong>Расстояние:</strong> {route.distance} км</div>
              <div><strong>Время в пути:</strong> ~{route.duration} ч</div>
              <div><strong>Точек маршрута:</strong> {points.length}</div>
            </div>
          </div>
        </div>
      )}

      {points.length >= 3 && (
        <button onClick={optimizeRoute} disabled={optimizing} className={optimizing ? 'tm-optimize-button-disabled' : 'tm-optimize-button'}>
          {optimizing ? 'Оптимизация...' : 'Оптимизировать маршрут (кратчайший путь)'}
        </button>
      )}

      <div className="tm-map-container">
        <MapContainer key={mapKey} center={center} zoom={8} style={{ height: '500px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='OpenStreetMap contributors' />
          <AddMarkerOnClick onAddPoint={addPointByClick} />
          <MapController onMapReady={setMapInstance} center={flyToPoint ? [flyToPoint.lat, flyToPoint.lng] : null} zoom={15} />
          {points.map((point, idx) => (
            <Marker key={point.id} position={[parseFloat(point.latitude), parseFloat(point.longitude)]} icon={customIcon}>
              <Popup>
                <div>
                  <strong>{idx + 1}. {point.place_name}</strong><br />
                  {point.address && <span>{point.address.substring(0, 100)}</span>}<br />
                  <button onClick={() => { setPointToDelete(point); setShowDeleteModal(true); }} className="tm-delete-popup-button">Удалить</button>
                </div>
              </Popup>
            </Marker>
          ))}
          {routePositions.length > 1 && <Polyline positions={routePositions} color="#2196F3" weight={4} opacity={0.8} />}
        </MapContainer>
      </div>

      <div className="tm-points-section">
        <h3>Точки маршрута ({points.length}):</h3>
        {points.length === 0 ? (
          <div className="tm-empty-state"><p>Нет добавленных точек</p><p>Кликните на карту, чтобы добавить первую точку</p></div>
        ) : (
          <div className="tm-points-grid">
            {points.map((point, idx) => (
              <div key={point.id} className="tm-point-card" onClick={() => centerOnPoint(parseFloat(point.latitude), parseFloat(point.longitude))}>
                <div className="tm-point-number">{idx + 1}</div>
                <div className="tm-point-info">
                  <div className="tm-point-name">{point.place_name}</div>
                  <div className="tm-point-address">{point.address ? point.address.substring(0, 60) : `${point.latitude}, ${point.longitude}`}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setPointToDelete(point); setShowDeleteModal(true); }} className="tm-remove-button">X</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалки */}
      <Modal isOpen={showAddPointModal} onClose={() => setShowAddPointModal(false)} onConfirm={addPointWithName}
        title="Добавление точки маршрута" type="prompt" confirmText="Добавить" cancelText="Отмена"
        inputValue={pointName} onInputChange={setPointName} inputPlaceholder="Введите название места">
        <p>Выберите название для добавляемой точки:</p>
        <div style={{ marginTop: 8 }}>
          <label>Выберите день поездки:</label>
          <select value={selectedDayId} onChange={(e) => setSelectedDayId(e.target.value)} className="modal-input">
            {days.map(day => <option key={day.id} value={day.id}>День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})</option>)}
          </select>
        </div>
      </Modal>

      <Modal isOpen={showSelectDayModal} onClose={() => setShowSelectDayModal(false)} onConfirm={confirmAddAddressPoint}
        title="Выберите день поездки" type="confirm" confirmText="Добавить" cancelText="Отмена">
        <p>Добавление адреса: {pendingAddress}</p>
        <select value={selectedDayId} onChange={(e) => setSelectedDayId(e.target.value)} className="modal-input">
          {days.map(day => <option key={day.id} value={day.id}>День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})</option>)}
        </select>
      </Modal>

      <Modal isOpen={showPortSuggestionModal} onClose={() => setShowPortSuggestionModal(false)} onConfirm={confirmAddPort}
        title="Предложение: добавить ближайший порт" type="confirm" confirmText="Добавить порт" cancelText="Отмена">
        <p>Маршрут между точками невозможен. Предлагается добавить ближайший порт: {portSuggestion?.name}</p>
        <select value={selectedDayId} onChange={(e) => setSelectedDayId(e.target.value)} className="modal-input">
          {days.map(day => <option key={day.id} value={day.id}>День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})</option>)}
        </select>
      </Modal>

      <Modal isOpen={showPortsPairModal} onClose={() => setShowPortsPairModal(false)} onConfirm={confirmAddPortsPair}
        title="Предложение: добавить порты отправления и прибытия" type="confirm" confirmText="Добавить оба порта" cancelText="Отмена">
        <p>Маршрут между точками невозможен. Предлагается добавить порты:</p>
        <div><strong>Отправление:</strong> {portsPairSuggestion?.origin?.name}</div>
        <div><strong>Прибытие:</strong> {portsPairSuggestion?.dest?.name}</div>
        <select value={selectedDayId} onChange={(e) => setSelectedDayId(e.target.value)} className="modal-input">
          {days.map(day => <option key={day.id} value={day.id}>День {day.day_number} ({new Date(day.date).toLocaleDateString('ru-RU')})</option>)}
        </select>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={confirmDeletePoint}
        title="Подтверждение удаления" message={`Вы уверены, что хотите удалить точку "${pointToDelete?.place_name}"?`}
        type="danger" confirmText="Удалить" cancelText="Отмена" />

      <Modal isOpen={showOptimizeResultModal} onClose={() => setShowOptimizeResultModal(false)}
        title="Результат оптимизации маршрута" type="info" confirmText="Закрыть">
        {optimizeResult && (
          <div className="optimize-result">
            {optimizeResult.already_optimal ? (
              <div><div className="optimize-title info">Маршрут уже оптимален</div>
              <div>Расстояние: {optimizeResult.old_distance} км</div></div>
            ) : (
              <div><div className="optimize-title success">Маршрут оптимизирован</div>
              <div>Старый порядок: {optimizeResult.old_order?.join(' → ')}</div>
              <div>Новый порядок: {optimizeResult.new_order?.join(' → ')}</div>
              <div>Улучшение: {optimizeResult.improvement}%</div>
              <div>Расстояние: {optimizeResult.old_distance} км → {optimizeResult.new_distance} км</div></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TripMap;