import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Calendar as CalendarIcon, 
  Droplet, 
  Activity, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Smile, 
  Frown, 
  Meh,
  Thermometer,
  Moon,
  Coffee,
  Save,
  Menu,
  LogOut,
  Cloud // Imported Cloud icon here
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  User,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  doc, 
  updateDoc,
  Timestamp, 
  where,
  setDoc,
  getDoc
} from 'firebase/firestore';

// --- Configuration & Types ---

const getFirebaseConfig = () => {
  try {
    // @ts-ignore
    return JSON.parse(__firebase_config);
  } catch (e) {
    return {};
  }
};

const getAppId = () => {
  try {
    // @ts-ignore
    return typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  } catch (e) {
    return 'default-app-id';
  }
};

const getInitialToken = () => {
  try {
    // @ts-ignore
    return typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
  } catch (e) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = getAppId();

// --- Types ---

interface UserSettings {
  cycleLength: number; // Default 28
  periodLength: number; // Default 5
}

interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  flow: 'Light' | 'Medium' | 'Heavy' | 'Spotting' | null;
  mood: string | null;
  symptoms: string[];
  createdAt: Timestamp;
}

interface CycleEvent {
  date: string;
  type: 'period' | 'fertile' | 'ovulation' | 'prediction';
}

// --- Date Helpers ---

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDaysBetween = (start: Date, end: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((start.getTime() - end.getTime()) / oneDay));
};

// --- Components ---

const CycleWheel = ({ 
  currentDay, 
  cycleLength, 
  periodLength, 
  isPeriodToday,
  daysUntilNext
}: { 
  currentDay: number, 
  cycleLength: number, 
  periodLength: number,
  isPeriodToday: boolean,
  daysUntilNext: number
}) => {
  // Simple circular progress calculation
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  // Cap progress at 100% for visual sanity, though cycles can vary
  const progress = Math.min(currentDay / cycleLength, 1); 
  const dashoffset = circumference - progress * circumference;
  
  // Calculate phases for the ring (Visual approximation)
  const periodArc = (periodLength / cycleLength) * circumference;
  const fertileStart = ((cycleLength - 19) / cycleLength) * circumference; // Rough estimate: day 10-15 in 28 day cycle
  const fertileLength = (6 / cycleLength) * circumference;

  return (
    <div className="relative flex items-center justify-center py-8">
      {/* Outer decorative ring */}
      <div className="absolute w-[300px] h-[300px] rounded-full border-[20px] border-pink-50"></div>
      
      {/* SVG Progress */}
      <svg width="300" height="300" className="transform -rotate-90">
        {/* Background Track */}
        <circle
          cx="150" cy="150" r={radius}
          stroke="#fce7f3" // pink-100
          strokeWidth="24"
          fill="transparent"
        />
        
        {/* Period Phase Segment (Static visual guide) */}
        <circle
          cx="150" cy="150" r={radius}
          stroke="#fbcfe8" // pink-200
          strokeWidth="24"
          fill="transparent"
          strokeDasharray={`${periodArc} ${circumference}`}
          className="opacity-50"
        />

        {/* Progress Indicator */}
        <circle
          cx="150" cy="150" r={radius}
          stroke="#ec4899" // pink-500
          strokeWidth="24"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Center Content */}
      <div className="absolute flex flex-col items-center text-center animate-fade-in">
        {isPeriodToday ? (
          <div className="bg-rose-500 text-white p-3 rounded-full mb-2 shadow-lg shadow-rose-200">
            <Droplet size={32} fill="white" />
          </div>
        ) : (
          <div className="text-pink-400 mb-1">Day</div>
        )}
        
        <h2 className="text-6xl font-bold text-pink-600 font-serif">{currentDay}</h2>
        <p className="text-pink-400 text-sm font-medium uppercase tracking-wider mt-1">of {cycleLength} Days</p>
        
        <div className="mt-4 bg-white/80 backdrop-blur-sm px-4 py-1 rounded-full border border-pink-100 shadow-sm">
          <span className="text-rose-500 font-bold">{daysUntilNext} Days</span> <span className="text-pink-400 text-xs">until next period</span>
        </div>
      </div>
    </div>
  );
};

