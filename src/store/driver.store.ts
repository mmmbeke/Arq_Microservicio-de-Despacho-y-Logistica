import { getSupabase, hasSupabaseEnv } from '../config/supabase';

export interface DriverRow {
  driver_id: string;
  driver_name: string;
  phone: string;
  vehicle: string;
  status: string;
  created_at: string;
}

export async function getDriverById(driverId: string): Promise<{ driverName: string } | null> {
  if (!hasSupabaseEnv()) {
    // If running in memory mode without Supabase, we just simulate a driver exists for testing
    return { driverName: 'Conductor Mock' };
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
  
  return { driverName: (data as DriverRow).driver_name };
}

export async function getAllDrivers(): Promise<DriverRow[]> {
  if (!hasSupabaseEnv()) {
    return [
      { driver_id: 'DRV-001', driver_name: 'Conductor Mock 1', phone: '123', vehicle: 'Moto', status: 'AVAILABLE', created_at: '' },
      { driver_id: 'DRV-002', driver_name: 'Conductor Mock 2', phone: '456', vehicle: 'Auto', status: 'AVAILABLE', created_at: '' }
    ];
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from('drivers').select('*').order('driver_name', { ascending: true });
  if (error) {
    console.error(`Supabase getAllDrivers error: ${error.message}`);
    return [];
  }
  return (data as DriverRow[]) || [];
}

