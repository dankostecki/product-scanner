import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';

function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanningRef = useRef(false);
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    let videoStream = null;
    let animationFrame = null;

    const startCamera = async () => {
      try {
        // Najpierw spróbuj z tylną kamerą i wysoką rozdzielczością
        let constraints = {
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 }
          }
        };

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          console.log('Nie można użyć tylnej kamery, próbuję dowolnej...', err);
          // Jeśli tylna kamera nie działa, spróbuj dowolnej
          constraints = {
            video: { 
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            }
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
        
        videoStream = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(() => {
              console.log('Kamera uruchomiona, rozpoczynam skanowanie...');
              setIsScanning(true);
              scanningRef.current = true;
              // Małe opóźnienie przed rozpoczęciem skanowania
              setTimeout(() => {
                scanForBarcode();
              }, 500);
            }).catch(err => {
              console.error('Błąd odtwarzania wideo:', err);
              setError('Nie można uruchomić podglądu kamery');
            });
          };

          videoRef.current.onerror = (err) => {
            console.error('Błąd wideo:', err);
            setError('Błąd podczas ładowania wideo');
          };
        }
      } catch (err) {
        console.error('Błąd dostępu do kamery:', err);
        let errorMessage = 'Nie można uzyskać dostępu do kamery.';
        
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Dostęp do kamery został odrzucony. Sprawdź uprawnienia w przeglądarce.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Nie znaleziono kamery w urządzeniu.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage = 'Kamera nie jest obsługiwana przez przeglądarkę.';
        }
        
        setError(errorMessage);
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
        // Ustaw rozmiar canvas na rozmiar wideo
        const { videoWidth, videoHeight } = video;
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        
        // Narysuj obecną klatkę wideo na canvas
        context.drawImage(video, 0, 0, videoWidth, videoHeight);
        
        // Pobierz dane obrazu
        const imageData = context.getImageData(0, 0, videoWidth, videoHeight);
        
        // Spróbuj znaleźć kod QR/kreskowy
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert", // Optymalizacja - nie odwracaj kolorów
        });
        
        if (code && code.data) {
          // Dodaj throttling - nie skanuj częściej niż co 100ms
          const now = Date.now();
          if (now - lastScanTimeRef.current > 100) {
            console.log('Znaleziono kod:', code.data);
            lastScanTimeRef.current = now;
            
            // Sprawdź czy kod wygląda na kod kreskowy produktu (8-14 cyfr)
            const cleanCode = code.data.replace(/\D/g, ''); // Usuń wszystko co nie jest cyfrą
            if (cleanCode.length >= 8 && cleanCode.length <= 14) {
              console.log('Kod zaakceptowany:', cleanCode);
              scanningRef.current = false;
              setIsScanning(false);
              onDetected(cleanCode);
              return;
            } else {
              console.log('Kod odrzucony (nieprawidłowa długość):', code.data);
            }
          }
        }
      }

      // Kontynuuj skanowanie z mniejszą częstotliwością (około 30 FPS)
      animationFrame = requestAnimationFrame(scanForBarcode);
    };

    startCamera();

    return () => {
      console.log('Czyszczenie skanera...');
      // Zatrzymaj skanowanie
      scanningRef.current = false;
      setIsScanning(false);
      
      // Zatrzymaj animację
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      // Zatrzymaj strumień video
      if (videoStream) {
        videoStream.getTracks().forEach(track => {
          track.stop();
          console.log('Zatrzymano track:', track.kind);
        });
      }
    };
  }, [onDetected]);

  const handleManualInput = () => {
    const barcode = prompt('Wprowadź kod kreskowy ręcznie (8-14 cyfr):');
    if (barcode) {
      const cleanCode = barcode.replace(/\D/g, '');
      if (cleanCode.length >= 8 && cleanCode.length <= 14) {
        onDetected(cleanCode);
      } else {
        alert('Kod kreskowy musi mieć od 8 do 14 cyfr');
      }
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
              <li>Kliknij ikonę kamery w pasku adresu i zezwól na dostęp</li>
              <li>Sprawdź czy inne aplikacje nie używają kamery</li>
              <li>Spróbuj odświeżyć stronę (F5)</li>
              <li>Użyj przeglądarki Chrome lub Firefox</li>
              <li>Upewnij się, że strona używa HTTPS</li>
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
          {isScanning ? '📱 Skanowanie aktywne...' : '⏳ Uruchamianie kamery...'}
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
          autoPlay
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
              ? '🎯 Wyceluj w kod kreskowy' 
              : '⏳ Ładowanie kamery...'}
          </p>
          {isScanning && (
            <p className="scanner-instruction" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Trzymaj telefon stabilnie, kod musi być wyraźny
            </p>
          )}
        </div>
      </div>
      
      <div className="manual-input">
        <button onClick={handleManualInput} className="button-secondary">
          📝 Wprowadź kod ręcznie
        </button>
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#666' }}>
          Sprawdź czy kamera ma dostęp do dobrze oświetlonego kodu
        </p>
      </div>
    </div>
  );
}

export default BarcodeScanner;
