import { useEffect, useState } from 'react';
import { Package, Truck, CheckCircle, AlertTriangle, Play, RefreshCw, X } from 'lucide-react';
import { fetchShipments, updateShipmentStatus, confirmDelivery, rejectShipment, fetchDrivers } from './api';
import type { Shipment, ShipmentStatus } from './types';
import './index.css';

export default function App() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [drivers, setDrivers] = useState<{driver_id: string, driver_name: string, status: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [viewingShipment, setViewingShipment] = useState<Shipment | null>(null);
  const [actionType, setActionType] = useState<'status' | 'confirm' | 'reject' | null>(null);
  const [driverId, setDriverId] = useState('');
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState('');
  const [newStatus, setNewStatus] = useState<ShipmentStatus>('PICKING');
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ShipmentStatus | 'ALL'>('ALL');

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, drvData] = await Promise.all([fetchShipments(), fetchDrivers()]);
      setShipments(data);
      setDrivers(drvData);
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
        await confirmDelivery(selectedShipment.shipmentId, signature, selectedShipment.version);
      } else if (actionType === 'reject') {
        await rejectShipment(selectedShipment.shipmentId, reason, selectedShipment.version);
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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)', marginRight: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Filtrar por estado:</span>
        {['ALL', 'CREATED', 'PICKING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'].map(status => {
          const isSelected = filterStatus === status;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`badge ${status !== 'ALL' ? 'badge-' + status : ''}`}
              style={{
                cursor: 'pointer',
                opacity: isSelected ? 1 : 0.4,
                transition: 'all 0.2s ease',
                border: isSelected ? '1px solid currentColor' : '1px solid transparent',
                background: status === 'ALL' ? 'rgba(255, 255, 255, 0.05)' : undefined,
                color: status === 'ALL' ? 'var(--text-primary)' : undefined,
                boxShadow: isSelected && status !== 'ALL' ? '0 0 10px currentColor' : 'none',
                outline: 'none'
              }}
            >
              {status === 'ALL' ? 'TODOS' : status.replace(/_/g, ' ')}
            </button>
          )
        })}
      </div>

      {loading && shipments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando envíos...</div>
      ) : (
        <div className="shipment-grid">
          {(filterStatus === 'ALL' ? shipments : shipments.filter(s => s.status === filterStatus)).length === 0 ? (
            <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '3rem', color: 'var(--text-secondary)' }}>
              No hay envíos que coincidan con este estado.
            </div>
          ) : (
            (filterStatus === 'ALL' ? shipments : shipments.filter(s => s.status === filterStatus)).map(s => (
              <div 
                key={s.shipmentId} 
                className={`card glass status-${s.status}`}
                onClick={() => setViewingShipment(s)}
                style={{ cursor: 'pointer' }}
              >
              <div className="card-header">
                <div>
                  <div className="card-title" title={`Order ${s.orderId}`}>
                    Order {s.orderId.length > 12 ? s.orderId.substring(0, 12) + '...' : s.orderId}
                  </div>
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
                  <button className="btn" style={{ flex: 1 }} onClick={(e) => {
                    e.stopPropagation();
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
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={(e) => {
                    e.stopPropagation();
                    setSelectedShipment(s);
                    setActionType('confirm');
                  }}>
                    Confirmar
                  </button>
                )}

                {!['DELIVERED', 'FAILED'].includes(s.status) && (
                  <button className="btn" style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={(e) => {
                    e.stopPropagation();
                    setSelectedShipment(s);
                    setActionType('reject');
                  }}>
                    Rechazar
                  </button>
                )}

              </div>
            </div>
          )))}
        </div>
      )}

      {selectedShipment && actionType && (
        <div className="modal-overlay" onClick={() => setSelectedShipment(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {actionType === 'status' ? 'Cambiar Estado' : 
                 actionType === 'confirm' ? 'Confirmar Entrega' :
                 'Rechazar Envío'}
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
                      <label>Conductor</label>
                      <select 
                        className="form-control"
                        required 
                        value={driverId} 
                        onChange={e => setDriverId(e.target.value)} 
                      >
                        <option value="">-- Selecciona un conductor --</option>
                        {drivers.filter(d => d.status === 'AVAILABLE').map(d => (
                          <option key={d.driver_id} value={d.driver_id}>
                            {d.driver_name} ({d.driver_id})
                          </option>
                        ))}
                      </select>
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

              {actionType === 'reject' && (
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

      {viewingShipment && (
        <div className="modal-overlay" onClick={() => setViewingShipment(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Detalles del Pedido</h2>
              <button className="close-btn" onClick={() => setViewingShipment(null)}>
                <X size={24} />
              </button>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '70vh', paddingRight: '8px' }}>
              <div className="detail-row"><strong>ID Envío:</strong> {viewingShipment.shipmentId}</div>
              <div className="detail-row"><strong>ID Pedido:</strong> {viewingShipment.orderId}</div>
              <div className="detail-row"><strong>Usuario:</strong> {viewingShipment.userId}</div>
              <div className="detail-row" style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ marginRight: '8px' }}>Estado:</strong> 
                <span className={`badge badge-${viewingShipment.status}`} style={{ padding: '2px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {getStatusIcon(viewingShipment.status)}
                  {viewingShipment.status}
                </span>
              </div>
              <div className="detail-row"><strong>Conductor Asignado:</strong> {viewingShipment.driverName || viewingShipment.driverId || 'Ninguno'}</div>
              
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginTop: '8px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={16} /> Dirección de Entrega
                </h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <div>{viewingShipment.shipTo?.name}</div>
                  <div>{viewingShipment.shipTo?.street} {viewingShipment.shipTo?.addressLine1}</div>
                  <div>{viewingShipment.shipTo?.city}, {viewingShipment.shipTo?.zip}</div>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={16} /> Productos ({viewingShipment.lines?.reduce((acc, l) => acc + l.qty, 0)})
                </h3>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {viewingShipment.lines?.map((line, idx) => (
                    <li key={idx}>{line.qty}x {line.description} (SKU: {line.sku})</li>
                  ))}
                </ul>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div><strong>Creado:</strong> {formatDate(viewingShipment.createdAt)}</div>
                <div><strong>Actualizado:</strong> {formatDate(viewingShipment.updatedAt)}</div>
                {viewingShipment.deliveredAt && (
                  <div style={{ gridColumn: '1 / -1' }}><strong>Entregado:</strong> {formatDate(viewingShipment.deliveredAt)}</div>
                )}
                {viewingShipment.reshipOf && (
                  <div style={{ gridColumn: '1 / -1' }}><strong>Reenvío de:</strong> {viewingShipment.reshipOf}</div>
                )}
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn btn-primary" onClick={() => setViewingShipment(null)} style={{ width: '100%' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