const Calendar = ({ 
  logs, 
  settings,
  onTogglePeriod
}: { 
  logs: DailyLog[], 
  settings: UserSettings,
  onTogglePeriod: (date: string) => void
}) => {
  const [viewDate, setViewDate] = useState(new Date());

  // Calculate Calendar Grid
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const startDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
  
  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - startDay + 1;
    if (day > 0 && day <= daysInMonth) return day;
    return null;
  });

  // Prediction Logic for Visuals
  // Find last period start to project future
  const periodDays = logs.filter(l => l.flow).map(l => l.date).sort();
  const lastPeriodStart = periodDays.length > 0 ? periodDays[periodDays.length - 1] : null;

  // Helper to check status of a specific date
  const getDateStatus = (day: number) => {
    const dateStr = formatDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
    const log = logs.find(l => l.date === dateStr);
    
    const isPeriod = !!log?.flow;
    const isToday = dateStr === formatDate(new Date());
    
    // Simple prediction logic (visual only)
    let isPredicted = false;
    let isFertile = false;

    if (lastPeriodStart) {
      const lastStart = new Date(lastPeriodStart);
      const current = new Date(dateStr);
      const diffTime = Math.abs(current.getTime() - lastStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // If date is in future
      if (current > new Date()) {
        // Next period prediction
        const nextCycleStart = diffDays % settings.cycleLength;
        if (nextCycleStart < settings.periodLength && diffDays > 0) {
           // This is a simplistic repeating check, real apps use more complex logic
           // For this demo, we'll just project the NEXT cycle
           const daysSinceLast = getDaysBetween(lastStart, current);
           if (daysSinceLast >= settings.cycleLength && daysSinceLast < settings.cycleLength + settings.periodLength) {
             isPredicted = true;
           }
        }
        
        // Fertile window (approx days 12-16 before next period)
        const dayOfCycle = diffDays % settings.cycleLength;
        // Ovulation is roughly 14 days before next period
        const ovulationDay = settings.cycleLength - 14;
        if (dayOfCycle >= ovulationDay - 4 && dayOfCycle <= ovulationDay + 1) {
          isFertile = true;
        }
      }
    }

    return { dateStr, isPeriod, isToday, isPredicted, isFertile };
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-pink-100/50 p-6 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="p-2 bg-pink-50 rounded-full text-pink-600 hover:bg-pink-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-xl font-bold text-slate-700">
          {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <button 
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="p-2 bg-pink-50 rounded-full text-pink-600 hover:bg-pink-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-pink-300">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          if (!day) return <div key={i} className="h-10"></div>;
          
          const { dateStr, isPeriod, isToday, isPredicted, isFertile } = getDateStatus(day);
          
          return (
            <button
              key={i}
              onClick={() => onTogglePeriod(dateStr)}
              className={`
                h-10 rounded-full flex items-center justify-center text-sm relative transition-all
                ${isToday ? 'ring-2 ring-pink-400 font-bold' : ''}
                ${isPeriod 
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-200' 
                  : isPredicted 
                    ? 'bg-pink-100 text-pink-600 border border-pink-200 border-dashed' 
                    : isFertile
                      ? 'bg-purple-50 text-purple-600'
                      : 'hover:bg-pink-50 text-slate-600'}
              `}
            >
              {day}
              {isFertile && !isPeriod && <div className="absolute bottom-1 w-1 h-1 bg-purple-400 rounded-full"></div>}
            </button>
          );
        })}
      </div>
      
      <div className="flex justify-center gap-4 mt-6 text-xs text-slate-400">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-rose-500"></div> Period</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-pink-100 border border-dashed border-pink-300"></div> Predicted</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-100"></div> Fertile</div>
      </div>
    </div>
  );
};

