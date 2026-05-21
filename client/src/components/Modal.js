import React from 'react';
import '../css/Modal.css';

function Modal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  inputValue, 
  onInputChange, 
  inputPlaceholder, 
  confirmText, 
  cancelText, 
  type,
  children 
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    if (type !== 'prompt' && type !== 'distribute' && onClose) onClose();
  };

  const handleCancel = () => {
    if (onClose) onClose();
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  const getConfirmButtonClass = () => {
    if (type === 'danger') return 'modal-button-danger';
    if (type === 'info') return 'modal-button-info';
    return 'modal-button-confirm';
  };

  const getConfirmButtonText = () => {
    if (confirmText) return confirmText;
    if (type === 'danger') return 'Удалить';
    if (type === 'info') return 'Закрыть';
    return 'Подтвердить';
  };

  const getCancelButtonText = () => {
    if (cancelText) return cancelText;
    return 'Отмена';
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-btn" onClick={handleClose}>×</button>
        </div>
        
        {message && <p className="modal-message">{message}</p>}
        
        {type === 'prompt' && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={inputPlaceholder}
            className="modal-input"
            autoFocus
          />
        )}
        
        {children && (
          <div className="modal-children">
            {children}
          </div>
        )}
        
        <div className="modal-buttons">
          <button onClick={handleConfirm} className={getConfirmButtonClass()}>
            {getConfirmButtonText()}
          </button>
          {type !== 'info' && (
            <button onClick={handleCancel} className="modal-button-cancel">
              {getCancelButtonText()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Modal;