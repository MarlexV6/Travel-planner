import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
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
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  useEffect(() => {
    if (center && map) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
}

function AddMarkerOnClick({ onAddPoint }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onAddPoint(lat, lng);
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
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [showPlaces, setShowPlaces] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [addingPlace, setAddingPlace] = useState(false);

  useEffect(() => {
    fetchTripDetails();
    fetchPoints();
  }, [id]);

  useEffect(() => {
    if (points.length >= 2) {
      fetchRoute();
    }
    setMapKey(prev => prev + 1);
    setLoading(false);
  }, [points]);

  useEffect(() => {
    if (flyToPoint && mapInstance) {
      mapInstance.flyTo([flyToPoint.lat, flyToPoint.lng], 15, {
        duration: 1.5,
        animate: true
      });
      setFlyToPoint(null);
    }
  }, [flyToPoint, mapInstance]);

  const fetchTripDetails = async () => {
    try {
      const response = await axios.get(`/api/trips/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrip(response.data);
    } catch (error) {
      console.error('Error fetching trip details:', error);
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
    }
  };

  const fetchRoute = async () => {
    try {
      const response = await axios.post(`/api/trips/${id}/route`, 
        { mode: 'driving' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRoute(response.data);
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  const optimizeRoute = async () => {
    if (points.length < 3) {
      alert('Для оптимизации нужно минимум 3 точки');
      return;
    }
    
    setOptimizing(true);
    try {
      const response = await axios.post(`/api/trips/${id}/optimize`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setOptimizeResult(response.data);
      setShowOptimizeResultModal(true);
      
      if (response.data.improvement > 0) {
        await fetchPoints();
      }
    } catch (error) {
      console.error('Error optimizing route:', error);
      alert(error.response?.data?.error || 'Ошибка оптимизации маршрута');
    } finally {
      setOptimizing(false);
    }
  };

  const fetchNearbyPlaces = async (lat, lng) => {
    setLoadingPlaces(true);
    try {
      const response = await axios.get(`/api/places/nearby`, {
        params: { lat, lng, radius: 5000 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setNearbyPlaces(response.data);
      setShowPlaces(true);
    } catch (error) {
      console.error('Error fetching places:', error);
      alert('Ошибка загрузки достопримечательностей');
    } finally {
      setLoadingPlaces(false);
    }
  };

  const fetchPlacesByCity = async () => {
    if (!selectedCity.trim()) {
      alert('Введите название города');
      return;
    }
    setLoadingPlaces(true);
    try {
      const response = await axios.get(`/api/places/search`, {
        params: { city: selectedCity },
        headers: { Authorization: `Bearer ${token}` }
      });
      setNearbyPlaces(response.data);
      setShowPlaces(true);
    } catch (error) {
      console.error('Error fetching places by city:', error);
      alert('Ошибка поиска достопримечательностей');
    } finally {
      setLoadingPlaces(false);
    }
  };

  const confirmAddPlace = async () => {
    if (!selectedPlace) return;
    
    setAddingPlace(true);
    try {
      const response = await axios.post(`/api/trips/${id}/points`, 
        {
          place_name: selectedPlace.name,
          address: selectedPlace.address || selectedPlace.name,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          order_index: points.length
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPoints([...points, response.data]);
      setShowAddPlaceModal(false);
      setSelectedPlace(null);
    } catch (error) {
      console.error('Error adding place:', error);
      alert('Ошибка добавления точки');
    } finally {
      setAddingPlace(false);
    }
  };

  const showAddPlaceConfirmation = (place) => {
    setSelectedPlace(place);
    setShowAddPlaceModal(true);
  };

  const showAddPointDialog = (lat, lng, defaultName = '') => {
    setPendingPoint({ lat, lng });
    setPointName(defaultName);
    setShowAddPointModal(true);
  };

  const addPointWithName = async () => {
    if (!pointName.trim()) {
      alert('Введите название места');
      return;
    }
    
    setAddingPoint(true);
    try {
      const addressResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          lat: pendingPoint.lat,
          lon: pendingPoint.lng,
          format: 'json',
          addressdetails: 1,
          'accept-language': 'ru'
        },
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
      });
      
      let address = '';
      if (addressResponse.data) {
        const addr = addressResponse.data.address || {};
        const addressParts = [];
        if (addr.road) addressParts.push(addr.road);
        if (addr.house_number) addressParts.push(addr.house_number);
        const city = addr.city || addr.town || addr.village;
        if (city) addressParts.push(city);
        address = addressParts.join(', ');
      }
      
      const response = await axios.post(`/api/trips/${id}/points`, 
        {
          place_name: pointName,
          address: address,
          latitude: pendingPoint.lat,
          longitude: pendingPoint.lng,
          order_index: points.length
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPoints([...points, response.data]);
      setShowAddPointModal(false);
      setPointName('');
      setPendingPoint(null);
    } catch (error) {
      console.error('Error adding point:', error);
      alert('Ошибка добавления точки');
    } finally {
      setAddingPoint(false);
    }
  };

  const addPointByClick = async (lat, lng) => {
    if (addingPoint) return;
    
    try {
      const addressResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          lat: lat,
          lon: lng,
          format: 'json',
          addressdetails: 1,
          'accept-language': 'ru'
        },
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
        else if (addr.city || addr.town || addr.village) {
          defaultName = addr.city || addr.town || addr.village;
        }
        
        defaultName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
      }
      
      showAddPointDialog(lat, lng, defaultName);
    } catch (error) {
      console.error('Error reverse geocoding:', error);
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
    try {
      const response = await axios.post(`/api/trips/${id}/points`, 
        {
          address: addressInput,
          order_index: points.length
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPoints([...points, response.data]);
      setAddressInput('');
    } catch (error) {
      console.error('Error adding point:', error);
      alert(error.response?.data?.error || 'Ошибка добавления точки');
    } finally {
      setAddressLoading(false);
    }
  };

  const confirmDeletePoint = async () => {
    if (pointToDelete) {
      try {
        await axios.delete(`/api/trips/points/${pointToDelete.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPoints(points.filter(p => p.id !== pointToDelete.id));
        setShowDeleteModal(false);
        setPointToDelete(null);
      } catch (error) {
        console.error('Error deleting point:', error);
        alert('Ошибка удаления точки');
      }
    }
  };

  const centerOnPoint = (lat, lng) => {
    setFlyToPoint({ lat, lng });
  };

  if (loading && points.length === 0) {
    return <div className="tm-loading">Загрузка карты...</div>;
  }

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
            placeholder="Введите адрес (например: Минск, Свердлова)"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="tm-address-input"
            disabled={addressLoading}
          />
          <button type="submit" className="tm-add-button" disabled={addressLoading}>
            {addressLoading ? 'Поиск...' : 'Добавить по адресу'}
          </button>
        </form>
        <div className="tm-hint">
          Кликните на карту, чтобы добавить точку в выбранном месте
        </div>
      </div>

      <div className="tm-places-section">
        <h3>Достопримечательности</h3>
        <div className="tm-places-controls">
          <button 
            onClick={() => {
              if (center) fetchNearbyPlaces(center[0], center[1]);
            }} 
            className="tm-places-button"
          >
            Показать рядом с картой
          </button>
          <div className="tm-city-search">
            <input
              type="text"
              placeholder="Название города"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="tm-city-input"
            />
            <button onClick={fetchPlacesByCity} className="tm-search-button">
              Найти
            </button>
          </div>
        </div>
        
        {loadingPlaces && <div className="tm-loading-places">Поиск достопримечательностей...</div>}
        
        {showPlaces && nearbyPlaces.length > 0 && (
          <div className="tm-places-list">
            <h4>Найденные места:</h4>
            <div className="tm-places-grid">
              {nearbyPlaces.map((place) => (
                <div key={place.id} className="tm-place-card">
                  <div className="tm-place-header">
                    <span className="tm-place-category">{place.category}</span>
                    <button onClick={() => showAddPlaceConfirmation(place)} className="tm-add-place-button">
                      Добавить
                    </button>
                  </div>
                  <div className="tm-place-name">{place.name}</div>
                  <div className="tm-place-address">{place.address}</div>
                  {place.description && <div className="tm-place-description">{place.description}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {showPlaces && nearbyPlaces.length === 0 && !loadingPlaces && (
          <div className="tm-no-places">Достопримечательности не найдены</div>
        )}
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
        <button 
          onClick={optimizeRoute} 
          disabled={optimizing}
          className={optimizing ? 'tm-optimize-button-disabled' : 'tm-optimize-button'}
        >
          {optimizing ? 'Оптимизация...' : 'Оптимизировать маршрут (кратчайший путь)'}
        </button>
      )}

      <div className="tm-map-container">
        <MapContainer 
          key={mapKey}
          center={center} 
          zoom={8} 
          style={{ height: '500px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='OpenStreetMap contributors'
          />
          <AddMarkerOnClick onAddPoint={addPointByClick} />
          <MapController onMapReady={setMapInstance} center={flyToPoint ? [flyToPoint.lat, flyToPoint.lng] : null} zoom={15} />
          
          {points.map((point, idx) => (
            <Marker 
              key={point.id} 
              position={[parseFloat(point.latitude), parseFloat(point.longitude)]}
              icon={customIcon}
            >
              <Popup>
                <div>
                  <strong>{idx + 1}. {point.place_name}</strong>
                  <br />
                  {point.address && <span>{point.address.substring(0, 100)}</span>}
                  <br />
                  <button 
                    onClick={() => {
                      setPointToDelete(point);
                      setShowDeleteModal(true);
                    }} 
                    className="tm-delete-popup-button"
                  >
                    Удалить
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {routePositions.length > 1 && (
            <Polyline 
              positions={routePositions} 
              color="#2196F3" 
              weight={4} 
              opacity={0.8}
            />
          )}
        </MapContainer>
      </div>

      <div className="tm-points-section">
        <h3>Точки маршрута ({points.length}):</h3>
        {points.length === 0 ? (
          <div className="tm-empty-state">
            <p>Нет добавленных точек</p>
            <p>Кликните на карту, чтобы добавить первую точку</p>
          </div>
        ) : (
          <div className="tm-points-grid">
            {points.map((point, idx) => (
              <div 
                key={point.id} 
                className="tm-point-card"
                onClick={() => centerOnPoint(parseFloat(point.latitude), parseFloat(point.longitude))}
              >
                <div className="tm-point-number">{idx + 1}</div>
                <div className="tm-point-info">
                  <div className="tm-point-name">{point.place_name}</div>
                  <div className="tm-point-address">{point.address ? point.address.substring(0, 60) : `${point.latitude}, ${point.longitude}`}</div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPointToDelete(point);
                    setShowDeleteModal(true);
                  }} 
                  className="tm-remove-button"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно для добавления точки с названием */}
      <Modal
        isOpen={showAddPointModal}
        onClose={() => setShowAddPointModal(false)}
        onConfirm={addPointWithName}
        title="Добавление точки маршрута"
        type="prompt"
        confirmText="Добавить"
        cancelText="Отмена"
        inputValue={pointName}
        onInputChange={setPointName}
        inputPlaceholder="Введите название места"
      >
        <p>Выберите название для добавляемой точки:</p>
      </Modal>

      {/* Модальное окно для добавления достопримечательности */}
      <Modal
        isOpen={showAddPlaceModal}
        onClose={() => setShowAddPlaceModal(false)}
        onConfirm={confirmAddPlace}
        title="Добавление достопримечательности"
        type="confirm"
        confirmText="Добавить в маршрут"
        cancelText="Отмена"
      >
        {selectedPlace && (
          <div className="add-place-confirmation">
            <div className="add-place-name">{selectedPlace.name}</div>
            <div className="add-place-address">{selectedPlace.address}</div>
            <div className="add-place-category">{selectedPlace.category}</div>
            {selectedPlace.description && (
              <div className="add-place-description">{selectedPlace.description}</div>
            )}
            <div className="add-place-coords">
              Координаты: {selectedPlace.latitude.toFixed(6)}, {selectedPlace.longitude.toFixed(6)}
            </div>
          </div>
        )}
        {addingPlace && <div className="adding-place-loader">Добавление...</div>}
      </Modal>

      {/* Модальное окно для подтверждения удаления */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeletePoint}
        title="Подтверждение удаления"
        message={`Вы уверены, что хотите удалить точку "${pointToDelete?.place_name}"?`}
        type="danger"
        confirmText="Удалить"
        cancelText="Отмена"
      />

      {/* Модальное окно с результатами оптимизации */}
      <Modal
        isOpen={showOptimizeResultModal}
        onClose={() => setShowOptimizeResultModal(false)}
        title="Результат оптимизации маршрута"
        type="info"
        confirmText="Закрыть"
      >
        {optimizeResult && (
          <div className="optimize-result">
            {optimizeResult.already_optimal ? (
              <div className="optimize-success">
                <div className="optimize-title info">Маршрут уже оптимален</div>
                <div className="optimize-details">
                  <div><strong>Расстояние:</strong> {optimizeResult.old_distance} км</div>
                  <div><strong>Количество точек:</strong> {optimizeResult.old_order?.length || 0}</div>
                  {optimizeResult.old_order && optimizeResult.old_order.length > 0 && (
                    <div className="optimize-old-order">
                      <strong>Порядок точек:</strong>
                      <div>{optimizeResult.old_order.join(' → ')}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="optimize-success">
                <div className="optimize-title success">Маршрут оптимизирован успешно</div>
                <div className="optimize-details">
                  {optimizeResult.old_order && optimizeResult.old_order.length > 0 && (
                    <div className="optimize-old-order">
                      <strong>Старый порядок:</strong>
                      <div>{optimizeResult.old_order.join(' → ')}</div>
                    </div>
                  )}
                  {optimizeResult.new_order && optimizeResult.new_order.length > 0 && (
                    <div className="optimize-new-order">
                      <strong>Новый порядок:</strong>
                      <div>{optimizeResult.new_order.join(' → ')}</div>
                    </div>
                  )}
                  <div className="optimize-improvement">
                    Улучшение: {optimizeResult.improvement}%
                  </div>
                  <div>
                    <strong>Расстояние:</strong> {optimizeResult.old_distance} км → {optimizeResult.new_distance} км
                  </div>
                  {optimizeResult.first_point_preserved && (
                    <div className="optimize-note">
                      Первая точка маршрута сохранена
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TripMap;