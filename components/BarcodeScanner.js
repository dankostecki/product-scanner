import React, { useRef, useEffect, useState } from 'react';
import Quagga from 'quagga';

function BarcodeScanner({ onDetected, onCancel }) {
  const scannerRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initScanner = () => {
      if (!scannerRef.current) return;

      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            width: { min: 320, ideal: 640, max: 1920 },
            height: { min: 240, ideal: 480, max: 1080 },
            facingMode: "environment" // Użyj tylnej kamery
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: 2,
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "ean_13_reader",
            "code_128_reader",
            "code_39_reader"
          ]
        },
        locate: true
      }, function(err) {
        if (err) {
          console.error('Błąd inicjalizacji skanera:', err);
          setError('Nie można uruchomić kamery. Sprawdź uprawnienia.');
          return;
        }
        
        setIsInitialized(true);
        Quagga.start();
      });

      // Obsługa wykrytego kodu
      Quagga.onDetected((result) => {
        if (result && result.codeResult && result.codeResult.code) {
          const code = result.codeResult.code;
          // Sprawdź, czy kod ma odpowiednią długość (minimalne zabezpieczenie)
          if (code.length >= 8) {
            onDetected(code);
            Quagga.stop();
          }
        }
      });
    };

    initScanner();

    // Cleanup po odmontowaniu komponentu
    return () => {
      if (isInitialized) {
        Quagga.stop();
      }
    };
  }, [onDetected, isInitialized]);

  const handleCancel = () => {
    if (isInitialized) {
      Quagga.stop();
    }
    onCancel();
  };

  if (error) {
    return (
      <div className="scanner-error">
        <p>❌ {error}</p>
        <p>Sprawdź, czy:</p>
        <ul>
          <li>Przeglądarka ma dostęp do kamery</li>
          <li>Używasz HTTPS lub localhost</li>
          <li>Kamera nie jest używana przez inną aplikację</li>
        </ul>
        <button onClick={handleCancel} className="button-secondary">
          Wróć
        </button>
      </div>
    );
  }

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <h3>Skieruj kamerę na kod kreskowy</h3>
        <button onClick={handleCancel} className="cancel-button">
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
    </div>
  );
}

export default BarcodeScanner;
