import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';

function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const debugCanvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const scanningRef = useRef(false);

  // Funkcja do skanowania kodów kreskowych z ulepszoną detekcją
  const scanForBarcode = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const { videoWidth, videoHeight } = video;
      
      if (videoWidth === 0 || videoHeight === 0) {
        console.log('Wideo nie ma jeszcze wymiarów, czekam...');
        requestAnimationFrame(scanForBarcode);
        return;
      }

      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Narysuj obecną klatkę
      context.drawImage(video, 0, 0, videoWidth, videoHeight);
      
      // Debug: pokaż co widzi kamera
      if (debugMode && debugCanvasRef.current) {
        const debugCanvas = debugCanvasRef.current;
        const debugContext = debugCanvas.getContext('2d');
        debugCanvas.width = videoWidth / 4; // Mniejszy rozmiar dla debug
        debugCanvas.height = videoHeight / 4;
        debugContext.drawImage(video, 0, 0, debugCanvas.width, debugCanvas.height);
      }

      // Zwiększ licznik prób
      setScanAttempts(prev => {
        const newCount = prev + 1;
        
        // Loguj co pewien czas próby skanowania
        if (newCount % 60 === 0) { // Co ~2 sekundy przy 30 FPS
          console.log(`📱 Skanowanie aktywne... próba ${newCount}. Rozdzielczość: ${videoWidth}x${videoHeight}`);
        }
        
        return newCount;
      });

      try {
        // Pobierz dane obrazu z różnych regionów
        const regions = [
          // Cały obraz
          { x: 0, y: 0, width: videoWidth, height: videoHeight },
          // Środkowa część (tam gdzie jest ramka)
          { 
            x: Math.floor(videoWidth * 0.2), 
            y: Math.floor(videoHeight * 0.3), 
            width: Math.floor(videoWidth * 0.6), 
            height: Math.floor(videoHeight * 0.4) 
          },
          // Jeszcze mniejszy środek
          { 
            x: Math.floor(videoWidth * 0.3), 
            y: Math.floor(videoHeight * 0.4), 
            width: Math.floor(videoWidth * 0.4), 
            height: Math.floor(videoHeight * 0.2) 
          }
        ];

        for (const region of regions) {
          const imageData = context.getImageData(region.x, region.y, region.width, region.height);
          
          // Spróbuj jsQR z różnymi opcjami
          const qrOptions = [
            { inversionAttempts: "dontInvert" },
            { inversionAttempts: "onlyInvert" },
            { inversionAttempts: "attemptBoth" }
          ];

          for (const options of qrOptions) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, options);
            
            if (code && code.data) {
              console.log('🎉 Znaleziono kod:', code.data);
              
              // Sprawdź różne formaty kodów produktowych
              const cleanCode = code.data.replace(/\D/g, '');
              const originalCode = code.data.trim();
              
              // Akceptuj różne formaty
              const isValidBarcode = (
                // Standardowe kody kreskowe (8-14 cyfr)
                (cleanCode.length >= 8 && cleanCode.length <= 14) ||
                // Kody z prefiksami
                originalCode.match(/^(EAN|UPC|ISBN)?\s*\d{8,14}$/i) ||
                // Kody mieszane (cyfry i litery)
                originalCode.match(/^[A-Z0-9]{8,20}$/i)
              );

              if (isValidBarcode) {
                console.log('✅ Kod zaakceptowany:', cleanCode || originalCode);
                scanningRef.current = false;
                setIsScanning(false);
                onDetected(cleanCode || originalCode);
                return;
              } else {
                console.log('❌ Kod odrzucony (format):', originalCode, 'Długość czystych cyfr:', cleanCode.length);
              }
            }
          }
        }

      } catch (scanError) {
        console.error('Błąd podczas skanowania:', scanError);
      }
    } else {
      console.log('Wideo nie jest gotowe, readyState:', video.readyState);
    }

    // Kontynuuj skanowanie
    requestAnimationFrame(scanForBarcode);
  }, [debugMode, onDetected]);

  useEffect(() => {
    let videoStream = null;

    const startCamera = async () => {
      try {
        // Spróbuj różnych konfiguracji kamery
        const constraints = [
          // Konfiguracja 1: Tylna kamera z wysoką rozdzielczością
          {
            video: { 
              facingMode: 'environment',
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 },
              focusMode: 'continuous'
            }
          },
          // Konfiguracja 2: Tylna kamera z niższą rozdzielczością
          {
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            }
          },
          // Konfiguracja 3: Dowolna kamera
          {
            video: { 
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            }
          },
          // Konfiguracja 4: Podstawowa
          {
            video: true
          }
        ];

        let stream = null;
        let lastError = null;

        for (const constraint of constraints) {
          try {
            console.log('Próbuję konfigurację kamery:', constraint);
            stream = await navigator.mediaDevices.getUserMedia(constraint);
            console.log('Sukces z konfiguracją:', constraint);
            break;
          } catch (err) {
            console.log('Niepowodzenie z konfiguracją:', constraint, err);
            lastError = err;
          }
        }

        if (!stream) {
          throw lastError || new Error('Nie można uruchomić żadnej konfiguracji kamery');
        }
        
        videoStream = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadedmetadata = () => {
            console.log('Metadane wideo załadowane');
            console.log('Rozdzielczość wideo:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
            
            videoRef.current.play().then(() => {
              console.log('Wideo rozpoczęte, uruchamiam skanowanie...');
              setIsScanning(true);
              scanningRef.current = true;
              setTimeout(() => {
                scanForBarcode();
              }, 1000); // Dłuższe opóźnienie
            }).catch(err => {
              console.error('Błąd odtwarzania wideo:', err);
              setError('Nie można uruchomić podglądu kamery');
            });
          };
        }
      } catch (err) {
        console.error('Błąd dostępu do kamery:', err);
        let errorMessage = 'Nie można uzyskać dostępu do kamery.';
        
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Dostęp do kamery został odrzucony. Kliknij ikonę kamery w pasku adresu i zezwól na dostęp.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Nie znaleziono kamery w urządzeniu.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage = 'Kamera nie jest obsługiwana przez przeglądarkę.';
        }
        
        setError(errorMessage);
      }
    };

    startCamera();

    return () => {
      console.log('🧹 Czyszczenie skanera...');
      scanningRef.current = false;
      setIsScanning(false);
      
      if (videoStream) {
        videoStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [scanForBarcode]);

  const handleManualInput = () => {
    const barcode = prompt('Wprowadź kod kreskowy ręcznie:');
    if (barcode && barcode.trim()) {
      onDetected(barcode.trim());
    }
  };

  const toggleDebug = () => {
    setDebugMode(!debugMode);
  };

  if (error) {
    return (
      <div className="scanner-container">
        <div className="scanner-header">
          <h3>❌ Błąd kamery</h3>
          <button onClick={onCancel} className="cancel-button">✕</button>
        </div>
        <div className="scanner-error">
          <p><strong>{error}</strong></p>
          <div style={{ margin: '1rem 0' }}>
            <p><strong>Rozwiązania:</strong></p>
            <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <li>Kliknij ikonę 🔒 lub 📷 w pasku adresu</li>
              <li>Wybierz "Zezwól" na dostęp do kamery</li>
              <li>Odśwież stronę (F5)</li>
              <li>Sprawdź czy inne aplikacje nie blokują kamery</li>
              <li>Użyj przeglądarki Chrome lub Firefox</li>
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
          {isScanning ? `📱 Skanowanie... (${scanAttempts})` : '⏳ Uruchamianie...'}
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
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        <div className="scanner-overlay">
          <div className="scanner-frame"></div>
          <p className="scanner-instruction">
            {isScanning 
              ? '🎯 Skieruj na kod kreskowy' 
              : '⏳ Ładowanie...'}
          </p>
          {isScanning && (
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <p style={{ fontSize: '0.8rem', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '10px' }}>
                💡 Ustaw kod w środku ramki<br/>
                📱 Trzymaj stabilnie<br/>
                💡 Sprawdź oświetlenie
              </p>
            </div>
          )}
        </div>

        {debugMode && (
          <div style={{ 
            position: 'absolute', 
            top: '10px', 
            left: '10px', 
            background: 'rgba(0,0,0,0.8)', 
            padding: '10px',
            borderRadius: '5px',
            color: 'white',
            fontSize: '0.8rem'
          }}>
            <p>🔍 Tryb debug aktywny</p>
            <p>Próby: {scanAttempts}</p>
            <canvas 
              ref={debugCanvasRef}
              style={{ 
                border: '1px solid white', 
                maxWidth: '100px',
                display: 'block',
                marginTop: '5px'
              }}
            />
          </div>
        )}
      </div>
      
      <div className="manual-input">
        <button onClick={handleManualInput} className="button-primary">
          📝 Wprowadź kod ręcznie
        </button>
        <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
          <p>💡 <strong>Wskazówki:</strong></p>
          <p>• Ustaw telefon 15-20cm od kodu</p>
          <p>• Sprawdź czy kod jest ostry i dobrze oświetlony</p>
          <p>• Spróbuj różnych kątów</p>
          <p>• Włącz tryb debug (🔍) aby zobaczyć co widzi kamera</p>
        </div>
      </div>
    </div>
  );
}

export default BarcodeScanner;
