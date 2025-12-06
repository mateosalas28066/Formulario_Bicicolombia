import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
    Calendar, Clock, CheckCircle, XCircle, RefreshCw, LogOut, Phone,
    AlertTriangle, X, Plus, Wrench, Edit, Trash2, Check, ChevronRight
} from 'lucide-react';
import { SERVICE_DATA } from '../data/services';

const locales = {
    'es': es,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

export default function Dashboard() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(null); // { type: 'accept' | 'cancel', id: string }
    const [showRescheduleModal, setShowRescheduleModal] = useState(null); // { id: string }
    const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Reschedule state
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');

    // New Appointment State
    const [newApp, setNewApp] = useState(() => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-CA');
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return {
            name: '',
            phone: '',
            bikeType: 'MTB',
            date: dateStr,
            time: timeStr,
            comments: '',
            selectedServices: []
        };
    });

    // Calendar state
    const [view, setView] = useState('month');
    const [date, setDate] = useState(new Date());

    const navigate = useNavigate();

    useEffect(() => {
        checkUser();
        fetchAppointments();

        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) navigate('/login');
    };

    const fetchAppointments = async () => {
        const { data, error } = await supabase
            .from('citas')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setAppointments(data);
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const updateStatus = async (id, newStatus) => {
        const { error } = await supabase
            .from('citas')
            .update({ status: newStatus })
            .eq('id', id);

        if (!error) {
            fetchAppointments();
            setShowConfirmModal(null);
        }
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!showRescheduleModal || !newDate || !newTime) return;

        const { error } = await supabase
            .from('citas')
            .update({
                appointment_date: newDate,
                appointment_time: newTime,
                status: 'pending'
            })
            .eq('id', showRescheduleModal.id);

        if (!error) {
            fetchAppointments();
            setShowRescheduleModal(null);
            setNewDate('');
            setNewTime('');
        }
    };

    const handleNewAppServiceSelect = (service) => {
        setNewApp(prev => {
            const isSelected = prev.selectedServices.find(s => s.id === service.id);
            if (isSelected) {
                return { ...prev, selectedServices: prev.selectedServices.filter(s => s.id !== service.id) };
            } else {
                return { ...prev, selectedServices: [...prev.selectedServices, service] };
            }
        });
    };

    const handleCreateAppointment = async (e) => {
        e.preventDefault();

        if (newApp.selectedServices.length === 0) {
            alert("Selecciona al menos un servicio.");
            return;
        }

        const serviceNames = newApp.selectedServices.map(s => s.name).join(' + ');
        const serviceIds = newApp.selectedServices.map(s => s.id).join(',');
        const totalPrice = newApp.selectedServices.reduce((sum, s) => sum + s.price, 0);

        const { error } = await supabase
            .from('citas')
            .insert([
                {
                    client_name: newApp.name,
                    client_phone: newApp.phone,
                    client_email: '', // Optional for walk-ins
                    bike_type: newApp.bikeType,
                    service_id: serviceIds,
                    service_name: serviceNames,
                    service_price: totalPrice,
                    appointment_date: newApp.date,
                    appointment_time: newApp.time,
                    notes: newApp.comments,
                    status: 'confirmed' // Walk-ins are automatically confirmed
                }
            ]);

        if (!error) {
            // Trigger n8n Webhook
            const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || (typeof window !== 'undefined' && window.BICICOLOMBIA_WEBHOOK_URL);
            if (webhookUrl) {
                fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        client_name: newApp.name,
                        client_phone: newApp.phone,
                        bike_type: newApp.bikeType,
                        service_name: serviceNames,
                        service_price: totalPrice,
                        appointment_date: newApp.date,
                        appointment_time: newApp.time,
                        notes: newApp.comments,
                        created_at: new Date().toISOString()
                    })
                }).catch(err => console.error('Webhook Error:', err));
            }

            fetchAppointments();
            setShowNewAppointmentModal(false);
            setNewApp(prev => {
                const now = new Date();
                return {
                    name: '',
                    phone: '',
                    bikeType: 'MTB',
                    date: now.toLocaleDateString('en-CA'),
                    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                    comments: '',
                    selectedServices: []
                };
            });
        } else {
            console.error(error);
            alert("Error al crear la cita.");
        }
    };

    // Helper to capitalize names
    const capitalizeName = (name) => {
        if (!name) return '';
        return name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
    };

    // Filter appointments
    const recentAppointments = appointments;

    // Map confirmed appointments to calendar events (Entry and Exit)
    const events = appointments
        .filter(app => app.status === 'confirmed')
        .flatMap(app => {
            const start = new Date(`${app.appointment_date}T${app.appointment_time}`);
            const serviceNames = (app.service_name || '').split(' + ');

            // Heuristic to count Express vs Normal services
            let expressCount = 0;
            let normalCount = 0;

            serviceNames.forEach(name => {
                const lowerName = name.toLowerCase();
                const isExpress =
                    lowerName.includes('despinchada') ||
                    lowerName.includes('cambio de rin') ||
                    lowerName.includes('cobalada') ||
                    lowerName.includes('purgada') ||
                    lowerName.includes('cambio pastillas') ||
                    lowerName.includes('cambio de borradores') ||
                    lowerName.includes('calibrada') ||
                    lowerName.includes('cambio/alineación') ||
                    lowerName.includes('cambio de pacha') ||
                    lowerName.includes('engrase de centro') ||
                    lowerName.includes('engrase caja de dirección') ||
                    lowerName.includes('alistamiento');

                if (isExpress) {
                    expressCount++;
                } else {
                    normalCount++;
                }
            });

            // Entry Event (Green)
            const entryEvent = {
                title: `Entrada: ${capitalizeName(app.client_name)}`,
                start,
                end: new Date(start.getTime() + 60 * 60000), // Visual duration 1h
                resource: app,
                type: 'entry',
                details: `${serviceNames.length} servicios: ${app.service_name}`
            };

            // Exit Event (Purple) logic
            let exitDate = new Date(start);
            const isMorning = start.getHours() < 12;

            if (normalCount === 0 && expressCount > 0 && expressCount <= 2 && isMorning) {
                // Express Exception
                exitDate.setHours(19, 0, 0, 0);
            } else if (normalCount > 4) {
                // Volume Exception
                exitDate.setDate(exitDate.getDate() + 2);
            } else {
                // Default / Mixed / Many Express
                exitDate.setDate(exitDate.getDate() + 1);
            }

            const exitEvent = {
                title: `Entrega: ${capitalizeName(app.client_name)}`,
                start: exitDate,
                end: new Date(exitDate.getTime() + 60 * 60000), // Visual duration 1h
                resource: app,
                type: 'exit',
                details: `Entrega estimada. Cliente: ${app.client_phone}`
            };

            return [entryEvent, exitEvent];
        });

    if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white transition-colors duration-300">Cargando...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 flex flex-col font-sans transition-colors duration-300">
            <style>{`
                /* Custom Scrollbar */
                .custom-scrollbar::-webkit-scrollbar {
                    height: 8px;
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0f172a;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #475569;
                }

                /* Calendar Spotlight Effect */
                .rbc-time-view .rbc-day-slot.rbc-today {
                    background: linear-gradient(180deg, rgba(37, 99, 235, 0.1) 0%, rgba(255, 255, 255, 0) 100%) !important;
                    background-color: transparent !important;
                }
                .dark .rbc-time-view .rbc-day-slot.rbc-today {
                    background: linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, rgba(15, 23, 42, 0) 100%) !important;
                }

                .rbc-time-view .rbc-day-bg.rbc-today {
                    background: transparent !important;
                    background-color: transparent !important;
                }
                .rbc-header.rbc-today {
                    border-top: 3px solid #2563eb !important;
                    background-color: rgba(37, 99, 235, 0.1) !important;
                }
                .rbc-header.rbc-today a {
                    color: #2563eb !important; /* Blue text for date */
                    font-weight: bold;
                }
                .dark .rbc-header.rbc-today a {
                    color: #60a5fa !important; /* Light blue text for date */
                }
                
                /* Calendar Text Colors */
                .rbc-toolbar button {
                    color: #334155;
                }
                .dark .rbc-toolbar button {
                    color: #cbd5e1;
                }
                .rbc-toolbar button:active, .rbc-toolbar button.rbc-active {
                    background-color: #e2e8f0;
                    color: #0f172a;
                }
                .dark .rbc-toolbar button:active, .dark .rbc-toolbar button.rbc-active {
                    background-color: #334155;
                    color: #fff;
                }
            `}</style>

            {/* --- HEADER --- */}
            <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center sticky top-0 z-50 shadow-md transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                        <span className="font-bold text-white text-xl tracking-tighter">BICICOLOMBIA</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-sm hidden sm:inline">Panel de Administración</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowNewAppointmentModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Nueva Cita</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm font-medium"
                    >
                        <LogOut size={16} /> <span className="hidden sm:inline">Salir</span>
                    </button>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col overflow-hidden">

                {/* --- TOP PANEL: RECENT REQUESTS (Horizontal Slider) --- */}
                <div className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 p-8 flex-shrink-0 backdrop-blur-sm transition-colors duration-300">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Clock className="text-blue-500" size={20} />
                        Solicitudes Recientes
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white text-xs px-2 py-0.5 rounded-full">{recentAppointments.length}</span>
                    </h2>

                    {recentAppointments.length === 0 ? (
                        <div className="text-slate-500 text-sm italic">No hay solicitudes registradas.</div>
                    ) : (
                        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar snap-x">
                            {recentAppointments.map((app) => (
                                <div key={app.id} className={`min-w-[340px] rounded-xl p-6 border shadow-lg relative group transition-all snap-start flex-shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate w-48 capitalize text-lg" title={app.client_name}>{capitalizeName(app.client_name)}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1"><Phone size={12} /> {app.client_phone}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${app.status === 'pending' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' :
                                            app.status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' :
                                                app.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' :
                                                    'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                                            }`}>
                                            {app.status === 'pending' ? 'Pendiente' :
                                                app.status === 'confirmed' ? 'Confirmada' :
                                                    app.status === 'completed' ? 'Entregada' : 'Cancelada'}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg mb-4 text-sm border border-slate-200 dark:border-slate-800/50 transition-colors duration-300">
                                        <p className="text-slate-700 dark:text-slate-300 font-medium truncate" title={app.service_name}>{app.service_name}</p>
                                        <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium">
                                            <span>{app.appointment_date}</span>
                                            <span>{app.appointment_time}</span>
                                        </div>
                                    </div>

                                    {/* Actions with Ghost Icons */}
                                    <div className="flex items-center gap-3 mt-2">
                                        {app.status !== 'cancelled' && (
                                            <>
                                                {app.status === 'pending' && (
                                                    <button
                                                        onClick={() => setShowConfirmModal({ type: 'accept', id: app.id })}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                                        title="Aceptar Cita"
                                                    >
                                                        <Check size={16} /> Confirmar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setShowRescheduleModal({ id: app.id });
                                                        setNewDate(app.appointment_date);
                                                        setNewTime(app.appointment_time);
                                                    }}
                                                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:scale-105 active:scale-95"
                                                    title="Editar Cita"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setShowConfirmModal({ type: 'cancel', id: app.id })}
                                                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:scale-105 active:scale-95"
                                                    title="Cancelar Cita"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- BOTTOM PANEL: CALENDAR OR LIST (Mobile) --- */}
                <div className="flex-1 p-8 bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col transition-colors duration-300">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Calendar className="text-emerald-500" size={20} />
                        {isMobile ? 'Agenda del Día' : 'Agenda Confirmada'}
                    </h2>

                    {isMobile ? (
                        // Mobile List View
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                            {events
                                .filter(evt => {
                                    // Show events for today and future
                                    const evtDate = new Date(evt.start);
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return evtDate >= today;
                                })
                                .sort((a, b) => a.start - b.start)
                                .map((evt, idx) => (
                                    <div key={idx} className={`p-5 rounded-xl border ${evt.type === 'entry' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/30' : 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-500/30'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${evt.type === 'entry' ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`}>
                                                    {evt.type === 'entry' ? 'Entrada Taller' : 'Entrega Estimada'}
                                                </p>
                                                <h3 className="font-bold text-slate-900 dark:text-slate-200 text-lg">{evt.title.replace('Entrada: ', '').replace('Entrega: ', '')}</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{evt.details}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold text-slate-900 dark:text-white">{format(evt.start, 'HH:mm')}</p>
                                                <p className="text-xs text-slate-500 font-medium uppercase mt-1">{format(evt.start, 'dd MMM')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {events.length === 0 && <p className="text-slate-500 text-center italic mt-10">No hay eventos próximos.</p>}
                        </div>
                    ) : (
                        // Desktop Calendar View
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-inner text-slate-700 dark:text-slate-300 transition-colors duration-300">
                            <BigCalendar
                                localizer={localizer}
                                events={events}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: '100%' }}
                                culture='es'
                                view={view}
                                onView={setView}
                                date={date}
                                onNavigate={setDate}
                                min={new Date(0, 0, 0, 8, 0, 0)} // 8 AM
                                max={new Date(0, 0, 0, 19, 0, 0)} // 7 PM
                                tooltipAccessor={evt => `${evt.title}\n${evt.details}`}
                                messages={{
                                    next: "Siguiente",
                                    previous: "Anterior",
                                    today: "Hoy",
                                    month: "Mes",
                                    week: "Semana",
                                    day: "Día",
                                    agenda: "Agenda",
                                    date: "Fecha",
                                    time: "Hora",
                                    event: "Evento",
                                    noEventsInRange: "No hay citas en este rango."
                                }}
                                eventPropGetter={(event) => ({
                                    style: {
                                        backgroundColor: event.type === 'entry' ? '#10b981' : '#8b5cf6', // Green (Entry), Purple (Exit)
                                        borderRadius: '6px',
                                        opacity: 0.9,
                                        color: 'white',
                                        border: '0px',
                                        display: 'block',
                                        fontSize: '0.85rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        padding: '2px 6px'
                                    }
                                })}
                            />
                        </div>
                    )}
                </div>
            </main>

            {/* --- MODALS --- */}

            {/* NEW APPOINTMENT MODAL */}
            {showNewAppointmentModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 max-w-2xl w-full shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto custom-scrollbar transition-colors duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <Plus className="text-blue-500" /> Nueva Cita (Físico)
                            </h3>
                            <button onClick={() => setShowNewAppointmentModal(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAppointment} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Nombre Cliente</label>
                                    <input
                                        required
                                        type="text"
                                        value={newApp.name}
                                        onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Teléfono</label>
                                    <input
                                        required
                                        type="tel"
                                        value={newApp.phone}
                                        onChange={(e) => setNewApp({ ...newApp, phone: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tipo Bici</label>
                                    <select
                                        value={newApp.bikeType}
                                        onChange={(e) => setNewApp({ ...newApp, bikeType: e.target.value })}
                                        className="w-full px-4 py-3 h-12 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 text-sm leading-tight focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                                    >
                                        <option value="MTB">MTB</option>
                                        <option value="Ruta">Ruta</option>
                                        <option value="Urbana">Urbana</option>
                                        <option value="Eléctrica">Eléctrica</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Fecha</label>
                                    <input
                                        required
                                        type="date"
                                        value={newApp.date}
                                        onChange={(e) => setNewApp({ ...newApp, date: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Hora</label>
                                    <input
                                        required
                                        type="time"
                                        value={newApp.time}
                                        onChange={(e) => setNewApp({ ...newApp, time: e.target.value })}
                                        className="w-full px-4 py-3 h-12 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 text-sm leading-tight focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                                    />
                                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Horario: 9 a.m. a 7 p.m.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Servicios ({newApp.selectedServices.length})</label>
                                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-4 max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                                    {SERVICE_DATA.map((cat, idx) => (
                                        <div key={idx}>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{cat.category}</p>
                                            {cat.items.map(service => {
                                                const isSelected = newApp.selectedServices.some(s => s.id === service.id);
                                                return (
                                                    <div
                                                        key={service.id}
                                                        onClick={() => handleNewAppServiceSelect(service)}
                                                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer text-sm transition-all ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/50' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'}`}
                                                    >
                                                        <span>{service.name}</span>
                                                        {isSelected && <CheckCircle size={16} />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Notas</label>
                                <textarea
                                    rows="2"
                                    value={newApp.comments}
                                    onChange={(e) => setNewApp({ ...newApp, comments: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                            >
                                Crear Cita Confirmada
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 max-w-sm w-full shadow-2xl animate-fade-in-up transition-colors duration-300">
                        <div className="flex justify-center mb-6 text-amber-500">
                            <AlertTriangle size={56} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-3">
                            ¿Estás seguro?
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 text-center mb-8 text-sm leading-relaxed">
                            {showConfirmModal.type === 'accept'
                                ? "Vas a confirmar esta cita. Se enviará una notificación al cliente."
                                : "Vas a cancelar esta cita. Esta acción no se puede deshacer."}
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowConfirmModal(null)}
                                className="flex-1 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                onClick={() => updateStatus(showConfirmModal.id, showConfirmModal.type === 'accept' ? 'confirmed' : 'cancelled')}
                                className={`flex-1 py-3 rounded-lg font-bold text-white transition-colors ${showConfirmModal.type === 'accept' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                                    }`}
                            >
                                {showConfirmModal.type === 'accept' ? 'Confirmar' : 'Cancelar Cita'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RESCHEDULE MODAL */}
            {showRescheduleModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 max-w-sm w-full shadow-2xl animate-fade-in-up transition-colors duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Reprogramar Cita</h3>
                            <button onClick={() => setShowRescheduleModal(null)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleReschedule} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Nueva Fecha</label>
                                <input
                                    required
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Nueva Hora</label>
                                <input
                                    required
                                    type="time"
                                    min="09:00"
                                    max="19:00"
                                    value={newTime}
                                    onChange={(e) => setNewTime(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Horario: 9 a.m. a 7 p.m.</p>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95 mt-2"
                            >
                                Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
