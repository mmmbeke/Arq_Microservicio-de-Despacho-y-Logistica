import { getSupabase, hasSupabaseEnv } from '../config/supabase';

export interface DriverRow {
  driver_id: string;
  driver_name: string;
  phone: string;
  vehicle: string;
  status: string;
  created_at: string;
}

const mockDrivers: DriverRow[] = [
  { driver_id: 'DRV-001', driver_name: 'Conductor Mock 1', phone: '123', vehicle: 'Moto', status: 'AVAILABLE', created_at: new Date().toISOString() },
  { driver_id: 'DRV-002', driver_name: 'Conductor Mock 2', phone: '456', vehicle: 'Auto', status: 'AVAILABLE', created_at: new Date().toISOString() }
];

export async function getDriverById(driverId: string): Promise<DriverRow | null> {
  if (!hasSupabaseEnv()) {
    const driver = mockDrivers.find(d => d.driver_id === driverId);
    return driver || null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();

  if (error) {
    console.error(`Supabase getDriverById error: ${error.message}`);
    return null;
  }
  
  if (!data) return null;
  
  return data as DriverRow;
}

export async function getAllDrivers(): Promise<DriverRow[]> {
  if (!hasSupabaseEnv()) {
    return [...mockDrivers];
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from('drivers').select('*').order('driver_name', { ascending: true });
  if (error) {
    console.error(`Supabase getAllDrivers error: ${error.message}`);
    return [];
  }
  return (data as DriverRow[]) || [];
}

export async function updateDriverStatus(driverId: string, status: string): Promise<boolean> {
  if (!hasSupabaseEnv()) {
    const driver = mockDrivers.find(d => d.driver_id === driverId);
    if (driver) {
      driver.status = status;
      return true;
    }
    return false;
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('drivers')
    .update({ status })
    .eq('driver_id', driverId);

  if (error) {
    console.error(`Supabase updateDriverStatus error: ${error.message}`);
    return false;
  }
  return true;
}
