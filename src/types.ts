export interface Studio {
  id: number;
  name: string;
  description: string;
  image_url: string;
  capacity: number;
}

export interface Booking {
  id: number | string;
  studio_id: number;
  studio_name?: string;
  student_name: string;
  student_id: string;
  phone_number: string;
  organization: string;
  request_letter_path?: string;
  drive_url?: string;
  date: string;
  start_time: string;
  end_time: string;
  user_type: 'Mahasiswa' | 'Dosen' | 'Tendik' | 'Eksternal';
  status: 'pending' | 'confirmed' | 'cancelled';
  source?: 'live' | 'local_fallback' | 'local_pending';
}
