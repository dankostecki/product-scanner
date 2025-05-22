import React, { useRef, useEffect, useState } from 'react';

function BarcodeScanner({ onDetected, onCancel }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        const currentRef = scannerRef.current;
        if (currentRef) {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.play();
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'cover';
          
          currentRef.appendChild(video);
        }
      } catch (err) {
        console.error('Błąd dostępu do kamery:', err);
        setError('Nie można uzyskać dostępu do kamery');
      }
    };

    startCamera();

    return () => {
      const currentRef = scannerRef.current;
      if (currentRef) {
        const video = currentRef.querySelector('video');
        if (video && video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, []);

  const handleManualInput = () => {
    const barcode = prompt('Wprowadź kod kreskowy ręcznie:');
    if (barcode && barcode.length >= 8) {
      onDetected(barcode);
    }
  };

  if (error) {
    return (
      <div className="scanner-error">
        <p>❌ {error}</p>
        <p>Spróbuj wprowadzić kod ręcznie:</p>
        <button onClick={handleManualInput} className="button-primary">
          Wprowadź kod ręcznie
        </button>
        <button onClick={onCancel} className="button-secondary">
          Wróć
        </button>
      </div>
    );
  }

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <h3>Skieruj kamerę na kod kreskowy</h3>
        <button onClick={onCancel} className="cancel-button">
          ✕ Anuluj
        </button>
      </div>
      
      <div className="scanner-viewport">
        <div ref={scannerRef} className="scanner-element"></div>
        <div className="scanner-overlay">
          <div className="scanner-frame"></div>
          <p className="scanner-instruction">
            Umieść kod kreskowy w ramce
          </p>
        </div>
      </div>
      
      <div className="manual-input">
        <button onClick={handleManualInput} className="button-secondary">
          Wprowadź kod ręcznie
        </button>
      </div>
    </div>
  );
}

export default BarcodeScanner;
