import React, { useState } from 'react';
import BarcodeScanner from './components/BarcodeScanner';
import ProductDisplay from './components/ProductDisplay';
import './App.css';

function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [productData, setProductData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obsługa wykrytego kodu kreskowego
  const handleBarcodeDetected = async (barcode) => {
    setIsScanning(false);
    setIsLoading(true);
    setError(null);
    
    try {
      // Pobierz dane produktu z Open Food Facts
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1) {
        setProductData({
          barcode: barcode,
          name: data.product.product_name || 'Nieznana nazwa',
          brand: data.product.brands || 'Nieznana marka',
          image: data.product.image_url || null,
          categories: data.product.categories || 'Brak kategorii',
          ingredients: data.product.ingredients_text || 'Brak informacji o składnikach',
          nutrition: {
            energy: data.product.nutriments?.energy_100g || 'Brak danych',
            fat: data.product.nutriments?.fat_100g || 'Brak danych',
            carbohydrates: data.product.nutriments?.carbohydrates_100g || 'Brak danych',
            proteins: data.product.nutriments?.proteins_100g || 'Brak danych'
          }
        });
      } else {
        setError('Produkt nie został znaleziony w bazie danych');
      }
    } catch (err) {
      console.error('Błąd podczas pobierania danych produktu:', err);
      setError('Wystąpił błąd podczas pobierania danych produktu');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset aplikacji
  const handleReset = () => {
    setProductData(null);
    setError(null);
    setIsScanning(false);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🛒 Skaner Produktów</h1>
        <p>Zeskanuj kod kreskowy, aby zobaczyć informacje o produkcie</p>
      </header>

      <main className="app-main">
        {isLoading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Wyszukuję produkt...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>❌ {error}</p>
            <button onClick={handleReset} className="button-secondary">
              Spróbuj ponownie
            </button>
          </div>
        )}

        {!isScanning && !productData && !isLoading && !error && (
          <div className="start-screen">
            <div className="scan-icon">📱</div>
            <button 
              onClick={() => setIsScanning(true)} 
              className="button-primary"
            >
              Rozpocznij skanowanie
            </button>
          </div>
        )}

        {isScanning && (
          <BarcodeScanner 
            onDetected={handleBarcodeDetected}
            onCancel={() => setIsScanning(false)}
          />
        )}

        {productData && (
          <ProductDisplay 
            product={productData}
            onScanAgain={() => setIsScanning(true)}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;
