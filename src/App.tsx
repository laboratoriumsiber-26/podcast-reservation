/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic2,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  ChevronRight,
  Trash2,
  LayoutDashboard,
  Info,
  ShieldCheck,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  FileText,
  Upload,
  RefreshCw,
  Music,
  Zap,
  Award,
  Star,
  Play,
  ArrowRight
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  isToday,
  startOfDay,
  parseISO
} from 'date-fns';
import { Studio, Booking } from './types';

// Constants
const SESSIONS = [
  { id: 1, name: 'Session 1', start: '09:00', end: '10:30', charge: false },
  { id: 2, name: 'Session 2', start: '13:00', end: '14:30', charge: false },
  { id: 3, name: 'Session 3', start: '14:30', end: '16:00', charge: false },
];

const ALL_SLOTS = [...SESSIONS];

const HEAD_LAB_WA = "6282170735157";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz--PmcfbLf0pvlUejBYagCB_ewYxSyFFMOj-BPMFdwZFkv1XEd-LEu2wAVEnQrMb19/exec";

// Helpers
const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatWhatsAppNumber = (phoneNumber: string | number) => {
  let cleaned = String(phoneNumber).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('62')) return cleaned;
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.length > 0 && cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
};

const formatDateDisplay = (dateStr: string, locale: string = 'en-US') => {
  if (!dateStr) return '-';
  // Handle ISO string or YYYY-MM-DD
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [year, month, day] = datePart.split('-').map(Number);
  // Create date in local time to avoid UTC shift
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
};

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
};

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [isAdmin, setIsAdmin] = useState(window.location.hash === '#/admin');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminTab, setAdminTab] = useState<'studios' | 'bookings' | 'availability'>('studios');
  const [studios, setStudios] = useState<Studio[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'studios' | 'reservasi' | 'availability'>('studios');
  const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | number | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState<string | number | null>(null);

  // Admin Studio Form State
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [editingStudio, setEditingStudio] = useState<Studio | null>(null);
  const [studioFormData, setStudioFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    capacity: 4
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdmin(window.location.hash === '#/admin');
    };
    window.addEventListener('hashchange', handleLocationChange);
    return () => window.removeEventListener('hashchange', handleLocationChange);
  }, []);

  const navigateTo = (path: string) => {
    window.location.hash = path === '/' ? '' : path;
    setIsAdmin(path === '/admin');
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const onDateClick = (day: Date) => {
    if (isWeekend(day)) {
      showNotification('Maaf, studio tidak tersedia di akhir pekan.', 'error');
      return;
    }
    setFormData({ ...formData, date: format(day, 'yyyy-MM-dd') });
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'labsiber2026') {
      setAdminAuthenticated(true);
      showNotification('Login Admin berhasil');
    } else {
      showNotification('Password salah', 'error');
    }
  };

  const handleUpdateAvailableDates = async (dates: string[]) => {
    try {
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateAvailableDates', dates })
      });
      if (res.ok) {
        showNotification('Ketersediaan tanggal berhasil diperbarui');
        fetchData();
      }
    } catch (error) {
      showNotification('Gagal memperbarui ketersediaan', 'error');
    }
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        const dateStr = getLocalDateString(cloneDay);
        const isSelected = isSameDay(day, parseISO(formData.date));
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isPast = startOfDay(day) < startOfDay(new Date());
        const isWeekendDay = isWeekend(day);
        const isAvailable = availableDates.includes(dateStr);

        // If admin, they can toggle any day except weekend
        // If user, they can only pick what admin enabled
        const canSelect = isAdmin ? !isWeekendDay : (isAvailable && !isPast);

        // Check if any studio is fully booked on this day
        const dayBookings = bookings.filter(b => {
          if (!b.date) return false;
          const bDate = b.date.toString().includes('T') ? b.date.toString().split('T')[0] : b.date.toString().trim();
          return bDate === dateStr;
        });

        days.push(
          <div
            key={day.toString()}
            className={`
              relative h-14 sm:h-20 border-r border-b border-zinc-200 dark:border-zinc-800/50 p-2 transition-all
              ${!isCurrentMonth ? 'text-zinc-400 dark:text-zinc-700 bg-zinc-50 dark:bg-zinc-900/20' :
                isWeekendDay ? 'bg-red-50 dark:bg-red-900/10 text-red-400 dark:text-red-900/40 cursor-not-allowed' :
                  isAvailable ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' :
                    'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'}
              ${isSelected ? 'bg-emerald-50 dark:bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400' : ''}
              ${!canSelect && !isAdmin ? 'opacity-20 grayscale cursor-not-allowed' : 'cursor-pointer'}
            `}
            onClick={() => {
              if (isAdmin) {
                if (isWeekendDay) return;
                const newDates = availableDates.includes(dateStr)
                  ? availableDates.filter(d => d !== dateStr)
                  : [...availableDates, dateStr];
                handleUpdateAvailableDates(newDates);
              } else if (canSelect) {
                onDateClick(cloneDay);
              }
            }}
          >
            <span className={`text-xs font-bold ${isToday(day) ? 'bg-emerald-500 text-black px-1.5 py-0.5 rounded-md' : ''}`}>
              {formattedDate}
            </span>
            {isCurrentMonth && !isWeekendDay && (
              <div className="mt-1 flex flex-wrap gap-1">
                {isAvailable && !isAdmin && !isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
                {dayBookings.length > 0 ? (
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden flex mt-1">
                    {(() => {
                      const confirmedCount = dayBookings.filter(b => b.status === 'confirmed' || b.status === 'acc').length;
                      const pendingCount = dayBookings.length - confirmedCount;
                      const total = studios.length * ALL_SLOTS.length;

                      return (
                        <>
                          <div
                            className="h-full bg-red-500"
                            style={{ width: `${(confirmedCount / total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${(pendingCount / total) * 100}%` }}
                          />
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            )}
            {isSelected && (
              <motion.div
                layoutId="activeDay"
                className="absolute inset-0 border-2 border-emerald-500 rounded-sm pointer-events-none"
              />
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{format(currentMonth, 'MMMM yyyy')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 bg-zinc-100 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
              {d}
            </div>
          ))}
        </div>
        <div>{rows}</div>
      </div>
    );
  };
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookedSlots, setBookedSlots] = useState<{ start_time: string, end_time: string, status?: string }[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    student_name: '',
    student_id: '',
    user_type: 'Mahasiswa',
    phone_number: '',
    organization: '',
    date: getLocalDateString(),
    start_time: '',
    end_time: ''
  });
  const [requestLetter, setRequestLetter] = useState<File | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const bDate = b.date?.includes('T') ? b.date.split('T')[0] : b.date;
      if (filterStartDate && bDate < filterStartDate) return false;
      if (filterEndDate && bDate > filterEndDate) return false;
      if (filterStatus !== 'all' && b.status !== filterStatus) return false;
      return true;
    });
  }, [bookings, filterStartDate, filterEndDate, filterStatus]);

  const fetchBookedSlots = async () => {
    if (!selectedStudio) return;
    try {
      const slots = bookings
        .filter((b: any) => {
          if (!b.date) return false;
          const bDate = b.date.toString().includes('T') ? b.date.toString().split('T')[0] : b.date.toString().trim();
          const targetDate = formData.date.toString().trim();
          const studioIdMatch = b.studio_id && b.studio_id.toString() === selectedStudio.id.toString();
          const studioNameMatch = (b.studio_name || "").toString().trim().toLowerCase() === (selectedStudio.name || "").toString().trim().toLowerCase();
          return (studioIdMatch || studioNameMatch) && bDate === targetDate;
        })
        .map((b: any) => ({
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status || 'pending'
        }));
      setBookedSlots(slots);
    } catch (error) {
      console.error("Failed to fetch booked slots", error);
    }
  };

  useEffect(() => {
    if (selectedStudio && formData.date) {
      fetchBookedSlots();
    }
  }, [selectedStudio, formData.date]);

  useEffect(() => {
    const initBackend = async () => {
      try {
        const res = await fetch(SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'init' })
        });
        if (res.ok) {
          console.log("Backend initialized successfully");
          fetchData();
        }
      } catch (e) {
        console.error("Backend initialization failed", e);
      }
    };
    initBackend();
  }, []);

  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const [studiosRes, bookingsRes, settingsRes] = await Promise.all([
        fetch(`${SCRIPT_URL}?action=getStudios`),
        fetch(`${SCRIPT_URL}?action=getBookings`),
        fetch(`${SCRIPT_URL}?action=getSettings`)
      ]);

      if (!studiosRes.ok || !bookingsRes.ok) {
        throw new Error(`Server error: ${studiosRes.status}/${bookingsRes.status}`);
      }

      const studiosData = await studiosRes.json();
      const bookingsData = await bookingsRes.json();
      const settingsData = await settingsRes.json();

      setStudios(studiosData);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);

      if (settingsData.available_dates) {
        setAvailableDates(JSON.parse(settingsData.available_dates));
      }

      setLastSyncTime(new Date());
      setSyncError(null);
    } catch (error: any) {
      console.error("Failed to fetch data", error);
      setSyncError(error.message);
    } finally {
      setLoading(false);
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto refresh data every 5 seconds for real-time sync
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudio) return;
    if (!formData.start_time || !formData.end_time) {
      showNotification('Silakan pilih sesi waktu', 'error');
      return;
    }

    setIsSubmitting(true);

    if (!availableDates.includes(formData.date)) {
      showNotification('Tanggal yang dipilih tidak tersedia untuk booking.', 'error');
      setIsSubmitting(false);
      return;
    }

    try {
      let fileData = null;
      let fileName = null;

      if (requestLetter) {
        const fileBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(requestLetter);
        });
        fileData = fileBase64;
        fileName = requestLetter.name;
      }

      const payload = {
        action: 'create',
        ...formData,
        studio_id: selectedStudio.id.toString(),
        fileData,
        fileName
      };

      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const bookingData = await res.json();
        setIsBookingModalOpen(false);
        fetchData();

        // WhatsApp Redirection (Indonesian Message)
        const waNumber = HEAD_LAB_WA;
        const letterUrl = bookingData.drive_url
          ? bookingData.drive_url
          : bookingData.request_letter_path
            ? `${window.location.origin}/${bookingData.request_letter_path}`
            : "Tidak ada surat terlampir";

        const message = `Halo Kepala Laboratorium Cyber, saya ingin mengonfirmasi reservasi studio saya:

Nama: ${formData.student_name}
NIM/ID: ${formData.student_id}
Organisasi/Unit: ${formData.organization}
Surat Permohonan: ${letterUrl}
Studio: ${selectedStudio.name}
Tanggal: ${formatDateDisplay(formData.date, 'id-ID')}
Waktu: ${formData.start_time} - ${formData.end_time}

Mohon untuk dapat dikonfirmasi. Terima kasih.`;

        const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');

        showNotification('Reservasi berhasil! Mengalihkan ke WhatsApp...');
        // Reset form
        setFormData({
          student_name: '',
          student_id: '',
          user_type: 'Mahasiswa',
          phone_number: '',
          organization: '',
          date: getLocalDateString(),
          start_time: '',
          end_time: ''
        });
        setRequestLetter(null);
      } else {
        const error = await res.json();
        showNotification(error.error || 'Gagal membuat reservasi', 'error');
      }
    } catch (error) {
      showNotification('Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBooking = async (id: number | string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus reservasi ini?')) return;
    setIsDeletingBooking(id);
    try {
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: id.toString() })
      });
      if (res.ok) {
        showNotification('Reservasi berhasil dihapus');
        // Add a small delay to allow GAS to process
        setTimeout(() => fetchData(), 1000);
      } else {
        const data = await res.json();
        showNotification(data.error || 'Gagal menghapus reservasi', 'error');
      }
    } catch (error) {
      showNotification('Terjadi kesalahan sistem saat menghapus', 'error');
    } finally {
      // Don't clear immediately to keep the loading state during fetchData
      setTimeout(() => setIsDeletingBooking(null), 1500);
    }
  };

  const handleUpdateStatus = async (id: number | string, status: string) => {
    setIsUpdatingStatus(id);
    try {
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateStatus', id: id.toString(), status })
      });
      if (res.ok) {
        showNotification(`Status reservasi berhasil diperbarui ke ${status}`);
        fetchData();
      } else {
        const data = await res.json();
        showNotification(data.error || 'Gagal memperbarui status', 'error');
      }
    } catch (error) {
      showNotification('Terjadi kesalahan sistem saat memperbarui status', 'error');
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleSaveStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const action = editingStudio ? 'updateStudio' : 'createStudio';
      const payload = { action, ...studioFormData, id: editingStudio?.id };
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showNotification(`Studio berhasil ${editingStudio ? 'diperbarui' : 'ditambahkan'}`);
        setIsStudioModalOpen(false);
        setEditingStudio(null);
        fetchData();
      }
    } catch (error) {
      showNotification('Gagal menyimpan studio', 'error');
    }
  };

  const handleDeleteStudio = async (id: number) => {
    if (!confirm('Are you sure you want to delete this studio?')) return;
    try {
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteStudio', id: id.toString() })
      });
      if (res.ok) {
        showNotification('Studio berhasil dihapus');
        fetchData();
      } else {
        const data = await res.json();
        showNotification(data.error || 'Gagal menghapus studio', 'error');
      }
    } catch (error) {
      showNotification('Gagal menghapus studio', 'error');
    }
  };

  if (isAdmin && !adminAuthenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050505] text-zinc-900 dark:text-white font-sans flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
              <Mic2 className="text-black w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">Admin Access</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mt-2">Please enter the password to access the admin panel.</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Password</label>
              <input
                type="password"
                required
                autoFocus
                className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="w-full text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors mt-2"
            >
              Back to Web
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050505] text-zinc-900 dark:text-white font-sans selection:bg-emerald-500/30">
        {/* Admin Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <LayoutDashboard className="text-black w-5 h-5 sm:w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold tracking-tight">PodReserve <span className="text-emerald-500">Admin</span></h1>
                <p className="text-[8px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Studio Management System</p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('/')}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:white transition-colors"
            >
              Back to Web
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 sm:mb-12">
            <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto no-scrollbar pb-2 lg:pb-0 border-b lg:border-none border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setAdminTab('studios')}
                className={`pb-2 lg:pb-4 text-[10px] sm:text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${adminTab === 'studios' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                Studio Management
                {adminTab === 'studios' && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
              </button>
              <button
                onClick={() => setAdminTab('bookings')}
                className={`pb-2 lg:pb-4 text-[10px] sm:text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${adminTab === 'bookings' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                Reservation Management
                {adminTab === 'bookings' && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
              </button>
              <button
                onClick={() => setAdminTab('availability')}
                className={`pb-2 lg:pb-4 text-[10px] sm:text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${adminTab === 'availability' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                Atur Jadwal
                {adminTab === 'availability' && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
              </button>
            </div>

            <div className="flex items-center gap-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
              {isSyncing ? (
                <div className="flex items-center gap-2 text-emerald-500">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing...
                </div>
              ) : syncError ? (
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="w-3 h-3" />
                  Sync Error: {syncError}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-zinc-500">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Synced: {lastSyncTime ? format(lastSyncTime, 'HH:mm:ss') : '-'}
                </div>
              )}
            </div>
          </div>

          {adminTab === 'studios' ? (
            <>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Studio List</h2>
                <button
                  onClick={() => {
                    setEditingStudio(null);
                    setStudioFormData({ name: '', description: '', image_url: '', capacity: 4 });
                    setIsStudioModalOpen(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Studio
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {studios.map(studio => (
                  <div key={studio.id} className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl overflow-hidden group">
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={studio.image_url || undefined}
                        alt={studio.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2">{studio.name}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">{studio.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Users className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">{studio.capacity} People</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingStudio(studio);
                              setStudioFormData({
                                name: studio.name,
                                description: studio.description,
                                image_url: studio.image_url,
                                capacity: studio.capacity
                              });
                              setIsStudioModalOpen(true);
                            }}
                            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudio(studio.id)}
                            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : adminTab === 'bookings' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Reservation List</h2>
                <div className="flex gap-4">
                  <input
                    type="date"
                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-emerald-500"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                  />
                  <select
                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-emerald-500"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50">
                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Applicant</th>
                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Studio</th>
                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Time</th>
                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {filteredBookings.map((booking, idx) => (
                        <tr key={`${booking.source}-${booking.id}-${idx}`} className="hover:bg-zinc-100/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-6">
                            <div className="font-bold">{booking.student_name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">{booking.student_id}</span>
                              <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{booking.user_type}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="text-sm font-medium">{booking.studio_name}</div>
                          </td>
                          <td className="p-6">
                            <div className="text-sm">{formatDateDisplay(booking.date)}</div>
                            <div className="text-xs text-zinc-500 mt-1">{booking.start_time} - {booking.end_time}</div>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-2">
                              {isUpdatingStatus === booking.id ? (
                                <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Updating...
                                </div>
                              ) : (
                                <div className="relative group">
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    {booking.status === 'confirmed' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> :
                                      booking.status === 'cancelled' ? <XCircle className="w-3 h-3 text-red-500" /> :
                                        <Clock className="w-3 h-3 text-amber-500" />}
                                  </div>
                                  <select
                                    value={booking.status}
                                    onChange={(e) => handleUpdateStatus(booking.id, e.target.value)}
                                    className={`text-[10px] font-bold uppercase tracking-widest pl-8 pr-3 py-1.5 rounded-full border bg-transparent focus:outline-none cursor-pointer transition-all ${booking.status === 'confirmed' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' :
                                        booking.status === 'cancelled' ? 'text-red-500 border-red-500/20 bg-red-500/5 hover:bg-red-500/10' :
                                          'text-amber-500 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
                                      }`}
                                  >
                                    <option value="pending" className="bg-white dark:bg-zinc-900">Pending</option>
                                    <option value="confirmed" className="bg-white dark:bg-zinc-900">Confirmed</option>
                                    <option value="cancelled" className="bg-white dark:bg-zinc-900">Cancelled</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedBookingDetails(booking);
                                }}
                                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBooking(booking.id)}
                                disabled={isDeletingBooking === booking.id}
                                className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors ${isDeletingBooking === booking.id ? 'text-zinc-300 cursor-not-allowed' : 'text-zinc-500 hover:text-red-500'
                                  }`}
                              >
                                {isDeletingBooking === booking.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[32px]">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Calendar className="text-black w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Atur Ketersediaan Tanggal</h2>
                    <p className="text-sm text-zinc-500">Klik pada tanggal untuk mengaktifkan/menonaktifkan ketersediaan bagi pengguna.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="max-w-md">
                    {renderCalendar()}
                  </div>
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4 text-emerald-500" />
                        Panduan Pengaturan
                      </h3>
                      <ul className="space-y-3 text-xs text-zinc-500 leading-relaxed">
                        <li className="flex gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>Tanggal berwarna <span className="text-emerald-500 font-bold">Hijau</span> adalah tanggal yang tersedia untuk dibooking oleh user.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-zinc-400 font-bold">•</span>
                          <span>Tanggal berwarna <span className="text-zinc-400 font-bold">Abu-abu</span> adalah tanggal yang tidak tersedia.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-red-500 font-bold">•</span>
                          <span>Sabtu & Minggu secara otomatis tidak dapat diaktifkan.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>Perubahan akan langsung tersinkronisasi dengan Google Sheets.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Studio Modal */}
        <AnimatePresence>
          {isStudioModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsStudioModalOpen(false)}
                className="absolute inset-0 bg-black/60 dark:bg-black/90 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-zinc-900 z-10 pb-2">
                    <h3 className="text-2xl font-bold tracking-tight">
                      {editingStudio ? 'Edit Studio' : 'Add New Studio'}
                    </h3>
                    <button
                      onClick={() => setIsStudioModalOpen(false)}
                      className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <XCircle className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveStudio} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Studio Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                        value={studioFormData.name}
                        onChange={e => setStudioFormData({ ...studioFormData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Description</label>
                      <textarea
                        required
                        rows={3}
                        className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                        value={studioFormData.description}
                        onChange={e => setStudioFormData({ ...studioFormData, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Capacity</label>
                        <input
                          type="number"
                          required
                          className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                          value={studioFormData.capacity}
                          onChange={e => setStudioFormData({ ...studioFormData, capacity: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Image URL (Optional)</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                          value={studioFormData.image_url}
                          onChange={e => setStudioFormData({ ...studioFormData, image_url: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsStudioModalOpen(false)}
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${notification.type === 'success' ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-red-500 text-white border-red-400'
                }`}
            >
              {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              <span className="text-xs font-bold uppercase tracking-widest">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <Mic2 className="w-12 h-12 text-emerald-500 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-mono text-sm uppercase tracking-widest">Starting Studio System...</p>
        </div>
      </div>
    );
  }

  if (showLanding && !isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white selection:bg-emerald-500/30">
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Mic2 className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <span className="text-lg sm:text-xl font-black tracking-tighter uppercase">PodReserve</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm font-bold hover:text-emerald-500 transition-colors">Features</a>
                <a href="#studios" className="text-sm font-bold hover:text-emerald-500 transition-colors">Studios</a>
              </div>
              <button
                onClick={() => setShowLanding(false)}
                className="bg-zinc-900 dark:bg-white text-white dark:text-black px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold hover:bg-emerald-500 dark:hover:bg-emerald-400 transition-all"
              >
                Book Now
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 sm:pt-40 pb-12 sm:pb-20 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-center lg:text-left"
              >
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-6 sm:mb-8">
                  <Zap className="w-3 h-3" />
                  Premium Studio Booking
                </div>
                <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-6 sm:mb-8">
                  YOUR VOICE <br />
                  <span className="text-emerald-500">DESERVES</span> <br />
                  THE BEST.
                </h1>
                <p className="text-lg sm:text-xl text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto lg:mx-0 mb-8 sm:mb-10 leading-relaxed">
                  Professional podcasting and recording studios equipped with industry-standard gear. Book your session in seconds.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <button
                    onClick={() => setShowLanding(false)}
                    className="group bg-emerald-500 text-black px-8 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl text-base sm:text-lg font-bold flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20"
                  >
                    Start Recording
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button className="px-8 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl text-base sm:text-lg font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all">
                    View Studios
                  </button>
                </div>

                <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 sm:gap-8">
                  <div className="flex -space-x-3 sm:-space-x-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-white dark:border-black bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="User" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-1 text-amber-500 mb-1">
                      {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />)}
                    </div>
                    <p className="text-xs sm:text-sm font-bold">Trusted by 500+ Creators</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative px-4 sm:px-0"
              >
                <div className="aspect-square rounded-[2.5rem] sm:rounded-[4rem] overflow-hidden bg-zinc-100 dark:bg-zinc-900 relative group">
                  <img
                    src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=1000"
                    alt="Studio"
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center group/play hover:scale-110 transition-all">
                      <Play className="w-6 h-6 sm:w-10 sm:h-10 text-white fill-current translate-x-1" />
                    </button>
                  </div>
                </div>

                {/* Floating Cards - Adjusted for mobile */}
                <div className="absolute -bottom-6 sm:-bottom-10 -left-2 sm:-left-10 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-[180px] sm:max-w-[240px] hidden xs:block">
                  <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                      <Mic2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[8px] sm:text-xs font-black uppercase text-zinc-500">Equipment</p>
                      <p className="text-xs sm:text-base font-bold">Pro Gear Only</p>
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-sm text-zinc-500 leading-relaxed">Shure SM7B, Focusrite interfaces, and soundproof booths.</p>
                </div>

                <div className="absolute -top-6 sm:-top-10 -right-2 sm:-right-10 bg-emerald-500 p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl text-black max-w-[140px] sm:max-w-[200px] hidden xs:block">
                  <Award className="w-6 h-6 sm:w-10 sm:h-10 mb-2 sm:mb-4" />
                  <p className="text-sm sm:text-2xl font-black leading-tight uppercase">#1 Studio in the city</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 sm:py-32 px-4 sm:px-6 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-20">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 sm:mb-6">BUILT FOR CREATORS</h2>
              <p className="text-zinc-500 text-base sm:text-lg">Everything you need to produce high-quality audio content without the technical headache.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                { icon: <Clock />, title: "Instant Booking", desc: "Check availability and secure your slot in real-time. No back-and-forth emails." },
                { icon: <ShieldCheck />, title: "Secure Access", desc: "Professional environment with dedicated staff to assist your recording session." },
                { icon: <Upload />, title: "Cloud Sync", desc: "Your recordings are automatically synced to your preferred cloud storage." }
              ].map((feature, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 transition-all group">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-6 sm:mb-8 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                    {React.cloneElement(feature.icon as React.ReactElement, { className: "w-6 h-6 sm:w-8 h-8" })}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-zinc-500 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 sm:py-20 px-4 sm:px-6 border-t border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 sm:gap-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Mic2 className="w-5 h-5 text-black" />
              </div>
              <span className="text-lg font-black tracking-tighter uppercase">PodReserve</span>
            </div>
            <p className="text-zinc-500 text-xs sm:text-sm text-center">© 2026 PodReserve Studio. All rights reserved.</p>
            <div className="flex gap-6 sm:gap-8">
              <a href="#" className="text-xs sm:text-sm font-bold hover:text-emerald-500">Instagram</a>
              <a href="#" className="text-xs sm:text-sm font-bold hover:text-emerald-500">Twitter</a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800/50 bg-white/50 dark:bg-black/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-auto sm:h-20 py-3 sm:py-0 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Mic2 className="text-black w-5 h-5 sm:w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg sm:text-xl tracking-tight">PodReserve</h1>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Studio UIN SSC</p>
                  <div className="flex items-center gap-1">
                    <div className={`w-1 h-1 rounded-full ${syncError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                      {syncError ? 'Sync Error' : 'Live'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigateTo('/admin')}
              className="sm:hidden p-2 text-zinc-500 hover:text-emerald-500 transition-colors"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
          </div>

          <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('studios')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'studios' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
            >
              Studios
            </button>
            <button
              onClick={() => setActiveTab('availability')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'availability' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
            >
              Availability
            </button>
            <button
              onClick={() => setActiveTab('reservasi')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'reservasi' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
            >
              Reservations
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'studios' ? (
            <motion.div
              key="studios"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Info Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 rounded-[32px]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                      <Info className="text-black w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">Tata Cara Peminjaman</h2>
                  </div>
                  <ul className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <li className="flex gap-3">
                      <span className="font-bold text-emerald-500">01.</span>
                      <span>Pilih studio yang tersedia di menu Studios.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-emerald-500">02.</span>
                      <span>Cek ketersediaan jadwal di menu Availability.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-emerald-500">03.</span>
                      <span>Klik tombol "Book Now" pada studio yang diinginkan.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-emerald-500">04.</span>
                      <span>Isi formulir pendaftaran dan unggah surat permohonan (PDF).</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-emerald-500">05.</span>
                      <span>Tunggu konfirmasi admin melalui sistem atau kontak yang tersedia.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[32px]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                      <ShieldCheck className="text-zinc-500 w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">Tata Tertib Studio</h2>
                  </div>
                  <ul className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <li className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>Dilarang membawa makanan dan minuman ke dalam studio.</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>Menjaga kebersihan dan ketenangan di area studio.</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>Bertanggung jawab atas kerusakan alat yang disebabkan kelalaian.</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>Hadir tepat waktu sesuai dengan jadwal yang telah dibooking.</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>Merapikan kembali peralatan setelah selesai digunakan.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {studios.map((studio) => (
                  <div
                    key={studio.id}
                    className="group bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl overflow-hidden hover:border-emerald-500/30 transition-all duration-500"
                  >
                    <div className="relative h-56 overflow-hidden">
                      <img
                        src={studio.image_url || undefined}
                        alt={studio.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-medium text-white">Up to {studio.capacity} people</span>
                      </div>
                    </div>

                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2">{studio.name}</h3>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-6 line-clamp-2">
                        {studio.description}
                      </p>

                      <button
                        onClick={() => {
                          setSelectedStudio(studio);
                          setIsBookingModalOpen(true);
                        }}
                        className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-500 dark:hover:bg-emerald-400 transition-colors group/btn"
                      >
                        Book Session
                        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'availability' ? (
            <motion.div
              key="availability"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
                <div className="lg:col-span-5 space-y-4 sm:space-y-6">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Schedule Calendar</h2>
                    <p className="text-zinc-500 text-sm mt-1">Select a date to check studio availability.</p>
                  </div>
                  {renderCalendar()}

                  {formData.date && availableDates.includes(formData.date) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-500 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl shadow-emerald-500/20"
                    >
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <p className="text-black/60 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1">Selected Date</p>
                          <p className="text-black font-bold text-base sm:text-lg">{formatDateDisplay(formData.date)}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (studios.length > 0) {
                              setSelectedStudio(studios[0]);
                              setIsBookingModalOpen(true);
                            }
                          }}
                          className="w-full sm:w-auto bg-black text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                          Book This Date
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Legend</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500" />
                        <span className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400">Available</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500" />
                        <span className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400">Pending</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                        <span className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400">Occupied</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-emerald-500" />
                        <span className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400">Selected Date</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                        <span className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400">Weekend</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Schedule: {format(parseISO(formData.date), 'dd MMMM yyyy')}</h3>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-100 dark:bg-zinc-900/50">Studio</th>
                            {ALL_SLOTS.map(slot => (
                              <th key={slot.id} className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-100 dark:bg-zinc-900/50 text-center">
                                {slot.name}<br />
                                <span className="text-zinc-600 dark:text-zinc-600 font-normal lowercase">{slot.start}-{slot.end}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {studios.map(studio => (
                            <tr key={studio.id} className="border-b border-zinc-200 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                              <td className="p-6">
                                <div className="font-bold text-sm whitespace-nowrap">{studio.name}</div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-tight">Cap: {studio.capacity}</div>
                              </td>
                              {ALL_SLOTS.map(slot => {
                                const booking = bookings.find(b => {
                                  // Match by studio_id OR studio_name (GAS might only return name)
                                  const bStudioId = b.studio_id ? b.studio_id.toString().trim() : "";
                                  const sId = studio.id.toString().trim();
                                  const bStudioName = (b.studio_name || "").toString().trim().toLowerCase();
                                  const sName = (studio.name || "").toString().trim().toLowerCase();

                                  const studioMatch = (bStudioId && bStudioId === sId) || (bStudioName && bStudioName === sName);
                                  if (!studioMatch) return false;

                                  // Normalize date (Handle ISO strings and simple YYYY-MM-DD)
                                  const normalizeDate = (d: any) => {
                                    if (!d) return "";
                                    const str = d.toString().trim();
                                    // Extract YYYY-MM-DD from ISO or other formats
                                    const match = str.match(/^\d{4}-\d{2}-\d{2}/);
                                    return match ? match[0] : str;
                                  };

                                  const dateMatch = normalizeDate(b.date) === normalizeDate(formData.date);
                                  if (!dateMatch) return false;

                                  // Normalize time (handle leading zeros, potential seconds, and different separators)
                                  const normalizeTime = (t: any) => {
                                    if (!t) return "";
                                    const str = t.toString().trim().replace('.', ':');
                                    const parts = str.split(':');
                                    if (parts.length < 2) return str;
                                    // Ensure HH:mm format, ignore seconds if present
                                    const hh = parts[0].padStart(2, '0');
                                    const mm = parts[1].padStart(2, '0');
                                    return `${hh}:${mm}`;
                                  };

                                  const bStartTime = normalizeTime(b.start_time);
                                  const sStartTime = normalizeTime(slot.start);

                                  const timeMatch = bStartTime === sStartTime;

                                  return timeMatch;
                                });
                                const isBooked = !!booking;
                                const isConfirmed = booking?.status?.toLowerCase() === 'confirmed' ||
                                  booking?.status?.toLowerCase() === 'acc' ||
                                  booking?.status?.toLowerCase() === 'dikonfirmasi';

                                return (
                                  <td key={slot.id} className="p-4 text-center">
                                    {isBooked ? (
                                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border ${isConfirmed
                                          ? 'bg-red-600 text-white border-red-700'
                                          : 'bg-amber-500 text-white border-amber-600 animate-pulse-subtle'
                                        }`}>
                                        {isConfirmed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {isConfirmed ? 'CONFIRMED' : 'PENDING'}
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setSelectedStudio(studio);
                                          setFormData({ ...formData, start_time: slot.start, end_time: slot.end });
                                          setIsBookingModalOpen(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Book
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="reservasi"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Reservation List</h2>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-1">Manage recording schedules and studio usage history.</p>
                  </div>
                  <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 self-start mt-1">
                    <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSyncing ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
                    <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {isSyncing ? 'Syncing...' : 'Live Sync'}
                    </span>
                    <button
                      onClick={fetchData}
                      disabled={isSyncing}
                      className="ml-1 p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors disabled:opacity-50"
                      title="Refresh Data"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-500">From:</label>
                    <input
                      type="date"
                      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-500">To:</label>
                    <input
                      type="date"
                      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-500">Status:</label>
                    <select
                      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs focus:outline-none focus:border-emerald-500 appearance-none flex-1 sm:flex-none"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'confirmed' | 'cancelled')}
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  {(filterStartDate || filterEndDate || filterStatus !== 'all') && (
                    <button
                      onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterStatus('all'); }}
                      className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 ml-auto sm:ml-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {bookings.some((b: any) => b.source === 'local_fallback') && (
                <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Data Out of Sync</h4>
                    <p className="text-xs text-amber-500/80 mt-1">
                      The application failed to fetch the latest data from Google Sheets. The data displayed below is backup (old) data.
                      Please ensure the <b>"Who has access"</b> setting in Google Apps Script is set to <b>"Anyone"</b>.
                    </p>
                  </div>
                </div>
              )}

              {filteredBookings.length === 0 ? (
                <div className="bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl p-20 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calendar className="text-zinc-700 w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-400">No bookings found</h3>
                  <p className="text-zinc-600 text-sm mt-1">Your scheduled sessions will appear here.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredBookings.map((booking, idx) => (
                    <div
                      key={`${booking.source}-${booking.id}-${idx}`}
                      className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <Mic2 className="text-emerald-500 w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{booking.studio_name}</h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDateDisplay(booking.date)}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                              <Clock className="w-3.5 h-3.5" />
                              {booking.start_time} - {booking.end_time}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              ID: {booking.student_id}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              NAME: {booking.student_name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              ORG: {booking.organization}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              WA: {booking.phone_number}
                            </span>
                            {booking.request_letter_path && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                <FileText className="w-2.5 h-2.5" />
                                Letter Attached
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedBookingDetails(booking)}
                          className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                        >
                          Details
                        </button>
                        {booking.source === 'local_pending' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold uppercase tracking-wider animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Syncing...
                          </div>
                        ) : booking.status === 'confirmed' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold uppercase tracking-wider">
                            <Clock className="w-3 h-3" />
                            Pending
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Deletion Loading Overlay */}
      <AnimatePresence>
        {isDeletingBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-6 max-w-xs w-full mx-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold">Deleting...</h3>
                <p className="text-zinc-500 text-xs mt-1">Synchronizing with Google Sheets. Please wait.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${notification.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
          >
            {notification.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span className="text-sm font-bold tracking-tight">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && selectedStudio && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBookingModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-5 sm:p-8 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-5 sm:mb-6 sticky top-0 bg-white dark:bg-zinc-900 z-10 pb-2">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">Book {selectedStudio.name}</h2>
                    <p className="text-zinc-500 text-[10px] sm:text-xs mt-1">Complete the data for studio reservation.</p>
                  </div>
                  <button
                    onClick={() => setIsBookingModalOpen(false)}
                    className="p-1.5 sm:p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <XCircle className="w-5 h-5 sm:w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                  </button>
                </div>

                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Kategori Pemohon</label>
                    <select
                      required
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      value={formData.user_type}
                      onChange={(e) => setFormData({ ...formData, user_type: e.target.value as any })}
                    >
                      <option value="Mahasiswa">Mahasiswa</option>
                      <option value="Dosen">Dosen</option>
                      <option value="Tendik">Tenaga Kependidikan</option>
                      <option value="Eksternal">Pihak Eksternal</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                      <input
                        required
                        type="text"
                        placeholder="Your Name"
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                        value={formData.student_name}
                        onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">ID / NIP / NIM</label>
                      <input
                        required
                        type="text"
                        placeholder="Your Identity ID"
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                        value={formData.student_id}
                        onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">WhatsApp Number</label>
                    <input
                      required
                      type="tel"
                      placeholder="081234567890"
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Organization / Unit</label>
                    <input
                      required
                      type="text"
                      placeholder="UKM, Dept, Unit, Agency, etc"
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Upload Request Letter (PDF)</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        id="letter-upload"
                        onChange={(e) => setRequestLetter(e.target.files?.[0] || null)}
                      />
                      <label
                        htmlFor="letter-upload"
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 border-dashed rounded-xl px-4 py-3 text-sm flex items-center justify-center gap-3 cursor-pointer hover:border-emerald-500 transition-all"
                      >
                        {requestLetter ? (
                          <>
                            <FileText className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-500 font-medium truncate max-w-[150px]">{requestLetter.name}</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-500">Choose PDF file...</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        required
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full bg-zinc-50 dark:bg-zinc-800/50 border rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none transition-colors appearance-none ${formData.date && !availableDates.includes(formData.date)
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-200 dark:border-zinc-700 focus:border-emerald-500'
                          }`}
                        value={formData.date}
                        onChange={(e) => {
                          const selected = e.target.value;
                          setFormData({ ...formData, date: selected });
                          if (!availableDates.includes(selected)) {
                            showNotification('Tanggal ini tidak tersedia untuk booking.', 'error');
                          }
                        }}
                      />
                    </div>
                    {formData.date && !availableDates.includes(formData.date) && (
                      <p className="text-[10px] text-red-500 font-bold ml-1">This date is not available for booking.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Select Session</label>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-[8px] uppercase font-bold text-zinc-500">Pending</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-[8px] uppercase font-bold text-zinc-500">Confirmed</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {ALL_SLOTS.map((slot) => {
                        const booking = bookedSlots.find(b => b.start_time === slot.start);
                        const isBooked = !!booking;
                        const isSelected = formData.start_time === slot.start;
                        const isConfirmed = booking?.status === 'confirmed' || booking?.status === 'acc';

                        return (
                          <button
                            key={slot.start}
                            type="button"
                            disabled={isBooked}
                            onClick={() => setFormData({ ...formData, start_time: slot.start, end_time: slot.end })}
                            className={`
                                relative py-3 px-4 rounded-xl text-sm font-bold transition-all border flex items-center justify-between
                                ${isBooked
                                ? isConfirmed
                                  ? 'bg-red-500/10 border-red-500/20 text-red-500/50 cursor-not-allowed'
                                  : 'bg-amber-500/10 border-amber-500/20 text-amber-500/50 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                              }
                              `}
                          >
                            <div className="flex items-center gap-3">
                              <Clock className={`w-4 h-4 ${isSelected ? 'text-black' : isBooked ? (isConfirmed ? 'text-red-500/50' : 'text-amber-500/50') : 'text-zinc-500'}`} />
                              <span>{slot.name}: {slot.start} - {slot.end}</span>
                            </div>
                            {isBooked && (
                              <span className={`text-[10px] uppercase font-black ${isConfirmed ? 'text-red-500' : 'text-amber-500'}`}>
                                {isConfirmed ? 'Occupied (ACC)' : 'Pending'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-emerald-500 text-black font-bold py-3.5 rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Submitting Reservation...
                        </>
                      ) : (
                        'Confirm Reservation'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reservation Details Modal */}
      <AnimatePresence>
        {selectedBookingDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBookingDetails(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-white dark:bg-zinc-900 z-10 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <Mic2 className="text-emerald-500 w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold">Reservation Details</h2>
                  </div>
                  <button
                    onClick={() => setSelectedBookingDetails(null)}
                    className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Studio</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedBookingDetails.studio_name}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</p>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${selectedBookingDetails.status === 'confirmed' || selectedBookingDetails.status === 'acc'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20'
                          : selectedBookingDetails.status === 'cancelled'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20'
                        }`}>
                        {selectedBookingDetails.status === 'confirmed' || selectedBookingDetails.status === 'acc' ? <CheckCircle2 className="w-3 h-3" /> :
                          selectedBookingDetails.status === 'cancelled' ? <XCircle className="w-3 h-3" /> :
                            <Clock className="w-3 h-3" />}
                        {selectedBookingDetails.status || 'Pending'}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{selectedBookingDetails.user_type || 'Applicant'}</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedBookingDetails.student_name}</p>
                      <p className="text-xs text-zinc-500">ID: {selectedBookingDetails.student_id}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Organization / Unit</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedBookingDetails.organization || '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">
                        {formatDateDisplay(selectedBookingDetails.date)}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Time</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedBookingDetails.start_time} - {selectedBookingDetails.end_time}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedBookingDetails.phone_number || '-'}</p>
                      {selectedBookingDetails.phone_number && (
                        <a
                          href={`https://wa.me/${formatWhatsAppNumber(selectedBookingDetails.phone_number)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-600 dark:text-emerald-500 font-bold hover:underline"
                        >
                          Contact via WA
                        </a>
                      )}
                    </div>
                  </div>

                  {selectedBookingDetails.request_letter_path && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Request Letter</p>
                      <a
                        href={selectedBookingDetails.drive_url || `/${selectedBookingDetails.request_letter_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-emerald-500 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">View PDF Document</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:translate-x-1 transition-transform" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-10">
                  <button
                    onClick={() => setSelectedBookingDetails(null)}
                    className="w-full bg-zinc-900 dark:bg-zinc-800 text-white font-bold py-3.5 rounded-xl hover:bg-zinc-800/90 dark:hover:bg-zinc-700 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-zinc-100 dark:border-zinc-900 py-12 px-6 bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-4 items-center md:items-start">
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
              <Info className="w-4 h-4" />
              <span className="text-xs">Reservasi tunduk pada ketersediaan studio dan pedoman universitas.</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">© 2026 Cyber Laboratory. All Rights Reserved.</p>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigateTo('/admin')}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-500 transition-colors"
            >
              Admin Panel
            </button>
            <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-800" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-700">Privacy</span>
            <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-800" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-700">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