const DailyLogger = ({ 
  date, 
  existingLog, 
  onSave 
}: { 
  date: string, 
  existingLog: DailyLog | undefined, 
  onSave: (data: Partial<DailyLog>) => void 
}) => {
  const [mood, setMood] = useState(existingLog?.mood || null);
  const [flow, setFlow] = useState(existingLog?.flow || null);
  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms || []);

  useEffect(() => {
    setMood(existingLog?.mood || null);
    setFlow(existingLog?.flow || null);
    setSymptoms(existingLog?.symptoms || []);
  }, [existingLog]);

  const toggleSymptom = (sym: string) => {
    if (symptoms.includes(sym)) {
      setSymptoms(symptoms.filter(s => s !== sym));
    } else {
      setSymptoms([...symptoms, sym]);
    }
  };

  const handleSave = () => {
    onSave({ date, mood, flow, symptoms });
  };

  const SymptomChip = ({ label, icon: Icon }: { label: string, icon: any }) => (
    <button
      onClick={() => toggleSymptom(label)}
      className={`
        flex flex-col items-center justify-center p-3 rounded-xl border transition-all
        ${symptoms.includes(label) 
          ? 'bg-pink-500 text-white border-pink-600 shadow-md' 
          : 'bg-white text-slate-500 border-slate-100 hover:border-pink-200'}
      `}
    >
      <Icon size={20} className="mb-1" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-pink-100/50 p-6 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-700">Log for {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h3>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-rose-200 active:scale-95 transition-all"
        >
          <Save size={16} /> Save
        </button>
      </div>

      <div className="space-y-6">
        {/* Flow Section */}
        <div>
          <label className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3 block">Flow Intensity</label>
          <div className="flex justify-between bg-pink-50 p-1 rounded-xl">
            {['Spotting', 'Light', 'Medium', 'Heavy'].map((level) => (
              <button
                key={level}
                onClick={() => setFlow(level as any)}
                className={`
                  flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${flow === level ? 'bg-white text-rose-500 shadow-sm' : 'text-pink-300 hover:text-pink-500'}
                `}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Mood Section */}
        <div>
          <label className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3 block">Mood</label>
          <div className="flex justify-between gap-2">
            {[
              { label: 'Happy', icon: Smile },
              { label: 'Neutral', icon: Meh },
              { label: 'Sad', icon: Frown },
              { label: 'Tired', icon: Moon },
            ].map((m) => (
              <button
                key={m.label}
                onClick={() => setMood(m.label)}
                className={`
                  flex-1 flex flex-col items-center p-3 rounded-xl border transition-all
                  ${mood === m.label ? 'bg-pink-100 border-pink-300 text-pink-600' : 'bg-white border-slate-100 text-slate-400'}
                `}
              >
                <m.icon size={24} className="mb-1" />
                <span className="text-[10px]">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Symptoms Section */}
        <div>
          <label className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3 block">Symptoms</label>
          <div className="grid grid-cols-4 gap-2">
            <SymptomChip label="Cramps" icon={Activity} />
            <SymptomChip label="Headache" icon={Thermometer} />
            <SymptomChip label="Bloating" icon={Cloud} />
            <SymptomChip label="Cravings" icon={Coffee} />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function Gyneo() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'calendar' | 'log'>('dashboard');
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ cycleLength: 28, periodLength: 5 });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dashboard calculations
  const [currentDay, setCurrentDay] = useState(1);
  const [daysUntilNext, setDaysUntilNext] = useState(28);
  const [isPeriodToday, setIsPeriodToday] = useState(false);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      const token = getInitialToken();
      if (token) await signInWithCustomToken(auth, token);
      else await signInAnonymously(auth);
    };
    initAuth();

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;

    // Fetch Settings
    const fetchSettings = async () => {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'preferences');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSettings(snap.data() as UserSettings);
      } else {
        // Initialize defaults
        await setDoc(docRef, { cycleLength: 28, periodLength: 5 });
      }
    };
    fetchSettings();

    // Fetch Logs
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'logs'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyLog));
      setLogs(fetchedLogs);
      calculateCycleStats(fetchedLogs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const calculateCycleStats = (currentLogs: DailyLog[]) => {
    // Find most recent period
    // Note: In a real app, we would group consecutive logs into cycles.
    // Here we simplify: find the last log with 'flow' that isn't more than 5 days apart from another flow log
    const flowLogs = currentLogs.filter(l => l.flow !== null).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (flowLogs.length === 0) {
      setCurrentDay(1);
      setDaysUntilNext(28);
      setIsPeriodToday(false);
      return;
    }

    // Last period start logic (simplified)
    // We assume the most recent flow log is part of the current/last period
    const lastFlowDate = new Date(flowLogs[0].date);
    const today = new Date();
    
    // Calculate Day of Cycle
    // We need to find the START of this flow group. 
    // Simple approximation: Use the most recent flow date as "Day 1" if we don't have complex grouping logic
    // Better approximation: Look backwards from the most recent flow log until we find a gap > 7 days
    let startDate = lastFlowDate;
    // This logic would ideally iterate backwards to find the true start of the current cycle
    
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    setCurrentDay(diffDays);
    setDaysUntilNext(Math.max(0, settings.cycleLength - diffDays));
    
    // Is period today?
    const todayStr = formatDate(today);
    setIsPeriodToday(!!currentLogs.find(l => l.date === todayStr && l.flow));
  };

  const handleLogSave = async (data: Partial<DailyLog>) => {
    if (!user) return;
    const dateStr = data.date!;
    
    // Check if exists
    const existing = logs.find(l => l.date === dateStr);
    
    if (existing) {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', existing.id);
      // If all data is removed, delete the doc
      if (!data.flow && !data.mood && (!data.symptoms || data.symptoms.length === 0)) {
        await deleteDoc(docRef);
      } else {
        await updateDoc(docRef, { ...data });
      }
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'), {
        ...data,
        createdAt: serverTimestamp()
      });
    }
  };

  const handleTogglePeriod = async (date: string) => {
    // Quick toggle for calendar view
    const existing = logs.find(l => l.date === date);
    if (existing && existing.flow) {
      // Turn off
      handleLogSave({ date, flow: null });
    } else {
      // Turn on (default medium)
      handleLogSave({ date, flow: 'Medium' });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center text-rose-400">
        <Heart size={48} className="mb-4 fill-current" />
        <h1 className="text-2xl font-serif font-bold">Gyneo</h1>
        <p className="text-sm">Loading your cycle data...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-pink-50 font-sans text-slate-800 flex overflow-hidden">
      
      {/* Sidebar / Mobile Drawer */}
      <aside className={`
        fixed md:relative z-20 inset-y-0 left-0 w-64 bg-white border-r border-pink-100 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col shadow-2xl md:shadow-none
      `}>
        <div className="p-8 flex items-center gap-3 text-rose-500">
          <div className="bg-rose-100 p-2 rounded-xl">
            <Heart className="fill-rose-500" size={24} />
          </div>
          <span className="font-serif text-2xl font-bold tracking-tight">Gyneo</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {[
            { id: 'dashboard', icon: Activity, label: 'My Cycle' },
            { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
            { id: 'log', icon: Plus, label: 'Daily Log' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id as any); setSidebarOpen(false); }}
              className={`
                w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-medium transition-all
                ${view === item.id 
                  ? 'bg-rose-50 text-rose-600 shadow-sm' 
                  : 'text-slate-400 hover:bg-pink-50 hover:text-pink-500'}
              `}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6">
          <div className="bg-gradient-to-br from-rose-400 to-pink-500 rounded-2xl p-4 text-white text-center shadow-lg shadow-rose-200">
            <p className="text-xs opacity-80 mb-1 uppercase tracking-wider font-bold">Next Period</p>
            <p className="text-2xl font-bold font-serif">In {daysUntilNext} Days</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="px-6 py-4 bg-white/50 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center md:hidden">
           <div className="flex items-center gap-2 text-rose-500 font-serif font-bold text-xl">
             <Heart className="fill-current" size={20} /> Gyneo
           </div>
           <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-500 p-2">
             {sidebarOpen ? <X /> : <Menu />}
           </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          <div className="max-w-lg mx-auto w-full space-y-8">
            
            {view === 'dashboard' && (
              <div className="animate-fade-in space-y-8">
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold text-slate-700">Hello, Beautiful</h2>
                  <p className="text-slate-400 text-sm">Here is your cycle summary for today.</p>
                </div>

                <CycleWheel 
                  currentDay={currentDay} 
                  cycleLength={settings.cycleLength}
                  periodLength={settings.periodLength}
                  isPeriodToday={isPeriodToday}
                  daysUntilNext={daysUntilNext}
                />

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setView('log')}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-pink-100 hover:shadow-md hover:-translate-y-1 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-3 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                      <Plus size={20} />
                    </div>
                    <span className="block text-slate-600 font-bold text-sm">Log Symptoms</span>
                    <span className="text-xs text-slate-400">How do you feel?</span>
                  </button>

                  <button 
                    onClick={() => setView('calendar')}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-pink-100 hover:shadow-md hover:-translate-y-1 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mb-3 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                      <CalendarIcon size={20} />
                    </div>
                    <span className="block text-slate-600 font-bold text-sm">View Calendar</span>
                    <span className="text-xs text-slate-400">Check history</span>
                  </button>
                </div>
              </div>
            )}

            {view === 'calendar' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-rose-500">
                    <ChevronLeft />
                  </button>
                  <h2 className="text-2xl font-bold text-slate-700">Calendar</h2>
                </div>
                <Calendar 
                  logs={logs} 
                  settings={settings}
                  onTogglePeriod={handleTogglePeriod}
                />
              </div>
            )}

            {view === 'log' && (
              <div className="space-y-6">
                 <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-rose-500">
                    <ChevronLeft />
                  </button>
                  <h2 className="text-2xl font-bold text-slate-700">Daily Log</h2>
                </div>
                <DailyLogger 
                  date={formatDate(new Date())} 
                  existingLog={logs.find(l => l.date === formatDate(new Date()))}
                  onSave={handleLogSave}
                />
              </div>
            )}

          </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .animate-slide-up {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 0px;
        }
      `}</style>
    </div>
  );
}