import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
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

function TripMap({ embedded = false, refreshKey = 0, onPointsAdded, selectedDayId: externalSelectedDayId, onDaySelect, flyToPoint: externalFlyToPoint, setFlyToPoint: setExternalFlyToPoint }) {
  const { id } = useParams();
  const { token } = useAuth();
  const [trip, setTrip] = useState(null);
  const [points, setPoints] = useState([]);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

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

  const [pendingSeaTarget, setPendingSeaTarget] = useState(null); 

  const [alertMessage, setAlertMessage] = useState(null);

  useEffect(() => {
    fetchTripDetails();
    fetchPoints();
    fetchDays();
  }, [id]);

  useEffect(() => {
    if (refreshKey > 0) {
      fetchPoints();
      fetchDays();
    }
  }, [refreshKey]);

  useEffect(() => {
    if (externalSelectedDayId) {
      setSelectedDayId(externalSelectedDayId);
    }
  }, [externalSelectedDayId]);

  useEffect(() => {
    if (externalFlyToPoint) {
      setFlyToPoint(externalFlyToPoint);
    }
  }, [externalFlyToPoint]);

  useEffect(() => {
    if (points.length >= 2) fetchRoute(selectedDayId || null);
    setMapKey(prev => prev + 1);
    setLoading(false);
  }, [points, selectedDayId]);

  useEffect(() => {
    if (flyToPoint && mapInstance) {
      mapInstance.flyTo([flyToPoint.lat, flyToPoint.lng], 15, { duration: 1.5 });
      setFlyToPoint(null);
      if (setExternalFlyToPoint) {
        setExternalFlyToPoint(null);
      }
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
      if (res.data.length > 0 && !externalSelectedDayId) {
        setSelectedDayId(res.data[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching days:', err);
      setDays([]);
    }
  };

  const fetchRoute = async (forDayId = null) => {
    try {
      const body = { mode: 'driving' };
      const dayToUse = forDayId || selectedDayId;
      if (dayToUse) body.day_id = dayToUse;
      const response = await axios.post(`/api/trips/${id}/route`, body, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data && response.data.route_possible === false && response.data.suggestion) {
        const sug = response.data.suggestion;
        const didAuto = await autoAddSeaPorts(sug);
        if (!didAuto) {
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
      }
      setRoute(response.data);
    } catch (err) { console.error(err); }
  };

  const filteredPoints = selectedDayId 
    ? points.filter(p => p.day_id && p.day_id.toString() === selectedDayId)
    : points;

  const optimizeRoute = async () => {
    const pointsForOptimize = filteredPoints;
    if (pointsForOptimize.length < 3) {
      setAlertMessage(selectedDayId 
        ? 'Для оптимизации дня нужно минимум 3 точки в этом дне' 
        : 'Для оптимизации нужно минимум 3 точки');
      return;
    }
    setOptimizing(true);
    try {
      const payload = {};
      if (selectedDayId) {
        payload.day_id = parseInt(selectedDayId);
      }
      const response = await axios.post(`/api/trips/${id}/optimize`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setOptimizeResult(response.data);
      setShowOptimizeResultModal(true);
      if (response.data.improvement > 0) {
        await fetchPoints();
        if (onPointsAdded) onPointsAdded();
      }
    } catch (err) {
      setAlertMessage(err.response?.data?.error || 'Ошибка оптимизации');
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
      setAlertMessage('Введите название места');
      return;
    }
    if (!selectedDayId) {
      setAlertMessage('Выберите день поездки');
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

      if (response.data && response.data.needsPort) {
        setShowAddPointModal(false);
        setPointName('');
        setPendingPoint(null);
        setPendingSeaTarget(response.data.target);
        const sug = response.data.suggestion;
        if (sug.type === 'redirect_ports_pair') {
          setPortsPairSuggestion({ origin: sug.origin_port, dest: sug.dest_port });
          if (days.length === 0) await fetchDays();
          setShowPortsPairModal(true);
        } else if (sug.type === 'redirect_to_port') {
          setPortSuggestion(sug.port);
          if (days.length === 0) await fetchDays();
          setShowPortSuggestionModal(true);
        }
        return;
      }

      setPoints([...points, response.data]);
      setShowAddPointModal(false);
      setPointName('');
      setPendingPoint(null);
      if (onPointsAdded) onPointsAdded();
    } catch (err) {
      console.error(err);
      setAlertMessage('Ошибка добавления точки');
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



  const confirmAddPort = async () => {
    if (!portSuggestion) return;
    if (!selectedDayId) {
      setAlertMessage('Выберите день поездки');
      return;
    }
    try {
      const portResp = await axios.post(`/api/trips/${id}/points`, {
        place_name: `Порт: ${portSuggestion.name}`,
        address: portSuggestion.name,
        latitude: portSuggestion.latitude,
        longitude: portSuggestion.longitude,
        order_index: points.length,
        day_id: parseInt(selectedDayId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      let newPoints = [...points, portResp.data];

      if (pendingSeaTarget) {
        const targetResp = await axios.post(`/api/trips/${id}/points`, {
          place_name: pendingSeaTarget.place_name,
          address: pendingSeaTarget.address || pendingSeaTarget.place_name,
          latitude: pendingSeaTarget.latitude,
          longitude: pendingSeaTarget.longitude,
          order_index: newPoints.length,
          day_id: parseInt(selectedDayId)
        }, { headers: { Authorization: `Bearer ${token}` } });
        newPoints = [...newPoints, targetResp.data];
        setPendingSeaTarget(null);
      }

      setPoints(newPoints);
      setShowPortSuggestionModal(false);
      setPortSuggestion(null);
      await fetchRoute();
      if (onPointsAdded) onPointsAdded();
    } catch (err) { setAlertMessage('Ошибка добавления порта'); }
  };

  const confirmAddPortsPair = async () => {
    if (!portsPairSuggestion) return;
    if (!selectedDayId) {
      setAlertMessage('Выберите день для портов');
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
      let newPoints = [...points, resp1.data, resp2.data];

      if (pendingSeaTarget) {
        const targetResp = await axios.post(`/api/trips/${id}/points`, {
          place_name: pendingSeaTarget.place_name,
          address: pendingSeaTarget.address || pendingSeaTarget.place_name,
          latitude: pendingSeaTarget.latitude,
          longitude: pendingSeaTarget.longitude,
          order_index: newPoints.length,
          day_id: parseInt(selectedDayId)
        }, { headers: { Authorization: `Bearer ${token}` } });
        newPoints = [...newPoints, targetResp.data];
        setPendingSeaTarget(null);
      }

      setPoints(newPoints);
      setShowPortsPairModal(false);
      setPortsPairSuggestion(null);
      await fetchRoute();
      if (onPointsAdded) onPointsAdded();
    } catch (err) { setAlertMessage('Ошибка добавления портов'); }
  };

  const autoAddSeaPorts = async (suggestion) => {
    if (!suggestion) return false;

    try {
      const dayToUse = selectedDayId || (days.length > 0 ? days[0].id.toString() : null);
      if (!dayToUse) {
        console.warn('No day available for auto port insert');
      }

      const addedPorts = [];

      if (suggestion.type === 'redirect_to_port' && suggestion.port) {
        const p = suggestion.port;
        const resp = await axios.post(`/api/trips/${id}/points`, {
          place_name: `Порт: ${p.name}`,
          address: p.name || 'Автоматический порт',
          latitude: p.latitude,
          longitude: p.longitude,
          day_id: dayToUse ? parseInt(dayToUse) : null
        }, { headers: { Authorization: `Bearer ${token}` } });
        addedPorts.push(resp.data);
      } else if (suggestion.type === 'redirect_ports_pair' && suggestion.origin_port && suggestion.dest_port) {
        const o = suggestion.origin_port;
        const d = suggestion.dest_port;
        const r1 = await axios.post(`/api/trips/${id}/points`, {
          place_name: `Порт отправления: ${o.name}`,
          address: o.name,
          latitude: o.latitude,
          longitude: o.longitude,
          day_id: dayToUse ? parseInt(dayToUse) : null
        }, { headers: { Authorization: `Bearer ${token}` } });
        const r2 = await axios.post(`/api/trips/${id}/points`, {
          place_name: `Порт прибытия: ${d.name}`,
          address: d.name,
          latitude: d.latitude,
          longitude: d.longitude,
          day_id: dayToUse ? parseInt(dayToUse) : null
        }, { headers: { Authorization: `Bearer ${token}` } });
        addedPorts.push(r1.data, r2.data);
      } else if (suggestion.type === 'redirect_airports_pair' && suggestion.departure_airport && suggestion.arrival_airport) {
        const o = suggestion.departure_airport;
        const d = suggestion.arrival_airport;
        const r1 = await axios.post(`/api/trips/${id}/points`, {
          place_name: `Аэропорт отправления: ${o.name}`,
          address: o.name,
          latitude: o.latitude,
          longitude: o.longitude,
          day_id: dayToUse ? parseInt(dayToUse) : null
        }, { headers: { Authorization: `Bearer ${token}` } });
        const r2 = await axios.post(`/api/trips/${id}/points`, {
          place_name: `Аэропорт прибытия: ${d.name}`,
          address: d.name,
          latitude: d.latitude,
          longitude: d.longitude,
          day_id: dayToUse ? parseInt(dayToUse) : null
        }, { headers: { Authorization: `Bearer ${token}` } });
        addedPorts.push(r1.data, r2.data);
      } else if (suggestion.type === 'redirect_to_airport' && suggestion.airport) {
        const p = suggestion.airport;
        const resp = await axios.post(`/api/trips/${id}/points`, {
          place_name: `Аэропорт: ${p.name}`,
          address: p.name || 'Автоматический аэропорт',
          latitude: p.latitude,
          longitude: p.longitude,
          day_id: dayToUse ? parseInt(dayToUse) : null
        }, { headers: { Authorization: `Bearer ${token}` } });
        addedPorts.push(resp.data);
      } else {
        return false;
      }

      await fetchPoints();

      const currentRes = await axios.get(`/api/trips/${id}/points`, { headers: { Authorization: `Bearer ${token}` } });
      let currentPoints = currentRes.data || [];

      const segIdx = suggestion.segment_index != null ? suggestion.segment_index : (currentPoints.length - 2);
      const destOriginalIndex = segIdx + 1;

      const portIds = new Set(addedPorts.map(p => p.id));
      const nonPorts = currentPoints.filter(p => !portIds.has(p.id));

      let finalOrder = [...nonPorts];
      const insertBeforeIdx = Math.min(destOriginalIndex, finalOrder.length);
      finalOrder.splice(insertBeforeIdx, 0, ...addedPorts);

      const updatePromises = finalOrder.map((pt, idx) =>
        axios.put(`/api/trips/points/${pt.id}/assign-day`, {
          day_id: pt.day_id || null,
          order_index: idx
        }, { headers: { Authorization: `Bearer ${token}` } })
      );
      await Promise.all(updatePromises);

      await fetchPoints();
      await fetchRoute();

      const portNames = addedPorts.map(p => p.place_name).join(', ');
      setAlertMessage(`Автоматически добавлен(ы) пункт(ы) пересадки: ${portNames}\n(пересечение обработано)`);

      if (onPointsAdded) onPointsAdded();
      return true;
    } catch (err) {
      console.error('autoAddSeaPorts error:', err);
      setAlertMessage('Не удалось автоматически добавить пункт(ы) пересадки. Можно добавить вручную.');
      return false;
    }
  };




  const confirmDeletePoint = async () => {
    if (pointToDelete) {
      try {
        await axios.delete(`/api/trips/points/${pointToDelete.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setPoints(points.filter(p => p.id !== pointToDelete.id));
        setShowDeleteModal(false);
        setPointToDelete(null);
        if (onPointsAdded) onPointsAdded();
      } catch (err) { setAlertMessage('Ошибка удаления'); }
    }
  };

  const centerOnPoint = (lat, lng) => setFlyToPoint({ lat, lng });

  if (loading && points.length === 0) return <div className="tm-loading">Загрузка карты...</div>;

  const defaultCenter = [53.893009, 27.567444];
  const positions = filteredPoints.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
  const center = positions.length > 0 ? positions[0] : defaultCenter;

  const getRouteSegments = (polylineCoords, currentPoints) => {
    if (!polylineCoords || polylineCoords.length === 0) {
      return [currentPoints.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)])];
    }
    const positions = polylineCoords.map(p => [p.lat, p.lng]);
    const portCoords = currentPoints
      .filter(p => p.place_name && (p.place_name.startsWith('Порт') || p.place_name.startsWith('Аэропорт')))
      .map(p => ({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) }));
    if (portCoords.length === 0) {
      return [positions];
    }
    const segments = [];
    let currentStart = 0;
    const sortedPortIndices = [];
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const isPort = portCoords.some(port => 
        Math.abs(pos[0] - port.lat) < 0.001 && Math.abs(pos[1] - port.lng) < 0.001
      );
      if (isPort) {
        sortedPortIndices.push(i);
      }
    }
    if (sortedPortIndices.length === 0) {
      return [positions];
    }

    if (sortedPortIndices[0] > currentStart) {
      segments.push(positions.slice(currentStart, sortedPortIndices[0] + 1));
    }

    for (let k = 1; k < sortedPortIndices.length; k += 2) {
      const arriveIdx = sortedPortIndices[k];
      const nextDepartOrEnd = (k + 1 < sortedPortIndices.length) ? sortedPortIndices[k + 1] : positions.length;
      if (nextDepartOrEnd > arriveIdx) {
        segments.push(positions.slice(arriveIdx, nextDepartOrEnd + 1));
      }
    }

    if (sortedPortIndices.length % 2 === 1) {
      const lastArrive = sortedPortIndices[sortedPortIndices.length - 1];
      if (positions.length > lastArrive + 1) {
        segments.push(positions.slice(lastArrive + 1));
      }
    }
    return segments.length > 0 ? segments : [positions];
  };

  const routeSegments = getRouteSegments(route?.polyline || [], filteredPoints);

  return (
    <div className="tm-container">
      {!embedded && (
        <div className="tm-header">
          <h1>{trip?.title || 'Маршрут'} - Карта</h1>
          <Link to={`/trips/${id}`}>
            <button className="tm-back-button">Назад к поездке</button>
          </Link>
        </div>
      )}



      {!embedded && (
        <div className="tm-places-section">
          <h3>Рекомендации достопримечательностей</h3>
          <CityPlacesPicker tripId={id} onPointsAdded={fetchPoints} />
        </div>
      )}

      {route?.distance && filteredPoints.length >= 2 && (
        <div className="tm-route-info">
          <div className="tm-route-card">
            <div>
              <div><strong>Расстояние:</strong> {route.distance} км</div>
              <div><strong>Время в пути:</strong> ~{route.duration} ч</div>
              <div><strong>Точек маршрута:</strong> {filteredPoints.length}</div>
            </div>
          </div>
        </div>
      )}

      {filteredPoints.length >= 3 && (
        <button onClick={optimizeRoute} disabled={optimizing} className={optimizing ? 'tm-optimize-button-disabled' : 'tm-optimize-button'}>
          {optimizing ? 'Оптимизация...' : 'Оптимизировать маршрут (кратчайший путь)'}
        </button>
      )}

      <div className="tm-map-container">
        <MapContainer key={mapKey} center={center} zoom={8} style={{ height: '500px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='OpenStreetMap contributors' />
          <AddMarkerOnClick onAddPoint={addPointByClick} />
          <MapController onMapReady={setMapInstance} center={flyToPoint ? [flyToPoint.lat, flyToPoint.lng] : null} zoom={15} />
          {filteredPoints.map((point, idx) => (
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
          {routeSegments.map((seg, idx) => (
            seg.length > 1 && <Polyline key={idx} positions={seg} color="#2196F3" weight={4} opacity={0.8} />
          ))}
        </MapContainer>
      </div>

      

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
              <div>Расстояние: {optimizeResult.new_distance} км</div></div>
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

export default TripMap;