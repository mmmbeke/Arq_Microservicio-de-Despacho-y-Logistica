import { useEffect, useState } from 'react';
import { Package, Truck, CheckCircle, AlertTriangle, Play, RefreshCw, X } from 'lucide-react';
import { fetchShipments, updateShipmentStatus, confirmDelivery, rejectShipment, reshipShipment } from './api';
import type { Shipment, ShipmentStatus } from './types';
import './index.css';

export default function App() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [actionType, setActionType] = useState<'status' | 'confirm' | 'reject' | 'reship' | null>(null);
  const [driverId, setDriverId] = useState('');
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState('');
  const [newStatus, setNewStatus] = useState<ShipmentStatus>('PICKING');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchShipments();
      setShipments(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !actionType) return;
    
    setSubmitting(true);
    try {
      if (actionType === 'status') {
        await updateShipmentStatus(selectedShipment.shipmentId, newStatus, selectedShipment.version, driverId || undefined);
      } else if (actionType === 'confirm') {
        await confirmDelivery(selectedShipment.shipmentId, signature);
      } else if (actionType === 'reject') {
        await rejectShipment(selectedShipment.shipmentId, reason);
      } else if (actionType === 'reship') {
        await reshipShipment(selectedShipment.shipmentId, reason);
      }
      setSelectedShipment(null);
      setActionType(null);
      setDriverId('');
      setReason('');
      setSignature('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: ShipmentStatus) => {
    switch (status) {
      case 'CREATED': return <Package size={18} />;
      case 'PICKING': return <Play size={18} />;
      case 'ASSIGNED':
      case 'OUT_FOR_DELIVERY': return <Truck size={18} />;
      case 'DELIVERED': return <CheckCircle size={18} />;
      case 'FAILED': return <AlertTriangle size={18} />;
      default: return <Package size={18} />;
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="layout">
      <header className="header">
        <h1>
          <Package className="text-accent" size={32} />
          Fishmarket Cloud
        </h1>
        <button className="btn btn-primary" onClick={loadData}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refrescar
        </button>
      </header>

      {error && (
        <div className="glass" style={{ padding: '1rem', color: 'var(--danger)', marginBottom: '2rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
      )}

      {loading && shipments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando envíos...</div>
      ) : (
        <div className="shipment-grid">
          {shipments.map(s => (
            <div key={s.shipmentId} className={`card glass status-${s.status}`}>
              <div className="card-header">
                <div>
                  <div className="card-title">Order {s.orderId}</div>
                  <div className="card-subtitle">ID: {s.shipmentId.substring(0, 12)}...</div>
                </div>
                <div className={`badge badge-${s.status}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getStatusIcon(s.status)}
                  {s.status}
                </div>
              </div>
              
              <div style={{ marginTop: '10px' }}>
                <div className="detail-row">
                  <Package /> {s.lines?.reduce((acc, l) => acc + l.qty, 0)} items ({s.lines?.[0]?.description})
                </div>
                <div className="detail-row" style={{ marginTop: '6px' }}>
                  <Truck /> {s.shipTo?.city} - {s.shipTo?.street}
                </div>
                <div className="detail-row" style={{ marginTop: '6px' }}>
                  <CheckCircle /> Actualizado: {formatDate(s.updatedAt)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px', flexWrap: 'wrap' }}>
                {['CREATED', 'PICKING', 'ASSIGNED', 'OUT_FOR_DELIVERY'].includes(s.status) && (
                  <button className="btn" style={{ flex: 1 }} onClick={() => {
                    setSelectedShipment(s);
                    setActionType('status');
                    setNewStatus(
                      s.status === 'CREATED' ? 'PICKING' : 
                      s.status === 'PICKING' ? 'ASSIGNED' : 
                      'OUT_FOR_DELIVERY'
                    );
                  }}>
                    Avanzar Estado
                  </button>
                )}
                
                {s.status === 'OUT_FOR_DELIVERY' && (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                    setSelectedShipment(s);
                    setActionType('confirm');
                  }}>
                    Confirmar
                  </button>
                )}

                {!['DELIVERED', 'FAILED'].includes(s.status) && (
                  <button className="btn" style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={() => {
                    setSelectedShipment(s);
                    setActionType('reject');
                  }}>
                    Rechazar
                  </button>
                )}

                {s.status === 'FAILED' && (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                    setSelectedShipment(s);
                    setActionType('reship');
                  }}>
                    Reenviar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedShipment && actionType && (
        <div className="modal-overlay" onClick={() => setSelectedShipment(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {actionType === 'status' ? 'Cambiar Estado' : 
                 actionType === 'confirm' ? 'Confirmar Entrega' :
                 actionType === 'reject' ? 'Rechazar Envío' : 'Reenviar Envío'}
              </h2>
              <button className="close-btn" onClick={() => setSelectedShipment(null)}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAction}>
              {actionType === 'status' && (
                <>
                  <div className="form-group">
                    <label>Nuevo Estado</label>
                    <select 
                      className="form-control"
                      value={newStatus} 
                      onChange={e => setNewStatus(e.target.value as ShipmentStatus)}
                    >
                      <option value="PICKING">PICKING</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                    </select>
                  </div>
                  
                  {newStatus === 'ASSIGNED' && (
                    <div className="form-group">
                      <label>ID del Conductor</label>
                      <input 
                        className="form-control"
                        required 
                        placeholder="Ej: DRV-001"
                        value={driverId} 
                        onChange={e => setDriverId(e.target.value)} 
                      />
                    </div>
                  )}
                </>
              )}

              {actionType === 'confirm' && (
                <div className="form-group">
                  <label>Firma / Prueba de entrega</label>
                  <input 
                    className="form-control"
                    required 
                    placeholder="Ej: Firma de Juan Perez"
                    value={signature} 
                    onChange={e => setSignature(e.target.value)} 
                  />
                </div>
              )}

              {(actionType === 'reject' || actionType === 'reship') && (
                <div className="form-group">
                  <label>Motivo</label>
                  <input 
                    className="form-control"
                    required 
                    placeholder="Ej: Paquete dañado"
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setSelectedShipment(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
