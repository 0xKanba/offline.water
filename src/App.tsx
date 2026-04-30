import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createRecord, confirmDelivery, createPaymentCode, confirmPayment, deletePendingRecord, cancelPaymentRequest } from './db/db';
import { Droplet, CheckCircle, HandCoins, ArrowRight, Truck, UserCircle, QrCode, WifiOff, Wifi, MessageCircle, Trash2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

type Screen = 'HOME' | 'PROVIDER' | 'CUSTOMER';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    return (localStorage.getItem('user_role') as Screen) || 'HOME';
  });
  const isOnline = useOnlineStatus();

  const handleSetScreen = (s: Screen) => {
    localStorage.setItem('user_role', s);
    setScreen(s);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSetScreen('HOME')}>
          <Droplet className="w-6 h-6" />
          <h1 className="text-xl font-bold">توثيق المياه</h1>
        </div>
        <div className="flex items-center gap-3">
          {isOnline ? (
            <div className="flex items-center gap-1 text-xs bg-blue-700/50 px-2 py-1 rounded-full text-blue-100" title="متصل بالإنترنت">
              <Wifi className="w-3 h-3" />
              <span>متصل</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs bg-orange-500/80 px-2 py-1 rounded-full text-white" title="يعمل بدون إنترنت (Offline)">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}
          {screen !== 'HOME' && (
            <button 
              onClick={() => handleSetScreen('HOME')}
              className="text-sm bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded-full transition"
            >
              تغيير الحساب
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto p-4 space-y-6 container pb-20" dir="rtl">
        {screen === 'HOME' && <HomeScreen setScreen={handleSetScreen} />}
        {screen === 'PROVIDER' && <ProviderScreen />}
        {screen === 'CUSTOMER' && <CustomerScreen />}
      </main>
    </div>
  );
}

function HomeScreen({ setScreen }: { setScreen: (s: Screen) => void }) {
  return (
    <div className="flex flex-col gap-6 mt-10">
      <h2 className="text-2xl font-bold text-center text-slate-800 mb-4">مرحباً بك في نظام التوثيق</h2>
      
      <button 
        onClick={() => setScreen('PROVIDER')}
        className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition group"
      >
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-4 rounded-full text-blue-600">
            <Truck className="w-8 h-8" />
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold text-slate-800">مزود الخدمة</h3>
            <p className="text-slate-500 text-sm mt-1">إنشاء عمليات، طلب دفع، وإدارة السجلات</p>
          </div>
        </div>
        <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-blue-500 rotate-180 transition-transform" />
      </button>

      <button 
        onClick={() => setScreen('CUSTOMER')}
        className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition group"
      >
        <div className="flex items-center gap-4">
          <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
            <UserCircle className="w-8 h-8" />
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold text-slate-800">الزبون</h3>
            <p className="text-slate-500 text-sm mt-1">تأكيد استلام المياه وتأكيد الدفع</p>
          </div>
        </div>
        <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 rotate-180 transition-transform" />
      </button>

      <div className="mt-8 text-center bg-blue-50 p-4 rounded-xl">
        <p className="text-sm text-blue-800 font-medium">✨ يعمل التطبيق بدون إنترنت (Offline)</p>
      </div>
    </div>
  );
}

function ProviderScreen() {
  const records = useLiveQuery(() => db.records.orderBy('created_at').reverse().toArray());
  const [loading, setLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState('');

  const pendingRecords = records?.filter(r => r.status === 'PENDING') || [];
  const confirmedRecords = records?.filter(r => r.status === 'CONFIRMED') || [];
  const paidRecords = records?.filter(r => r.status === 'PAID') || [];

  const handleCreateRecord = async () => {
    if (!newCustomer.trim()) {
      alert('يرجى كتابة اسم الزبون أو المنزل أولاً');
      return;
    }
    setLoading(true);
    try {
      await createRecord(newCustomer.trim(), 5000); // 5000 is default price
      setNewCustomer('');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    const unpaids = confirmedRecords.map(r => r.id);
    if (unpaids.length === 0) return;
    setLoading(true);
    try {
      await createPaymentCode(unpaids);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePending = async (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من إلغاء عملية التوصيل لـ (${name})؟`)) {
      await deletePendingRecord(id);
    }
  };

  const handleCancelPayment = async (code: string) => {
    if (confirm('هل أنت متأكد من إلغاء طلب الدفع هذا؟')) {
      await cancelPaymentRequest(code);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      
      {/* Actions */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
        <label className="block text-sm font-bold text-slate-700 mb-2">اسم الزبون / المنزل</label>
        <input 
          type="text" 
          value={newCustomer}
          onChange={e => setNewCustomer(e.target.value)}
          placeholder="مثال: بيت أبو محمد"
          className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-blue-500 transition"
        />
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleCreateRecord}
            disabled={loading || !newCustomer.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-200 transition active:scale-95 flex flex-col items-center gap-2"
          >
            <Droplet className="w-8 h-8" />
            <span>توصيلة جديدة</span>
          </button>
          
          <button 
            onClick={handleRequestPayment}
            disabled={loading || confirmedRecords.length === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:active:scale-100 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-purple-200 transition active:scale-95 flex flex-col items-center gap-2 relative"
          >
            <HandCoins className="w-8 h-8" />
            <span>طلب دفع الديون</span>
            {confirmedRecords.length > 0 && (
              <span className="text-xs bg-white text-purple-700 px-2 py-0.5 rounded-full absolute top-2 right-2">
                {confirmedRecords.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* PENDING / CODES TO SHOW CUSTOMER */}
      {pendingRecords.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-4">
          <h3 className="font-bold text-orange-800 flex items-center gap-2">
            <QrCode className="w-5 h-5"/> 
            توصيلات بانتظار التأكيد (غير مكتملة)
          </h3>
          <div className="space-y-3">
            {pendingRecords.map(record => (
              <div key={record.id} className="bg-white p-4 rounded-2xl border border-orange-100 flex flex-col justify-between items-center shadow-sm gap-4 relative">
                <button 
                  onClick={() => handleDeletePending(record.id, record.customer_name)}
                  className="absolute top-3 left-3 p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition"
                  title="حذف العملية"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="text-center w-full sm:w-auto px-6">
                  <p className="font-bold text-xl text-slate-800">{record.customer_name}</p>
                  <p className="text-xs text-slate-400 mt-1">{format(record.created_at, 'yyyy/MM/dd hh:mm a')}</p>
                </div>
                <div className="flex flex-col items-center gap-2 w-full">
                  <p className="text-sm text-orange-600 font-bold">كود التسليم</p>
                  <div className="bg-orange-100/80 text-orange-800 text-3xl font-mono py-4 rounded-xl tracking-[0.3em] font-bold w-full text-center border-2 border-orange-200/50 shadow-inner">
                    {record.delivery_code}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAYMENT CODES TO SHOW CUSTOMER */}
      {confirmedRecords.some(r => r.payment_code) && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-4">
          <h3 className="font-bold text-purple-800 flex items-center gap-2">
            <QrCode className="w-5 h-5"/> 
            مبالغ بانتظار تأكيد الدفع
          </h3>
          <div className="space-y-3">
            {Array.from(new Set(confirmedRecords.map(r => r.payment_code).filter(Boolean))).map(code => {
              const items = confirmedRecords.filter(r => r.payment_code === code);
              // Group customers involved in this payment code (could be one customer multiple times)
              const customers = Array.from(new Set(items.map(i => i.customer_name))).join('، ');
              const total = items.reduce((sum, item) => sum + item.price, 0);
              return (
                <div key={code} className="bg-white p-4 rounded-2xl border border-purple-100 flex flex-col justify-between items-center shadow-sm gap-4 relative">
                  <button 
                    onClick={() => handleCancelPayment(code as string)}
                    className="absolute top-3 left-3 p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition"
                    title="تراجع عن الدفع"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                  <div className="text-center w-full px-6">
                    <p className="font-bold text-xl text-slate-800">{customers}</p>
                    <p className="text-sm text-slate-500 mt-2">{items.length} توصيلات • المجموع: <span className="font-bold text-slate-800">{total.toLocaleString()} ד.ع</span></p>
                  </div>
                  <div className="flex flex-col items-center gap-2 w-full">
                    <p className="text-sm text-purple-600 font-bold">كود الدفع</p>
                    <div className="bg-purple-100/80 text-purple-800 text-3xl font-mono py-4 rounded-xl tracking-[0.3em] font-bold w-full text-center border-2 border-purple-200/50 shadow-inner">
                      {code}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONFIRMED UNPAID */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-700 border-b pb-2">ديون بانتظار الدفع ({confirmedRecords.length})</h3>
        {confirmedRecords.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">لا توجد ديون معلقة</p>
        ) : (
          confirmedRecords.map(record => (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
              <div>
                <p className="font-bold text-slate-700">{record.customer_name}</p>
                <p className="text-xs text-slate-400 mt-1">{format(record.created_at, 'yyyy/MM/dd')}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-700">{record.price.toLocaleString()} د.ع</p>
                <div className="flex items-center gap-1 mt-1 justify-end text-blue-600">
                  <span className="text-xs font-bold">مستلمة </span>
                  <CheckCircle className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

       {/* PAID */}
       <div className="space-y-3">
        <h3 className="font-bold text-slate-700 border-b pb-2">عمليات مكتملة ومدفوعة ({paidRecords.length})</h3>
        {paidRecords.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">لا توجد عمليات مكتملة</p>
        ) : (
          paidRecords.map(record => (
            <div key={record.id} className="bg-white p-3 rounded-xl border border-emerald-100 flex justify-between items-center opacity-70">
              <div>
                <p className="font-bold text-slate-700">{record.customer_name}</p>
                <p className="text-xs text-slate-400 mt-1">{format(record.created_at, 'yyyy/MM/dd')}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-700">{record.price.toLocaleString()} د.ع</p>
                <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full mt-1 inline-block">خالصة</span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

function CustomerScreen() {
  const [profile, setProfile] = useState<{name: string, phone: string} | null>(() => {
    const data = localStorage.getItem('customer_profile');
    return data ? JSON.parse(data) : null;
  });

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile Form State
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const handleSaveProfile = () => {
    if (!nameInput.trim() || !phoneInput.trim()) return;
    const newProfile = { name: nameInput.trim(), phone: phoneInput.trim() };
    localStorage.setItem('customer_profile', JSON.stringify(newProfile));
    setProfile(newProfile);
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center pt-8 space-y-6 animate-in fade-in duration-300">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 w-full max-w-sm">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <UserCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-center text-slate-800 mb-2">تسجيل الدخول لتطبيقك</h2>
          <p className="text-sm text-slate-500 mb-6 text-center">فضلاً أدخل اسمك ورقم هاتفك (لمرة واحدة فقط)</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">الاسم الكامل</label>
              <input 
                type="text" 
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="مثال: عباس المحمداوي"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف (الواتساب)</label>
              <input 
                type="tel" 
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value.replace(/[^0-9+]/g, ''))}
                placeholder="07..."
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition dir-ltr"
                style={{ direction: 'ltr' }}
              />
            </div>
            <button 
              onClick={handleSaveProfile}
              disabled={!nameInput.trim() || !phoneInput.trim()}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-md transition active:scale-95"
            >
              دخول للتطبيق
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setStatus('IDLE');
    try {
      // First try delivery code
      const deliveryRes = await confirmDelivery(code);
      if (deliveryRes.success && deliveryRes.record) {
        setStatus('SUCCESS');
        setMessage(`تم تأكيد استلام المياه بنجاح لـ (${deliveryRes.record.customer_name})`);
        setCode('');
        return;
      }
      // If not, try payment code
      const paymentRes = await confirmPayment(code);
      if (paymentRes.success) {
        setStatus('SUCCESS');
        setMessage(`تم تأكيد دفع مبلغ ${paymentRes.total?.toLocaleString()} د.ع لعدد ${paymentRes.count} توصيلة`);
        setCode('');
        return;
      }
      
      // Error
      setStatus('ERROR');
      setMessage('الكود غير صحيح أو أن العملية غير موجودة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-8 space-y-8 animate-in fade-in duration-300">
      <div className="w-full max-w-sm text-center mb-[-1rem]">
         <p className="text-xl font-bold text-slate-800">مرحباً، {profile.name}</p>
         <p className="text-sm text-slate-500">{profile.phone}</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 w-full max-w-sm text-center">
        <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <UserCircle className="w-14 h-14 text-emerald-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-2">تأكيد العملية</h2>
        <p className="text-sm text-slate-500 mb-8 px-2">أدخل الكود الذي أعطاه لك مزود الخدمة لتأكيد استلامك للمياه أو لتأكيد الدفع</p>

        <div className="mb-8 space-y-2">
          <input 
            type="tel" 
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0 0 0 0 0 0"
            className="w-full text-center text-4xl sm:text-5xl tracking-[0.3em] font-mono font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl py-5 focus:outline-none focus:border-emerald-500 focus:bg-white transition dir-ltr placeholder:text-slate-200 shadow-inner"
            style={{ direction: 'ltr' }}
          />
        </div>

        <button 
          onClick={handleConfirm}
          disabled={code.length !== 6 || loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:bg-slate-300 text-white font-bold py-5 rounded-2xl shadow-lg shadow-emerald-200 transition active:scale-95 text-xl"
        >
          {loading ? 'جاري التحقق...' : 'تأكيد'}
        </button>

        {status === 'SUCCESS' && (
          <div className="mt-6 p-5 bg-emerald-50 text-emerald-800 rounded-xl border-2 border-emerald-200 text-sm font-bold flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
            <span className="text-base text-center leading-relaxed">{message}</span>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border-2 border-red-200 text-sm font-bold animate-in shake">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
