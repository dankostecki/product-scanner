import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanningRef = useRef(false);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);

  // Funkcja walidacji polskich kodów produktów spożywczych
  const validatePolishFoodBarcode = useCallback((code) => {
    const cleanCode = code.replace(/\D/g, ''); // Tylko cyfry
    
    // EAN-13 (13 cyfr) - najczęstszy w Polsce
    if (cleanCode.length === 13) {
      return {
        isValid: true,
        code: cleanCode,
        format: 'EAN-13'
      };
    }
    
    // EAN-8 (8 cyfr) - krótszy format
    if (cleanCode.length === 8) {
      return {
        isValid: true,
        code: cleanCode,
        format: 'EAN-8'
      };
    }
    
    // UPC-A (12 cyfr) - produkty importowane z USA
    if (cleanCode.length === 12) {
      return {
        isValid: true,
        code: cleanCode,
        format: 'UPC-A'
      };
    }
    
    return { 
      isValid: false, 
      reason: `Nieprawidłowa długość kodu (${cleanCode.length} cyfr). Produkty spożywcze używają 8, 12 lub 13 cyfr.` 
    };
  }, []);

  // Inicjalizacja ZXing
  useEffect(() => {
    try {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
    } catch (err) {
      console.error('Błąd inicjalizacji ZXing:', err);
      setError('Nie można zainicjalizować skanera kodów kreskowych');
    }

    return () => {
      if (codeReaderRef.current) {
        try {
          codeReaderRef.current.reset();
        } catch (err) {
          console.log('Błąd podczas czyszczenia ZXing:', err);
        }
      }
    };
  }, []);

  // Główna funkcja skanowania
  const startScanning = useCallback(async () => {
    if (!codeReaderRef.current) {
      setError('Skaner nie został zainicjalizowany');
      return;
    }

    try {
      scanningRef.current = true;
      setIsScanning(true);

      // Pobierz listę dostępnych urządzeń wideo
      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();

      // Wybierz tylną kamerę jeśli dostępna
      let selectedDeviceId = undefined;
      
      if (videoInputDevices.length > 0) {
        // Szukaj tylnej kamery
        const backCamera = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        
        if (backCamera) {
          selectedDeviceId = backCamera.deviceId;
        } else {
          selectedDeviceId = videoInputDevices[0].deviceId;
        }
      }

      // Rozpocznij ciągłe skanowanie
      const controls = await codeReaderRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedCode = result.getText();

            // Waliduj kod
            const validation = validatePolishFoodBarcode(scannedCode);
            
            if (validation.isValid) {
              // Zatrzymaj skanowanie
              scanningRef.current = false;
              setIsScanning(false);
              
              if (controls) {
                controls.stop();
              }
              
              onDetected(validation.code);
            }
            // Jeśli kod jest nieprawidłowy, kontynuuj skanowanie
          }

          if (error && !(error instanceof NotFoundException)) {
            // Loguj błędy ale kontynuuj skanowanie
            console.log('Błąd skanowania:', error.message);
          }
        }
      );

      // Zapisz kontrolki do zatrzymania później
      streamRef.current = controls;

    } catch (err) {
      console.error('Błąd podczas skanowania:', err);
      
      let errorMessage = 'Nie można uruchomić skanera kodów kreskowych.';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Dostęp do kamery został odrzucony. Kliknij ikonę kamery w pasku adresu i zezwól na dostęp.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Nie znaleziono kamery w urządzeniu.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Kamera nie jest obsługiwana przez przeglądarkę.';
      } else if (err.message) {
        errorMessage = `Błąd skanera: ${err.message}`;
      }
      
      setError(errorMessage);
      setIsScanning(false);
      scanningRef.current = false;
    }
  }, [validatePolishFoodBarcode, onDetected]);

  // Uruchom skanowanie po załadowaniu komponentu
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (codeReaderRef.current && !error) {
        startScanning();
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      scanningRef.current = false;
      setIsScanning(false);
      
      // Zatrzymaj strumień wideo
      if (streamRef.current) {
        try {
          streamRef.current.stop();
        } catch (err) {
          console.log('Błąd zatrzymania strumienia:', err);
        }
      }
    };
  }, [startScanning, error]);

  const handleManualInput = () => {
    const barcode = prompt('Wprowadź kod kreskowy produktu (8, 12 lub 13 cyfr):');
    if (barcode && barcode.trim()) {
      const validation = validatePolishFoodBarcode(barcode.trim());
      
      if (validation.isValid) {
        onDetected(validation.code);
      } else {
        alert(`Nieprawidłowy kod kreskowy: ${validation.reason}\n\nProdukty spożywcze używają:\n• EAN-13 (13 cyfr) - najczęściej\n• EAN-8 (8 cyfr)\n• UPC-A (12 cyfr) - produkty importowane`);
      }
    }
  };

  if (error) {
    return (
      <div className="scanner-container">
        <div className="scanner-header">
          <h3>Błąd skanera</h3>
          <button onClick={onCancel} className="cancel-button">✕</button>
        </div>
        <div className="scanner-error">
          <p><strong>{error}</strong></p>
          <div style={{ margin: '1rem 0' }}>
            <p><strong>Rozwiązania:</strong></p>
            <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <li>Kliknij ikonę kamery w pasku adresu i zezwól na dostęp</li>
              <li>Odśwież stronę (F5)</li>
              <li>Sprawdź czy inne aplikacje nie używają kamery</li>
              <li>Użyj przeglądarki Chrome lub Firefox</li>
              <li>Upewnij się że strona używa HTTPS</li>
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
          {isScanning ? 'Skanowanie...' : 'Uruchamianie skanera...'}
        </h3>
        <button onClick={onCancel} className="cancel-button">✕</button>
      </div>
      
      <div className="scanner-viewport">
        <video 
          ref={videoRef}
          className="scanner-element"
          playsInline
          muted
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        
        <div className="scanner-overlay">
          <div className="scanner-frame"></div>
          <p className="scanner-instruction">
            {isScanning 
              ? 'Wyceluj w kod kreskowy produktu' 
              : 'Ładowanie skanera...'}
          </p>
          {isScanning && (
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <p style={{ fontSize: '0.8rem', color: 'white', background: 'rgba(0,0,0,0.7)', padding: '10px 15px', borderRadius: '15px' }}>
                Ustaw kod w centrum ramki<br/>
                Trzymaj telefon stabilnie<br/>
                Sprawdź oświetlenie
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="manual-input">
        <button onClick={handleManualInput} className="button-secondary">
          Wprowadź kod ręcznie
        </button>
        <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
          Wskazówka: Ustaw telefon 15-20 cm od kodu kreskowego
        </p>
      </div>
    </div>
  );
}

export default BarcodeScanner;
