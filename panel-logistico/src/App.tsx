import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Package, Truck, CheckCircle, AlertCircle, MapPin, Clock, RefreshCw, Sun, Moon } from 'lucide-react';
import { fetchShipments } from './api';
import type { Shipment, ShipmentStatus } from './api';

const StatusBadge = ({ status }: { status: ShipmentStatus }) => {
  const icons: Record<ShipmentStatus, ReactNode> = {
    CREATED: <Clock size={14} />,
    PICKING: <Package size={14} />,
    ASSIGNED: <MapPin size={14} />,
    OUT_FOR_DELIVERY: <Truck size={14} />,
    DELIVERED: <CheckCircle size={14} />,
    FAILED: <AlertCircle size={14} />,
  };

  const cssVarPrefix = status.toLowerCase().replace(/_/g, '-');

  return (
    <span style={{ 
      display: 'inline-flex', alignItems: 'center', gap: '6px', 
      padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
      whiteSpace: 'nowrap',
      backgroundColor: `var(--status-${cssVarPrefix}-bg)`,
      color: `var(--status-${cssVarPrefix}-text)`
    }}>
      {icons[status]} {status.replace(/_/g, ' ')}
    </span>
  );
};

export default function App() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.documentElement.classList.add('light-mode');
      document.body.classList.add('light-mode');
    }
  }, [isDarkMode]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchShipments();
      setShipments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="container animate-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ color: 'var(--color-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '2rem' }}>
            <Truck size={32} /> FishMarket Logística
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0 0', fontSize: '1.1rem' }}>Panel de Control de Envíos</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', boxShadow: 'none' }}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
          </button>
          <button onClick={loadData} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--status-failed-text)', color: 'var(--status-failed-text)', marginBottom: '2rem' }}>
          <strong>Error de conexión:</strong> {error}. Asegúrate de que el backend esté corriendo en el puerto 3007.
        </div>
      )}

      <div className="list-wrapper">
        <div className="list-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={16} /> 
            <span>Registro logístico (Últimos movimientos)</span>
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
            {shipments.length} Envíos registrados
          </div>
        </div>

        <div className="list-header-row">
          <div className="list-col-main">Identificador / Orden</div>
          <div className="list-col-desc">Dirección de Destino</div>
          <div className="list-col-status">Estado Actual</div>
          <div className="list-col-time">Última Act.</div>
        </div>
        
        {shipments.map(shipment => (
          <div key={shipment.shipmentId} className="list-row">
            <div className="list-col-main">
              <Package size={16} style={{ color: 'var(--color-text-muted)' }} />
              <div>
                <a href="#" className="list-title">Envío #{shipment.shipmentId.slice(0, 8)}</a>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Orden: {shipment.orderId}</div>
              </div>
            </div>
            
            <div className="list-col-desc">
              Destino: {shipment.shipTo.addressLine1}, {shipment.shipTo.city}
            </div>

            <div className="list-col-status">
              <StatusBadge status={shipment.status} />
            </div>
            
            <div className="list-col-time">
              {new Date(shipment.updatedAt).toLocaleTimeString()}
            </div>
          </div>
        ))}

        {shipments.length === 0 && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            <Package size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
            <p>Todavía no hay envíos registrados en el sistema.</p>
          </div>
        )}
      </div>
      <style>
        {`
          .spinning { animation: spin 1s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}
      </style>
    </div>
  );
}
