import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const scanningRef = useRef(false);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);
  const videoStreamRef = useRef(null);

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

  // Funkcja do pełnego zatrzymania kamery
  const stopCamera = useCallback(() => {
    console.log('🛑 Zatrzymuję kamerę...');
    
    // Zatrzymaj ZXing
    if (streamRef.current) {
      try {
        streamRef.current.stop();
        streamRef.current = null;
      } catch (err) {
        console.log('Błąd zatrzymania ZXing controls:', err);
      }
    }

    // Zatrzymaj wszystkie ścieżki video
    if (videoStreamRef.current) {
      try {
        videoStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🔴 Zatrzymano track:', track.kind, track.label);
        });
        videoStreamRef.current = null;
      } catch (err) {
        console.log('Błąd zatrzymania video tracks:', err);
      }
    }

    // Wyczyść video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Zresetuj ZXing reader
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (err) {
        console.log('Błąd resetowania ZXing:', err);
      }
    }

    scanningRef.current = false;
    setIsScanning(false);
  }, []);

  // Inicjalizacja ZXing
  useEffect(() => {
    let isMounted = true;

    const initializeScanner = async () => {
      try {
        console.log('🚀 Inicjalizuję skaner...');
        
        // Poczekaj chwilę na zwolnienie zasobów
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!isMounted) return;

        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;
        
        console.log('✅ Skaner zainicjalizowany');
        setIsInitializing(false);
      } catch (err) {
        console.error('❌ Błąd inicjalizacji:', err);
        if (isMounted) {
          setError('Nie można zainicjalizować skanera kodów kreskowych');
          setIsInitializing(false);
        }
      }
    };

    initializeScanner();

    return () => {
      isMounted = false;
      console.log('🧹 Czyszczenie inicjalizacji...');
      stopCamera();
    };
  }, [stopCamera]);

  // Główna funkcja skanowania
  const startScanning = useCallback(async () => {
    if (!codeReaderRef.current || isInitializing) {
      console.log('⏳ Skaner nie jest gotowy, czekam...');
      return;
    }

    // Zatrzymaj poprzednie skanowanie jeśli istnieje
    stopCamera();

    try {
      console.log('📱 Rozpoczynam nowe skanowanie...');
      
      // Poczekaj na zwolnienie zasobów
      await new Promise(resolve => setTimeout(resolve, 500));

      scanningRef.current = true;
      setIsScanning(true);
      setError(null);

      // Pobierz listę dostępnych urządzeń wideo
      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();
      console.log('📷 Dostępne kamery:', videoInputDevices.length);

      if (videoInputDevices.length === 0) {
        throw new Error('Nie znaleziono żadnej kamery');
      }

      // Wybierz tylną kamerę jeśli dostępna
      let selectedDeviceId = undefined;
      
      // Szukaj tylnej kamery
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      if (backCamera) {
        selectedDeviceId = backCamera.deviceId;
        console.log('📷 Używam tylnej kamery:', backCamera.label);
      } else {
        selectedDeviceId = videoInputDevices[0].deviceId;
        console.log('📷 Używam pierwszej kamery:', videoInputDevices[0].label);
      }

      // Rozpocznij ciągłe skanowanie
      const controls = await codeReaderRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (!scanningRef.current) return;

          if (result) {
            const scannedCode = result.getText();
            console.log('🎯 Znaleziono kod:', scannedCode);

            // Waliduj kod
            const validation = validatePolishFoodBarcode(scannedCode);
            
            if (validation.isValid) {
              console.log('✅ Kod zaakceptowany, zatrzymuję skanowanie');
              
              // Zatrzymaj skanowanie przed wywołaniem callback
              stopCamera();
              
              // Wywołaj callback po krótkiej przerwie
              setTimeout(() => {
                onDetected(validation.code);
              }, 100);
            }
            // Jeśli kod jest nieprawidłowy, kontynuuj skanowanie
          }

          if (error && !(error instanceof NotFoundException)) {
            console.log('⚠️ Błąd skanowania:', error.message);
          }
        }
      );

      // Zapisz kontrolki i strumień
      streamRef.current = controls;
      
      // Zapisz też strumień video dla lepszego cleanup
      if (videoRef.current && videoRef.current.srcObject) {
        videoStreamRef.current = videoRef.current.srcObject;
      }

      console.log('✅ Skanowanie uruchomione pomyślnie');

    } catch (err) {
      console.error('❌ Błąd podczas skanowania:', err);
      
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
      stopCamera();
    }
  }, [validatePolishFoodBarcode, onDetected, stopCamera, isInitializing]);

  // Uruchom skanowanie po załadowaniu komponentu
  useEffect(() => {
    if (!isInitializing && codeReaderRef.current && !error) {
      const timeoutId = setTimeout(() => {
        startScanning();
      }, 100);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [startScanning, isInitializing, error]);

  // Cleanup przy odmontowaniu komponentu
  useEffect(() => {
    return () => {
      console.log('🧹 Komponent odmontowany, czyszczę wszystko...');
      stopCamera();
    };
  }, [stopCamera]);

  const handleManualInput = () => {
    const barcode = prompt('Wprowadź kod kreskowy produktu (8, 12 lub 13 cyfr):');
    if (barcode && barcode.trim()) {
      const validation = validatePolishFoodBarcode(barcode.trim());
      
      if (validation.isValid) {
        stopCamera();
        onDetected(validation.code);
      } else {
        alert(`Nieprawidłowy kod kreskowy: ${validation.reason}\n\nProdukty spożywcze używają:\n• EAN-13 (13 cyfr) - najczęściej\n• EAN-8 (8 cyfr)\n• UPC-A (12 cyfr) - produkty importowane`);
      }
    }
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  if (error) {
    return (
      <div className="scanner-container">
        <div className="scanner-header">
          <h3>Błąd skanera</h3>
          <button onClick={handleCancel} className="cancel-button">✕</button>
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
          {isInitializing 
            ? 'Inicjalizacja skanera...'
            : isScanning 
              ? 'Skanowanie...' 
              : 'Uruchamianie kamery...'}
        </h3>
        <button onClick={handleCancel} className="cancel-button">✕</button>
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
            {isInitializing
              ? 'Przygotowywanie skanera...'
              : isScanning 
                ? 'Wyceluj w kod kreskowy produktu' 
                : 'Ładowanie kamery...'}
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
