import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog } from '@headlessui/react';
import { UsersIcon, MapPinIcon, CalendarIcon, ViewColumnsIcon, XMarkIcon, ClockIcon, UserCircleIcon, CheckCircleIcon, CalendarDaysIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';

const SEATS_TOTAL = 50;
const FLOATER_SEATS = 10;
const CAPACITY_BATCH = 40;
const API_URL = 'http://localhost:5001/api';

export default function App() {
  // --- Environment Mocks (SIMULATOR) ---
  const [currentUserBatch, setCurrentUserBatch] = useState('batch2'); 
  const [currentTime, setCurrentTime] = useState('before3pm'); 
  const [currentWeek, setCurrentWeek] = useState('week1'); 
  const [currentDay, setCurrentDay] = useState('Mon'); 

  // --- Derived State Engine ---
  const getActiveBatchAndRules = () => {
    const isEarlyWeek = ['Mon', 'Tue', 'Wed'].includes(currentDay);
    if (currentWeek === 'week1') return isEarlyWeek ? 'batch1' : 'batch2';
    return isEarlyWeek ? 'batch2' : 'batch1';
  };

  const activeBatch = getActiveBatchAndRules();
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
        params: { week: currentWeek, day: currentDay }
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
  }, [currentDay, currentWeek, currentUserBatch]);

  const handleInitDB = async () => {
    try {
      const res = await axios.post(`${API_URL}/init-desks`);
      alert(res.data.message || "Database structural seats initialized!");
    } catch (err) {
      alert(err.response?.data?.error || "Already initialized or server down.");
    }
  };

  const handleSeatClick = (seat) => {
    // Cancel own seat
    if (seat.bookedByCurrentUser) {
      setSelectedSeat(seat);
      setModalMode('cancel');
      setIsModalOpen(true);
      return;
    }

    // Prevent clicking seats booked by OTHERS
    if (seat.isBooked) return;

    // Rules logic
    if (!seat.isFloater) {
      if (!isUserOnDay && currentTime === 'before3pm') {
        alert("Before 3:00 PM, regular seats are reserved tightly for the allocated batch.\n\nSince you are off-batch today, you can only book a Floater seat right now.\n(Switch simulator to 'After 3:00 PM' to test releasing the seats!)");
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
          day: currentDay
        });
      } else {
        // Send actual DELETE to Database
        await axios.delete(`${API_URL}/bookings`, {
          data: {
             deskId: selectedSeat.id,
             userBatch: currentUserBatch,
             week: currentWeek,
             day: currentDay
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

  const renderSeats = () => {
    if (loading && seats.length === 0) return <div className="text-zinc-400 font-bold p-8 text-center animate-pulse w-full">Connecting to Database API...</div>;

    return seats.map((seat) => {
      let statusColor = "bg-zinc-200 text-zinc-400 border-zinc-300"; 
      
      const isLockedOut = !seat.isFloater && !isUserOnDay && currentTime === 'before3pm' && !seat.isBooked;

      if (seat.bookedByCurrentUser) {
        statusColor = "bg-green-500 text-white shadow-md shadow-green-500/50 border-green-400 ring-4 ring-green-200";
      } else if (seat.isBooked) {
        statusColor = "bg-brand-700 text-white shadow-md shadow-brand-500/50 border-brand-600 opacity-90 cursor-not-allowed";
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
            (seat.isBooked && !seat.bookedByCurrentUser) || isLockedOut
              ? statusColor 
              : `${statusColor} cursor-pointer hover:-translate-y-1 hover:shadow-lg`
          }`}
          title={
            seat.bookedByCurrentUser ? `Your Seat ${seat.id} (Click to Cancel)` : 
            seat.isBooked ? `Desk ${seat.id} (Booked by Colleague)` :
            isLockedOut ? `Desk ${seat.id} (Reserved for Batch until 3 PM)` :
            seat.isFloater ? `Floater Seat ${seat.id} (Available to anyone)` :
            `Desk ${seat.id} (Available to anyone)`
          }
        >
          {seat.isFloater ? "F" : seat.id}
        </div>
      );
    });
  };

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 font-sans">
      <nav className="glass-panel sticky top-0 z-50 px-8 py-4 flex justify-between items-center bg-white/80">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-500/30">
            <MapPinIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-dark-900">DeskSync <span className="text-zinc-400 font-light ml-1">Live DB</span></h1>
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
        
        {/* --- SIMULATOR CONTROLS --- */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 mb-10 text-white shadow-xl shadow-indigo-900/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-shrink-0">
              <h3 className="flex items-center gap-2 text-lg font-bold mb-1">
                <ClockIcon className="w-5 h-5 text-indigo-300" />
                Time & Calendar Simulator
              </h3>
              <p className="text-indigo-200 text-sm">Testing auto-allocation based on week/day.</p>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
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

        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex gap-4 items-center">
            <div className="p-3 bg-brand-50 rounded-xl">
              <CalendarDaysIcon className="w-8 h-8 text-brand-600" />
            </div>
            <div>
              <p className="text-zinc-500 font-medium text-sm mb-1 uppercase tracking-wide">Dynamic Engine Result</p>
              <h2 className="text-2xl font-bold text-dark-900 flex items-center gap-2">
                {currentWeek === 'week1' ? 'Week 01' : 'Week 02'} - {currentDay}
              </h2>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-zinc-500">Allocated Today:</span>
              <span className="font-bold text-dark-900 bg-zinc-100 px-3 py-1 rounded-md">{activeBatch === 'batch1' ? 'Batch 1' : 'Batch 2'}</span>
            </div>
            <div className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm ${isUserOnDay ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {isUserOnDay ? "✅ It's your scheduled office day" : "❌ It's NOT your office day"}
            </div>
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
                <span className="text-sm font-bold text-dark-900">{currentDay} ({currentWeek})</span>
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
