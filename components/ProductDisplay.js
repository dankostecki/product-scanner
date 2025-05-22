import React from 'react';

function ProductDisplay({ product, onScanAgain, onReset }) {
  return (
    <div className="product-display">
      <div className="product-header">
        <h2>Informacje o produkcie</h2>
        <div className="product-barcode">
          Kod: {product.barcode}
        </div>
      </div>

      <div className="product-content">
        {product.image && (
          <div className="product-image">
            <img src={product.image} alt={product.name} />
          </div>
        )}

        <div className="product-details">
          <div className="product-basic">
            <h3 className="product-name">{product.name}</h3>
            {product.brand && (
              <p className="product-brand">Marka: {product.brand}</p>
            )}
            {product.categories && (
              <p className="product-categories">
                Kategorie: {product.categories}
              </p>
            )}
          </div>

          <div className="product-nutrition">
            <h4>Wartości odżywcze (na 100g):</h4>
            <div className="nutrition-grid">
              <div className="nutrition-item">
                <span className="nutrition-label">Energia:</span>
                <span className="nutrition-value">
                  {product.nutrition.energy !== 'Brak danych' 
                    ? `${product.nutrition.energy} kJ` 
                    : 'Brak danych'}
                </span>
              </div>
              <div className="nutrition-item">
                <span className="nutrition-label">Tłuszcze:</span>
                <span className="nutrition-value">
                  {product.nutrition.fat !== 'Brak danych' 
                    ? `${product.nutrition.fat} g` 
                    : 'Brak danych'}
                </span>
              </div>
              <div className="nutrition-item">
                <span className="nutrition-label">Węglowodany:</span>
                <span className="nutrition-value">
                  {product.nutrition.carbohydrates !== 'Brak danych' 
                    ? `${product.nutrition.carbohydrates} g` 
                    : 'Brak danych'}
                </span>
              </div>
              <div className="nutrition-item">
                <span className="nutrition-label">Białka:</span>
                <span className="nutrition-value">
                  {product.nutrition.proteins !== 'Brak danych' 
                    ? `${product.nutrition.proteins} g` 
                    : 'Brak danych'}
                </span>
              </div>
            </div>
          </div>

          {product.ingredients && product.ingredients !== 'Brak informacji o składnikach' && (
            <div className="product-ingredients">
              <h4>Składniki:</h4>
              <p>{product.ingredients}</p>
            </div>
          )}
        </div>
      </div>

      <div className="product-actions">
        <button onClick={onScanAgain} className="button-primary">
          Skanuj kolejny produkt
        </button>
        <button onClick={onReset} className="button-secondary">
          Rozpocznij od nowa
        </button>
      </div>
    </div>
  );
}

export default ProductDisplay;
