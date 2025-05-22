import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';

function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanningRef = useRef(false);

  useEffect(() => {
    let videoStream = null;
    let animationFrame = null;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        videoStream = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setIsScanning(true);
            scanningRef.current = true;
            scanForBarcode();
          };
        }
      } catch (err) {
        console.error('Błąd dostępu do kamery:', err);
        setError('Nie można uzyskać dostępu do kamery. Sprawdź czy strona ma uprawnienia do kamery.');
      }
    };

    const scanForBarcode = () => {
      if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          console.log('Znaleziono kod:', code.data);
          scanningRef.current = false;
          setIsScanning(false);
          onDetected(code.data);
          return;
        }
      }

      // Kontynuuj skanowanie
      animationFrame = requestAnimationFrame(scanForBarcode);
    };

    startCamera();

    return () => {
      // Zatrzymaj skanowanie
      scanningRef.current = false;
      setIsScanning(false);
      
      // Zatrzymaj animację
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      // Zatrzymaj strumień video
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onDetected]);

  const handleManualInput = () => {
    const barcode = prompt('Wprowadź kod kreskowy ręcznie:');
    if (barcode && barcode.length >= 8) {
      onDetected(barcode);
    }
  };

  if (error) {
    return (
      <div className="scanner-container">
        <div className="scanner-header">
          <h3>Błąd kamery</h3>
          <button onClick={onCancel} className="cancel-button">
            ✕ Wróć
          </button>
        </div>
        <div className="scanner-error">
          <p>❌ {error}</p>
          <div style={{ margin: '1rem 0' }}>
            <p><strong>Możliwe rozwiązania:</strong></p>
            <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <li>Upewnij się, że przeglądarka ma dostęp do kamery</li>
              <li>Sprawdź czy inne aplikacje nie używają kamery</li>
              <li>Spróbuj odświeżyć stronę</li>
              <li>Użyj funkcji wprowadzania ręcznego poniżej</li>
            </ul>
          </div>
          <button onClick={handleManualInput} className="button-primary">
            Wprowadź kod ręcznie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <h3>
          {isScanning ? 'Skanowanie...' : 'Uruchamianie kamery...'}
        </h3>
        <button onClick={onCancel} className="cancel-button">
          ✕ Anuluj
        </button>
      </div>
      
      <div className="scanner-viewport">
        <video 
          ref={videoRef}
          className="scanner-element"
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        <canvas 
          ref={canvasRef}
          style={{ display: 'none' }}
        />
        <div className="scanner-overlay">
          <div className="scanner-frame"></div>
          <p className="scanner-instruction">
            {isScanning 
              ? 'Umieść kod kreskowy w ramce' 
              : 'Ładowanie kamery...'}
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
