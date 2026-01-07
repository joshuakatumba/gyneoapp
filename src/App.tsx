import { useState, useEffect } from 'react';
import {
  Heart,
  Calendar as CalendarIcon,
  Droplet,
  Activity,
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
  Cloud,
  LogOut,
  Settings as SettingsIcon
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  type User,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
  setDoc,
  enableIndexedDbPersistence
} from 'firebase/firestore';

// --- Configuration & Types ---

console.log("App.tsx module executing");

const getFirebaseConfig = () => {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
  };
  console.log("Firebase Config:", config);
  return config;
};

const getAppId = () => {
  return 'gyneo-default';
};

// Initialize Firebase only if config is valid to prevent crash during dev without env
let app: any;
let auth: any;
let db: any;

try {
  const firebaseConfig = getFirebaseConfig();
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('Persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
      console.log('Persistence not supported');
    }
  });
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization failed:", error);
  // Establish mock/empty objects to prevent immediate crash, though functionality will break
  app = {} as any;
  auth = {} as any;
  db = {} as any;
}
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

// --- Date Helpers ---

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

// --- Settings Component ---
const SettingsForm = ({
  settings,
  onSave
}: {
  settings: UserSettings,
  onSave: (data: UserSettings) => void
}) => {
  const [cycleLength, setCycleLength] = useState(settings.cycleLength);
  const [periodLength, setPeriodLength] = useState(settings.periodLength);

  const handleSave = () => {
    onSave({ cycleLength: parseInt(String(cycleLength)), periodLength: parseInt(String(periodLength)) });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-pink-100/50 p-6 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-700">Settings</h3>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-rose-200 active:scale-95 transition-all"
        >
          <Save size={16} /> Save Changes
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Average Cycle Length (Days)
          </label>
          <p className="text-xs text-slate-400 mb-3">The number of days between the start of one period and the next.</p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={cycleLength}
              onChange={(e) => setCycleLength(parseInt(e.target.value) || 0)}
              className="flex-1 bg-pink-50 border-none rounded-xl p-4 text-center text-2xl font-bold text-rose-500 focus:ring-2 focus:ring-rose-200 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Period Duration (Days)
          </label>
          <p className="text-xs text-slate-400 mb-3">How many days your period usually lasts.</p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={periodLength}
              onChange={(e) => setPeriodLength(parseInt(e.target.value) || 0)}
              className="flex-1 bg-pink-50 border-none rounded-xl p-4 text-center text-2xl font-bold text-rose-500 focus:ring-2 focus:ring-rose-200 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Login Component ---
const GoogleSignInButton = () => {
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-In failed:", error);
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      className="flex items-center justify-center gap-3 bg-white text-slate-700 px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all text-lg font-medium"
    >
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className="w-6 h-6" />
      Sign in with Google
    </button>
  );
};

const LoginScreen = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center max-w-md w-full animate-fade-in">
        <div className="flex items-center justify-center gap-3 text-rose-500 mb-6">
          <div className="bg-rose-100 p-3 rounded-xl">
            <Heart className="fill-rose-500" size={32} />
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-tight">Gyneo</h1>
        </div>
        <p className="text-slate-600 mb-8 text-lg">Your personal cycle tracker.</p>
        <GoogleSignInButton />
        <p className="text-xs text-slate-400 mt-6">By signing in, you agree to our terms and conditions.</p>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function Gyneo() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'calendar' | 'log' | 'settings'>('dashboard');
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
    // Just listen for auth state
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;

    // Fetch Settings (Real-time)
    let unsubscribeSettings: () => void = () => { }; // Initialize with a no-op function
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'preferences');
      unsubscribeSettings = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as UserSettings);
        } else {
          // Initialize defaults if missing
          setDoc(docRef, { cycleLength: 28, periodLength: 5 });
        }
      });
    } catch (e) {
      console.log("Firestore settings fetch failed (mocking):", e);
    }

    // Fetch Logs
    try {
      const q = query(
        collection(db, 'artifacts', appId, 'users', user.uid, 'logs'),
        orderBy('date', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snap) => {
        const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyLog));
        setLogs(fetchedLogs);
        calculateCycleStats(fetchedLogs);
        setLoading(false);
      }, (err) => {
        console.error("Firestore error:", err);
        setLoading(false);
      });
      return () => {
        unsubscribe();
        if (unsubscribeSettings) unsubscribeSettings();
      };
    } catch (e) {
      console.error("Firestore setup failed:", e);
      setLoading(false);
    }
  }, [user]);

  const calculateCycleStats = (currentLogs: DailyLog[]) => {
    try {
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

      // Automatic Prediction Logic
      // If we have enough history (at least 2 periods), calculate the average cycle length
      let predictedCycleLength = settings.cycleLength;
      if (flowLogs.length >= 2) {
        // Find gaps between period starts.
        // Simple logic: Difference between Start of Period A and Start of Period B
        // This requires grouping logs into "periods"

        const periodStarts: Date[] = [];
        let currentPeriodGroupDate: Date = new Date(flowLogs[0].date);
        periodStarts.push(currentPeriodGroupDate);

        for (let i = 1; i < flowLogs.length; i++) {
          const prevDate = new Date(flowLogs[i - 1].date);
          const currDate = new Date(flowLogs[i].date);
          const diffDays = Math.abs((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

          // If gap is large (> 7 days), it's a new period start (backwards in time)
          if (diffDays > 7) {
            periodStarts.push(currDate);
          }
        }

        if (periodStarts.length >= 2) {
          let totalDays = 0;
          let count = 0;
          // Calculate average gap
          for (let i = 0; i < periodStarts.length - 1; i++) {
            // periodStarts is sorted desc (newest first)
            // Gap = Start[i] - Start[i+1]
            const gap = Math.abs((periodStarts[i].getTime() - periodStarts[i + 1].getTime()) / (1000 * 60 * 60 * 24));
            // Filter out crazy outliers (e.g., missed months -> >45 days)
            if (gap > 20 && gap < 45) {
              totalDays += gap;
              count++;
            }
          }
          if (count > 0) {
            predictedCycleLength = Math.round(totalDays / count);
          }
        }
      }

      setDaysUntilNext(Math.max(0, predictedCycleLength - diffDays));

      // Is period today?
      const todayStr = formatDate(today);
      setIsPeriodToday(!!currentLogs.find(l => l.date === todayStr && l.flow));
    } catch (e) {
      console.error("Cycle calculation error:", e);
      // Safe defaults
      setCurrentDay(1);
      setDaysUntilNext(28);
    }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'preferences');
      await setDoc(docRef, newSettings);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
    setView('dashboard');
  };

  const handleLogSave = async (data: Partial<DailyLog>) => {
    const dateStr = data.date!;

    // Optimistic Update
    setLogs(prev => {
      // We use dateStr as ID now, so strict uniqueness is enforced
      const exists = prev.find(l => l.date === dateStr);
      if (exists) {
        return prev.map(l => l.date === dateStr ? { ...l, ...data } : l);
      }
      return [{ id: dateStr, createdAt: Timestamp.now(), ...data } as DailyLog, ...prev];
    });

    if (!user) return;

    try {
      // Use date as the document ID to prevent race conditions with auto-IDs
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateStr);

      // If clearing all data, delete the doc
      if (!data.flow && !data.mood && (!data.symptoms || data.symptoms.length === 0)) {
        await deleteDoc(docRef);
      } else {
        // Merge true allows us to create or update without knowing if it exists
        await setDoc(docRef, { ...data }, { merge: true });
        console.log("Document successfully written!");
      }
    } catch (e) {
      console.error("Save failed:", e);
      alert("Failed to save to cloud. Check console.");
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
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );

  if (!user) {
    return <LoginScreen />;
  }

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
            { id: 'settings', icon: SettingsIcon, label: 'Settings' },
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
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-medium transition-all text-slate-400 hover:bg-pink-50 hover:text-pink-500"
          >
            <LogOut size={20} />
            Sign Out
          </button>
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

            {view === 'settings' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-rose-500">
                    <ChevronLeft />
                  </button>
                  <h2 className="text-2xl font-bold text-slate-700">Settings</h2>
                </div>
                <SettingsForm
                  settings={settings}
                  onSave={handleSaveSettings}
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
