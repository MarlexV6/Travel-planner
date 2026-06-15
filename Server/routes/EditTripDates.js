import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function EditTripDates({ trip, onClose, onUpdate }) {
  const [startDate, setStartDate] = useState(trip.start_date.split('T')[0]);
  const [endDate, setEndDate] = useState(trip.end_date.split('T')[0]);
  const [title, setTitle] = useState(trip.title);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const { token } = useAuth();

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const response = await axios.put(
        `/api/trips/${trip.id}`,
        { title, start_date: startDate, end_date: endDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );


      if (response.data.validation && !response.data.validation.isFeasible) {
        setWarning({
          type: 'feasibility',
          message: 'С новыми датами маршрут стал невыполнимым!',
          details: response.data.validation.warnings
        });
      }

      if (response.data.unavailableDates && response.data.unavailableDates.length > 0) {
        setWarning({
          type: 'unavailable_dates',
          message: `${response.data.unavailableDates.length} точек выходят за пределы новых дат`,
          details: response.data.unavailableDates
        });
      }

      if (response.data.trip) {
        onUpdate(response.data.trip);

        if (!warning) {
          setTimeout(onClose, 1500);
        }
      }
    } catch (err) {
      if (err.response?.data?.error === 'conflict') {
        setError({
          type: 'conflict',
          message: err.response.data.message,
          conflict: err.response.data.conflict
        });
      } else {
        setError({
          type: 'error',
          message: err.response?.data?.error || 'Ошибка обновления'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2>✏️ Редактировать поездку</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label>Название</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label>Дата начала</label>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label>Дата окончания</label>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          {/* Ошибка: конфликт с другой поездкой */}
          {error && error.type === 'conflict' && (
            <div style={styles.errorContainer}>
              <div style={styles.errorTitle}>Конфликт дат</div>
              <div>{error.message}</div>
              {error.conflict && (
                <div style={styles.conflictInfo}>
                  <strong>Конфликтующая поездка:</strong>
                  <div>{new Date(error.conflict.start_date).toLocaleDateString('ru-RU')} - {new Date(error.conflict.end_date).toLocaleDateString('ru-RU')}</div>
                  <button 
                    onClick={() => window.location.href = `/trips/${error.conflict.id}`}
                    style={styles.viewButton}
                  >
                    Посмотреть конфликт
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Предупреждение: маршрут стал невыполнимым */}
          {warning && warning.type === 'feasibility' && (
            <div style={styles.warningContainer}>
              <div style={styles.warningTitle}>{warning.message}</div>
              <div style={styles.warningDetails}>
                {warning.details?.slice(0, 3).map((w, idx) => (
                  <div key={idx} style={styles.warningItem}>
                    <strong>{w.title}</strong>
                    <div>{w.message}</div>
                  </div>
                ))}
              </div>
              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.forceButton} disabled={loading}>
                  {loading ? 'Сохранение...' : '⚠️ Всё равно сохранить'}
                </button>
                <button type="button" onClick={onClose} style={styles.cancelButton}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Предупреждение: точки вне дат */}
          {warning && warning.type === 'unavailable_dates' && (
            <div style={styles.warningContainer}>
              <div style={styles.warningTitle}>{warning.message}</div>
              <div style={styles.warningDetails}>
                {warning.details?.map((item, idx) => (
                  <div key={idx} style={styles.unavailableItem}>
                    🗺️ {item.point_name} — {item.issue} ({new Date(item.date).toLocaleDateString('ru-RU')})
                  </div>
                ))}
              </div>
              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.forceButton} disabled={loading}>
                  {loading ? 'Сохранение...' : 'Сохранить (точки будут вне дат)'}
                </button>
                <button type="button" onClick={onClose} style={styles.cancelButton}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Обычные кнопки (если нет предупреждений) */}
          {!error && (!warning || warning.type === 'feasibility' && !warning.details) && (
            <div style={styles.buttonGroup}>
              <button type="submit" style={styles.saveButton} disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
              <button type="button" onClick={onClose} style={styles.cancelButton}>
                Отмена
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'white',
    padding: '30px',
    borderRadius: '12px',
    width: '500px',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  formGroup: {
    marginBottom: '20px'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    boxSizing: 'border-box',
    marginTop: '5px'
  },
  errorContainer: {
    background: '#ffebee',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  errorTitle: {
    color: '#c62828',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  conflictInfo: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #ffcdd2'
  },
  warningContainer: {
    background: '#fff3e0',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  warningTitle: {
    color: '#e65100',
    fontWeight: 'bold',
    marginBottom: '10px',
    fontSize: '16px'
  },
  warningDetails: {
    marginTop: '10px',
    fontSize: '13px'
  },
  warningItem: {
    background: '#ffe0b2',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '8px'
  },
  unavailableItem: {
    padding: '8px',
    borderBottom: '1px solid #ffe0b2',
    fontSize: '13px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px'
  },
  saveButton: {
    flex: 1,
    padding: '12px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  forceButton: {
    flex: 1,
    padding: '12px',
    background: '#FF9800',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    background: '#999',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  viewButton: {
    marginTop: '8px',
    padding: '6px 12px',
    background: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default EditTripDates;