import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog } from '@headlessui/react';
import { UsersIcon, MapPinIcon, CalendarIcon, ViewColumnsIcon, XMarkIcon, ClockIcon, UserCircleIcon, CheckCircleIcon, CalendarDaysIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';

const SEATS_TOTAL = 50;
const FLOATER_SEATS = 10;
const CAPACITY_BATCH = 40;
const API_URL = 'http://localhost:5001/api';

// Example Holiday Calendar
const PUBLIC_HOLIDAYS = [
  "2026-01-01", // New Year
  "2026-04-14", // Current testing date (Baisakhi / Dr. Ambedkar Jayanti)
  "2026-05-01", // Labour Day
  "2026-08-15", // Independence Day
  "2026-10-02", // Gandhi Jayanti
  "2026-12-25"  // Christmas
];

export default function App() {
  // --- Environment Mocks (SIMULATOR) ---
  const [currentUserBatch, setCurrentUserBatch] = useState('batch2'); 
  const [currentTime, setCurrentTime] = useState('before3pm'); 
  const [currentWeek, setCurrentWeek] = useState('week1'); 
  const [currentDay, setCurrentDay] = useState('Mon'); 
  const [isHoliday, setIsHoliday] = useState(false);
  const [viewMode, setViewMode] = useState('today'); // 'today' | 'tomorrow'
  const [appMode, setAppMode] = useState('simulation'); // 'simulation' | 'actual'
  const [realDate, setRealDate] = useState(new Date().toLocaleDateString());
  const [currentCalendarWeek, setCurrentCalendarWeek] = useState(0);

  // --- Real-Time Sync Logic ---
  useEffect(() => {
    if (appMode === 'actual') {
      const updateRealTime = () => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        
        setRealDate(now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        setIsHoliday(PUBLIC_HOLIDAYS.includes(dateStr));

        // 1. Get Day
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        setCurrentDay(days[now.getDay()]);

        // 2. Get Time
        setCurrentTime(now.getHours() >= 15 ? 'after3pm' : 'before3pm');

        // 3. Simple alternating week logic (Even/Odd week of year)
        const start = new Date(now.getFullYear(), 0, 1);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        const weekNum = Math.ceil((dayOfYear + start.getDay() + 1) / 7);
        setCurrentCalendarWeek(weekNum);
        setCurrentWeek(weekNum % 2 === 0 ? 'week2' : 'week1');
      };

      updateRealTime();
      const interval = setInterval(updateRealTime, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [appMode]);

  // --- Derived State Engine ---
  const getSimulatedTargetDay = () => {
    if (viewMode === 'today') return currentDay;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const idx = days.indexOf(currentDay);
    // Wrap around to Monday
    return idx < days.length - 1 ? days[idx + 1] : days[0]; 
  };

  const targetDay = getSimulatedTargetDay();

  const getTargetDateStr = () => {
    const d = new Date(realDate); // This is formatted, better to use now
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const monday = new Date(now.setDate(diff));
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const idx = days.indexOf(targetDay);
    monday.setDate(monday.getDate() + idx);
    return monday.toISOString().split('T')[0];
  };

  const targetDateStr = getTargetDateStr();
  const isTargetHoliday = appMode === 'actual' 
    ? PUBLIC_HOLIDAYS.includes(targetDateStr) 
    : (isHoliday && viewMode === 'today');
  const isTargetWeekend = targetDay === 'Sat' || targetDay === 'Sun';

  const getActiveBatchForDay = (day) => {
    if (day === 'Sat' || day === 'Sun') return 'none';
    const isEarlyWeek = ['Mon', 'Tue', 'Wed'].includes(day);
    if (currentWeek === 'week1') return isEarlyWeek ? 'batch1' : 'batch2';
    return isEarlyWeek ? 'batch2' : 'batch1';
  };

  const activeBatch = getActiveBatchForDay(targetDay);
  const isUserOnDay = currentUserBatch === activeBatch;

  // --- Normal App State ---
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('book'); // 'book' | 'cancel'
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState([]);

  // Fetch true bookings from your SQLite Database
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/bookings`, {
        params: { week: currentWeek, day: targetDay }
      });
      
      const dbBookings = response.data;

      // Construct visual seats
      const derivedSeats = Array.from({ length: SEATS_TOTAL }, (_, index) => {
        const deskId = index + 1;
        const isFloater = index >= CAPACITY_BATCH;
        
        // Check if there is an active booking entry for this desk today
        const bookingForSeat = dbBookings.find(b => b.seatId === deskId);
        
        return {
          id: deskId,
          isFloater,
          isBooked: !!bookingForSeat,
          bookedByCurrentUser: bookingForSeat ? bookingForSeat.userBatch === currentUserBatch : false 
        };
      });
      
      setSeats(derivedSeats);
    } catch (error) {
      console.error("Failed to fetch bookings. Is the server running?", error);
    } finally {
      setLoading(false);
    }
  };

  // Re-pull database whenever user flips calendar simulation or changes roles!
  useEffect(() => {
    fetchBookings();
  }, [targetDay, currentWeek, currentUserBatch]);

  const handleInitDB = async () => {
    try {
      const res = await axios.post(`${API_URL}/init-desks`);
      alert(res.data.message || "Database structural seats initialized!");
    } catch (err) {
      alert(err.response?.data?.error || "Already initialized or server down.");
    }
  };

  const handleSeatClick = (seat) => {
    if (isHoliday && viewMode === 'today') {
      alert("🌴 The office is closed for a Holiday today! All bookings are suspended.");
      return;
    }
    // Cancel own seat
    if (seat.bookedByCurrentUser) {
      setSelectedSeat(seat);
      setModalMode('cancel');
      setIsModalOpen(true);
      return;
    }

    if (isTargetHoliday) {
      alert(`🌴 The office is closed on ${targetDay} (${targetDateStr}) for a public holiday. No bookings allowed.`);
      return;
    }

    if (isTargetWeekend) {
      alert("🌴 The office is closed on weekends. No bookings allowed.");
      return;
    }

    // Prevent clicking seats booked by OTHERS
    if (seat.isBooked) return;

    // Rules logic
    if (viewMode === 'tomorrow' && currentTime === 'before3pm') {
      alert("⚠️ Early Booking Window Closed: You can only book seats for tomorrow after 3:00 PM today.");
      return;
    }

    if (seat.isFloater) {
      if (isUserOnDay) {
        alert("Since today is your scheduled office day, please book a regular seat. Floater seats are reserved for colleagues who are off-batch today but still need to come in.");
        return;
      }
    } else {
      if (!isUserOnDay) {
        alert("🚫 Restricted Seat: Since you are off-batch for this day, you are only allowed to book a Floater seat.");
        return;
      }
    }

    setSelectedSeat(seat);
    setModalMode('book');
    setIsModalOpen(true);
  };

  const processAction = async () => {
    if (!selectedSeat) return;
    
    try {
      if (modalMode === 'book') {
        // Send actual POST to Database
        await axios.post(`${API_URL}/bookings`, {
          deskId: selectedSeat.id,
          userBatch: currentUserBatch,
          week: currentWeek,
          day: targetDay
        });
      } else {
        // Send actual DELETE to Database
        await axios.delete(`${API_URL}/bookings`, {
          data: {
             deskId: selectedSeat.id,
             userBatch: currentUserBatch,
             week: currentWeek,
             day: targetDay
          }
        });
      }
      
      // Auto-refresh the visual UI grid gracefully after backend responds
      fetchBookings();
    } catch (error) {
      // Typically fires if unique constraint prevents double booking!
      alert(error.response?.data?.error || "A database constraint occurred.");
    }
    
    setIsModalOpen(false);
    setSelectedSeat(null);
  };

  const handleResetDay = async () => {
    if (!window.confirm(`Are you sure you want to RESET all bookings for ${targetDay} (${currentWeek})? This cannot be undone.`)) return;

    try {
      await axios.delete(`${API_URL}/bookings/reset`, {
        data: { week: currentWeek, day: targetDay }
      });
      fetchBookings();
    } catch (error) {
      alert("Failed to reset day.");
    }
  };

  // Helper to get dates for the current week slice
  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sun
    const diff = now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1); // Get to Mon
    const monday = new Date(now.setDate(diff));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
      return {
        date: d,
        dateStr,
        dayName,
        isHoliday: appMode === 'actual' ? PUBLIC_HOLIDAYS.includes(dateStr) : (isHoliday && d.toDateString() === new Date().toDateString()),
        isToday: d.toDateString() === new Date().toDateString(),
        batch: getActiveBatchForDay(dayName)
      };
    });
  };

  const weekDates = getWeekDates();

  const renderSeats = () => {
    if (loading && seats.length === 0) return <div className="text-zinc-400 font-bold p-8 text-center animate-pulse w-full">Connecting to Database API...</div>;

    return seats.map((seat) => {
      let statusColor = "bg-zinc-200 text-zinc-400 border-zinc-300"; 
      
      const isLockedOut = !seat.isFloater && !isUserOnDay && !seat.isBooked;
      const isFloaterLocked = seat.isFloater && isUserOnDay && !seat.isBooked;
      const isBookingWindowLocked = viewMode === 'tomorrow' && currentTime === 'before3pm' && !seat.isBooked;
      const isTargetClosed = (isTargetHoliday || isTargetWeekend);

      if (isTargetClosed) {
        statusColor = "bg-red-50 text-red-200 border-red-100 cursor-not-allowed opacity-60";
      } else if (seat.bookedByCurrentUser) {
        statusColor = "bg-green-500 text-white shadow-md shadow-green-500/50 border-green-400 ring-4 ring-green-200";
      } else if (seat.isBooked) {
        statusColor = "bg-brand-700 text-white shadow-md shadow-brand-500/50 border-brand-600 opacity-90 cursor-not-allowed";
      } else if (isBookingWindowLocked) {
        statusColor = "bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed opacity-40";
      } else if (isFloaterLocked) {
        statusColor = "bg-amber-50 text-amber-200 border-amber-100 cursor-not-allowed opacity-40";
      } else if (seat.isFloater) {
        statusColor = "bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-amber-400";
      } else if (isLockedOut) {
        statusColor = "bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed opacity-40";
      }

      return (
        <div 
          key={seat.id} 
          onClick={() => handleSeatClick(seat)}
          className={`h-12 w-12 rounded-xl flex items-center justify-center text-xs font-semibold border transition-all ${
            (seat.isBooked && !seat.bookedByCurrentUser) || isLockedOut || isFloaterLocked || isBookingWindowLocked || isTargetClosed
              ? statusColor 
              : `${statusColor} cursor-pointer hover:-translate-y-1 hover:shadow-lg`
          }`}
          title={
            isTargetClosed ? `Desk ${seat.id} (Office Closed on ${targetDay})` :
            isBookingWindowLocked ? `Desk ${seat.id} (Booking for Tomorrow opens at 3 PM)` :
            seat.bookedByCurrentUser ? `Your Seat ${seat.id} (Click to Cancel)` : 
            seat.isBooked ? `Desk ${seat.id} (Booked by Colleague)` :
            isFloaterLocked ? `Floater ${seat.id} (Reserved for Off-Batch colleagues)` :
            isLockedOut ? `Desk ${seat.id} (Reserved for Assigned Batch)` :
            seat.isFloater ? `Floater Seat ${seat.id} (Available to anyone)` :
            `Desk ${seat.id} (Available to anyone)`
          }
        >
          {seat.isFloater ? "F" : seat.id}
        </div>
      );
    });
  };

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 font-sans">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-4 flex justify-between items-center bg-white/80">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-500/30">
            <MapPinIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-dark-900">seatsync <span className="text-zinc-400 font-light ml-1">Live DB</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleInitDB}
            className="flex items-center gap-2 text-xs font-bold bg-dark-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700"
          >
            <ServerStackIcon className="w-4 h-4" /> Initialize Core Seats
          </button>
          <div className="hidden md:flex items-center gap-2 text-sm font-medium bg-zinc-100 px-4 py-2 rounded-full text-zinc-600 border border-zinc-200">
            <UserCircleIcon className="h-5 w-5 text-brand-600" />
            <span>Logged in as: <strong className="text-dark-900 ml-1">{currentUserBatch.toUpperCase()} User</strong></span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto mt-8 px-6">
        
        {/* --- MINI WEEKLY CALENDAR --- */}
        <div className="mb-10 grid grid-cols-2 md:grid-cols-7 gap-3">
           {weekDates.map((d) => (
             <div 
               key={d.dateStr}
               className={`relative p-4 rounded-2xl border transition-all ${
                 d.isToday 
                  ? 'bg-brand-600 border-brand-500 shadow-lg shadow-brand-500/30 -translate-y-1' 
                  : 'bg-white border-zinc-200 shadow-sm'
               }`}
             >
                <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${d.isToday ? 'text-brand-100' : 'text-zinc-400'}`}>
                  {d.dayName}
                </div>
                <div className={`text-xl font-black ${d.isToday ? 'text-white' : 'text-zinc-900'}`}>
                   {d.date.getDate()}
                </div>

                {/* Holiday Badge */}
                {d.isHoliday && (
                  <div className="absolute top-2 right-2 text-amber-500 animate-bounce">
                    <SparklesIcon className="w-5 h-5" />
                  </div>
                )}

                {/* Batch Badge */}
                <div className="mt-3 flex items-center justify-between">
                   {d.batch !== 'none' ? (
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                       d.isToday ? 'bg-brand-500 text-white' : 'bg-zinc-100 text-zinc-600'
                     }`}>
                       {d.batch.toUpperCase()}
                     </span>
                   ) : (
                     <span className="text-[10px] text-zinc-300 font-medium">CLOSED</span>
                   )}
                   {d.isHoliday && <span className="text-[10px] font-bold text-amber-600">HOLIDAY</span>}
                </div>
             </div>
           ))}
        </div>

        {/* --- MODE SWITCHER & SIMULATOR --- */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 mb-10 text-white shadow-xl shadow-indigo-900/20">
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${appMode === 'actual' ? 'bg-green-500' : 'bg-amber-500'}`}>
                   {appMode === 'actual' ? <ClockIcon className="w-5 h-5" /> : <ClockIcon className="w-5 h-5 text-indigo-900" />}
                </div>
                <div>
                  <h3 className="font-bold">System Mode: <span className={appMode === 'actual' ? 'text-green-400' : 'text-amber-400'}>{appMode.toUpperCase()}</span></h3>
                  <p className="text-xs text-indigo-300">{appMode === 'actual' ? 'Syncing with real-world calendar and clock.' : 'Manual control for testing logic edges.'}</p>
                </div>
              </div>
              <div className="bg-white/10 p-1 rounded-xl flex">
                 <button onClick={() => setAppMode('actual')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${appMode === 'actual' ? 'bg-white text-indigo-900' : 'text-white hover:bg-white/5'}`}>Actual</button>
                 <button onClick={() => setAppMode('simulation')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${appMode === 'simulation' ? 'bg-white text-indigo-900' : 'text-white hover:bg-white/5'}`}>Simulation</button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-shrink-0">
                <h3 className="flex items-center gap-2 text-md font-bold mb-1">
                  Control Panel
                </h3>
              </div>
              
              <div className="flex flex-wrap gap-4 items-center">
                 {/* Week/Day Toggles only show in Simulation Mode */}
                 {appMode === 'simulation' && (
                   <>
                    <div className="bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-md flex gap-1">
                        <button onClick={() => setCurrentWeek('week1')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${currentWeek === 'week1' ? 'bg-indigo-500 text-white shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                          Week 1
                        </button>
                        <button onClick={() => setCurrentWeek('week2')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${currentWeek === 'week2' ? 'bg-indigo-500 text-white shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                          Week 2
                        </button>
                    </div>

                    <div className="bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-md flex gap-1">
                        {daysOfWeek.map(day => (
                          <button 
                            key={day}
                            onClick={() => setCurrentDay(day)}
                            className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all ${currentDay === day ? 'bg-indigo-500 text-white shadow' : 'text-indigo-200 hover:bg-white/10'}`}
                          >
                            {day}
                          </button>
                        ))}
                    </div>
                    
                    <div className="bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-md flex gap-1">
                        <button onClick={() => setCurrentTime('before3pm')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${currentTime === 'before3pm' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                          Before 3 PM
                        </button>
                        <button onClick={() => setCurrentTime('after3pm')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${currentTime === 'after3pm' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                          After 3 PM
                        </button>
                    </div>
                   </>
                 )}

                 {/* Shared Controls */}
                 <div className="bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-md flex gap-1 font-bold">
                    <button onClick={() => setViewMode('today')} className={`px-4 py-2 text-sm rounded-lg transition-all ${viewMode === 'today' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                      Today
                    </button>
                    <button onClick={() => setViewMode('tomorrow')} className={`px-4 py-2 text-sm rounded-lg transition-all ${viewMode === 'tomorrow' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                      Tomorrow
                    </button>
                 </div>

                 <div className="bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-md flex gap-1">
                    {appMode === 'simulation' ? (
                      <button onClick={() => setIsHoliday(!isHoliday)} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${isHoliday ? 'bg-red-500 text-white shadow animate-pulse' : 'text-indigo-200 hover:bg-white/10'}`}>
                        🌴 Holiday Mode
                      </button>
                    ) : (
                      <div className="px-4 py-2 text-sm font-semibold text-indigo-300 flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4" /> 
                        Calendar Sync Active
                      </div>
                    )}
                 </div>

                 <div className="bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-md flex gap-1 w-full md:w-auto mt-2 md:mt-0">
                    <span className="text-xs text-indigo-300 self-center px-2 mr-1 uppercase font-bold tracking-wider">I am: </span>
                    <button onClick={() => setCurrentUserBatch('batch1')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentUserBatch === 'batch1' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                      Batch 1
                    </button>
                    <button onClick={() => setCurrentUserBatch('batch2')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentUserBatch === 'batch2' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-white/10'}`}>
                      Batch 2
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex gap-4 items-center">
            <div className="p-3 bg-brand-50 rounded-xl">
              <CalendarDaysIcon className="w-8 h-8 text-brand-600" />
            </div>
            <div>
              <p className="text-zinc-500 font-medium text-sm mb-1 uppercase tracking-wide">
                {appMode === 'actual' ? realDate : "Simulation Date"}
              </p>
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-dark-900 flex items-center gap-2">
                  {currentWeek === 'week1' ? 'Week 01' : 'Week 02'} - {targetDay}
                  {appMode === 'simulation' && <span className="text-sm font-normal text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded ml-2">Currently: {currentDay}</span>}
                </h2>
                <button 
                  onClick={handleResetDay}
                  className="px-3 py-1 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Reset All Bookings
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            {isTargetHoliday || isTargetWeekend ? (
              <div className="px-4 py-2 rounded-lg text-sm font-bold shadow-sm bg-red-100 text-red-700 border border-red-200">
                🌴 {isTargetWeekend ? 'Office Closed for Weekend' : 'Closed for Public Holiday'}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-zinc-500">Allocated Today:</span>
                  <span className="font-bold text-dark-900 bg-zinc-100 px-3 py-1 rounded-md">{activeBatch === 'batch1' ? 'Batch 1' : 'Batch 2'}</span>
                  {appMode === 'actual' && (
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 uppercase tracking-tighter">
                      Week {currentCalendarWeek}
                    </span>
                  )}
                </div>
                <div className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm ${isUserOnDay ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {isUserOnDay ? "✅ It's your scheduled office day" : "❌ It's NOT your office day"}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Floor Plan Visualization */}
        <div className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-zinc-100 pb-4 gap-4">
            <h3 className="text-xl font-bold text-dark-900">Interactive DB Floor Plan</h3>
            <div className="flex flex-wrap gap-4 text-xs font-medium bg-zinc-50 py-2 px-4 rounded-full border border-zinc-200">
               <div className="flex items-center gap-1.5">
                 <div className="w-3 h-3 rounded-full bg-brand-700 shadow-sm shadow-brand-500/50"></div>
                 <span className="text-zinc-600">Booked</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-200 shadow-sm shadow-green-500/50"></div>
                 <span className="text-zinc-600">Yours</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-3 h-3 rounded-full bg-zinc-200 border border-zinc-300"></div>
                 <span className="text-zinc-600">Available</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500 shadow-sm shadow-amber-400/50"></div>
                 <span className="text-zinc-600">Floater/Open</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-3 h-3 rounded-full bg-zinc-100 border border-zinc-200 opacity-50"></div>
                 <span className="text-zinc-600">Locked (3PM)</span>
               </div>
            </div>
          </div>
          
          <div className="bg-zinc-50/50 p-8 rounded-2xl border border-dashed border-zinc-300">
             <div className="max-w-4xl mx-auto flex flex-col items-center">
                 <div className="w-full mb-8 flex justify-center">
                   <div className="px-10 py-3 bg-zinc-200 text-zinc-500 font-bold rounded-xl text-sm border-2 border-zinc-300 border-dashed tracking-wider">
                     ENTRANCE / RECEPTION
                   </div>
                 </div>
                 <div className="w-full flex justify-center">
                   <div className="seat-grid">
                     {renderSeats()}
                   </div>
                 </div>
             </div>
          </div>
        </div>
      </main>

      {/* Booking / Cancellation Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-dark-900/40 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl relative overflow-hidden">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            <Dialog.Title className="text-2xl font-bold text-dark-900 mb-2">
              {modalMode === 'book' ? "Confirm Booking" : "Cancel Your Status"}
            </Dialog.Title>
            <Dialog.Description className="text-zinc-500 mb-6 text-sm">
              {modalMode === 'book' 
                ? `You are about to secure ${selectedSeat?.isFloater ? "Floater Seat " : "Desk "} #${selectedSeat?.id}.`
                : `Are you sure you want to cancel your presence at ${selectedSeat?.isFloater ? "Floater Seat " : "Desk "} #${selectedSeat?.id}? This will make the seat available for others.`
              }
            </Dialog.Description>
            
            <div className="bg-zinc-50 min-h-24 rounded-xl border border-zinc-200 p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-zinc-500">Day/Week</span>
                <span className="text-sm font-bold text-dark-900">{targetDay} ({currentWeek})</span>
              </div>
              <div className="flex justify-between items-center flex-wrap">
                <span className="text-sm font-medium text-zinc-500">Notice</span>
                {modalMode === 'cancel' ? (
                   <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 flex py-0.5 rounded text-right">Early Cancellation</span>
                ) : (
                  <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded text-right flex items-center gap-1">
                     <CheckCircleIcon className="w-4 h-4" /> Allowed by DB
                  </span>
                )}
              </div>
            </div>

            {modalMode === 'book' ? (
              <button 
                onClick={processAction}
                className="w-full py-4 rounded-xl bg-brand-600 text-white font-bold tracking-wide hover:bg-brand-500 active:bg-brand-700 transition-colors shadow-lg shadow-brand-500/30"
              >
                Secure My Desk
              </button>
            ) : (
              <button 
                onClick={processAction}
                className="w-full py-4 rounded-xl bg-red-500 text-white font-bold tracking-wide hover:bg-red-400 active:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
              >
                Cancel Booking
              </button>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}