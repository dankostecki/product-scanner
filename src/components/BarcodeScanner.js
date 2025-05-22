import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const scanningRef = useRef(false);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);

  // Funkcja walidacji polskich kodów produktów spożywczych
  const validatePolishFoodBarcode = useCallback((code) => {
    const cleanCode = code.replace(/\D/g, ''); // Tylko cyfry
    
    console.log('🔍 Sprawdzam kod:', cleanCode, 'Długość:', cleanCode.length);
    
    // EAN-13 (13 cyfr) - najczęstszy w Polsce
    if (cleanCode.length === 13) {
      const countryCode = cleanCode.substring(0, 3);
      console.log('📍 Prefix krajowy EAN-13:', countryCode);
      
      return {
        isValid: true,
        code: cleanCode,
        format: 'EAN-13',
        country: countryCode,
        isPolish: countryCode.startsWith('59'),
        confidence: 'high'
      };
    }
    
    // EAN-8 (8 cyfr) - krótszy format
    if (cleanCode.length === 8) {
      console.log('📍 Kod EAN-8 znaleziony');
      return {
        isValid: true,
        code: cleanCode,
        format: 'EAN-8',
        confidence: 'high'
      };
    }
    
    // UPC-A (12 cyfr) - produkty importowane z USA
    if (cleanCode.length === 12) {
      console.log('📍 Kod UPC-A znaleziony');
      return {
        isValid: true,
        code: cleanCode,
        format: 'UPC-A',
        confidence: 'medium'
      };
    }
    
    console.log('❌ Kod odrzucony - nieprawidłowa długość:', cleanCode.length);
    return { 
      isValid: false, 
      reason: `Nieprawidłowa długość kodu (${cleanCode.length} cyfr). Produkty spożywcze używają 8, 12 lub 13 cyfr.` 
    };
  }, []);

  // Inicjalizacja ZXing
  useEffect(() => {
    try {
      console.log('🚀 Inicjalizuję ZXing BrowserMultiFormatReader...');
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      console.log('✅ ZXing zainicjalizowany pomyślnie');
    } catch (err) {
      console.error('❌ Błąd inicjalizacji ZXing:', err);
      setError('Nie można zainicjalizować skanera kodów kreskowych');
    }

    return () => {
      console.log('🧹 Czyszczenie ZXing...');
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
      console.log('📱 Rozpoczynam skanowanie ZXing...');
      scanningRef.current = true;
      setIsScanning(true);
      setScanAttempts(0);

      // Pobierz listę dostępnych urządzeń wideo
      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();
      console.log('📷 Dostępne kamery:', videoInputDevices.length);

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
          console.log('📷 Używam tylnej kamery:', backCamera.label);
        } else {
          selectedDeviceId = videoInputDevices[0].deviceId;
          console.log('📷 Używam pierwszej dostępnej kamery:', videoInputDevices[0].label);
        }
      }

      console.log('🎯 Rozpoczynam ciągłe dekodowanie...');

      // Rozpocznij ciągłe skanowanie
      const controls = await codeReaderRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error, controls) => {
          setScanAttempts(prev => prev + 1);

          if (result) {
            const scannedCode = result.getText();
            console.log('🎯 ZXing wykrył kod:', scannedCode, 'Format:', result.getBarcodeFormat());

            // Waliduj kod
            const validation = validatePolishFoodBarcode(scannedCode);
            
            if (validation.isValid) {
              console.log('✅ Kod zaakceptowany:', validation);
              setLastScannedCode(validation.code);
              
              // Zatrzymaj skanowanie
              scanningRef.current = false;
              setIsScanning(false);
              
              if (controls) {
                controls.stop();
              }
              
              onDetected(validation.code);
            } else {
              console.log('❌ Kod odrzucony:', validation.reason);
              // Kontynuuj skanowanie - nie zatrzymuj
            }
          }

          if (error && !(error instanceof NotFoundException)) {
            console.log('⚠️ Błąd skanowania (kontynuuję):', error.message);
          }
        }
      );

      // Zapisz kontrolki do zatrzymania później
      streamRef.current = controls;

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
      console.log('🧹 Czyszczenie efektu skanowania...');
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
    const barcode = prompt('Wprowadź kod kreskowy produktu spożywczego (8, 12 lub 13 cyfr):');
    if (barcode && barcode.trim()) {
      const validation = validatePolishFoodBarcode(barcode.trim());
      
      if (validation.isValid) {
        onDetected(validation.code);
      } else {
        alert(`Nieprawidłowy kod kreskowy: ${validation.reason}\n\n🛒 Produkty spożywcze w Polsce używają:\n• EAN-13 (13 cyfr) - najczęściej\n• EAN-8 (8 cyfr)\n• UPC-A (12 cyfr) - produkty importowane`);
      }
    }
  };

  const toggleDebug = () => {
    setDebugMode(!debugMode);
  };

  if (error) {
    return (
      <div className="scanner-container">
        <div className="scanner-header">
          <h3>❌ Błąd skanera</h3>
          <button onClick={onCancel} className="cancel-button">✕</button>
        </div>
        <div className="scanner-error">
          <p><strong>{error}</strong></p>
          <div style={{ margin: '1rem 0' }}>
            <p><strong>💡 Rozwiązania:</strong></p>
            <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <li>🔒 Kliknij ikonę kamery w pasku adresu</li>
              <li>✅ Wybierz "Zezwól" na dostęp do kamery</li>
              <li>🔄 Odśwież stronę (F5)</li>
              <li>📱 Sprawdź czy inne aplikacje nie używają kamery</li>
              <li>🌐 Użyj przeglądarki Chrome lub Firefox</li>
              <li>🔒 Upewnij się że strona używa HTTPS</li>
            </ul>
          </div>
          <button onClick={handleManualInput} className="button-primary">
            📝 Wprowadź kod ręcznie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <h3>
          {isScanning ? `🛒 Skanowanie ZXing... (${scanAttempts})` : '⏳ Uruchamianie skanera...'}
        </h3>
        <div>
          <button onClick={toggleDebug} className="cancel-button" style={{ marginRight: '10px' }}>
            🔍
          </button>
          <button onClick={onCancel} className="cancel-button">✕</button>
        </div>
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
              ? '🎯 Wyceluj w kod kreskowy produktu' 
              : '⏳ Ładowanie skanera ZXing...'}
          </p>
          {isScanning && (
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <p style={{ fontSize: '0.8rem', color: 'white', background: 'rgba(0,0,0,0.7)', padding: '8px 15px', borderRadius: '15px', margin: '5px' }}>
                🛒 <strong>Skanowanie produktów PL</strong><br/>
                📱 Ustaw kod w centrum ramki<br/>
                💡 Dobra lampka + stabilnie trzymaj
              </p>
              {lastScannedCode && (
                <p style={{ fontSize: '0.7rem', color: '#90EE90', background: 'rgba(0,0,0,0.8)', padding: '5px 10px', borderRadius: '10px', margin: '5px' }}>
                  ⏮️ Ostatni: {lastScannedCode}
                </p>
              )}
            </div>
          )}
        </div>

        {debugMode && (
          <div style={{ 
            position: 'absolute', 
            top: '10px', 
            left: '10px', 
            background: 'rgba(0,0,0,0.9)', 
            padding: '15px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '0.8rem',
            maxWidth: '200px'
          }}>
            <p><strong>🔍 Debug ZXing</strong></p>
            <p>Próby: {scanAttempts}</p>
            <p>Status: {isScanning ? '✅ Skanuje' : '❌ Zatrzymany'}</p>
            <p>Biblioteka: ZXing</p>
            <p>Formaty: EAN-13/8, UPC-A</p>
            {lastScannedCode && <p>Ostatni: {lastScannedCode}</p>}
          </div>
        )}
      </div>
      
      <div className="manual-input">
        <button onClick={handleManualInput} className="button-primary">
          📝 Wprowadź kod ręcznie
        </button>
        <div style={{ marginTop: '15px', fontSize: '0.8rem', color: '#666', textAlign: 'center' }}>
          <p><strong>🛒 Polskie produkty spożywcze:</strong></p>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ margin: '2px' }}>📊 EAN-13 (13 cyfr)</span>
            <span style={{ margin: '2px' }}>📋 EAN-8 (8 cyfr)</span>
            <span style={{ margin: '2px' }}>🇺🇸 UPC-A (12 cyfr)</span>
          </div>
          <p style={{ marginTop: '10px', fontSize: '0.75rem' }}>
            💡 <strong>Wskazówki:</strong> 15-20cm od kodu, dobra lampka, trzymaj spokojnie
          </p>
        </div>
      </div>
    </div>
  );
}

export default BarcodeScanner;
