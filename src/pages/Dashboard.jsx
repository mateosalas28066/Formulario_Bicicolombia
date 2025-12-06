import React, { useEffect, useState, useRef } from 'react';
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
    AlertTriangle, X, Plus, Wrench, Edit, Trash2, Check, ChevronRight, Eye, MessageCircle, ChevronLeft
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

const SERVICE_EXPRESS_MAP = SERVICE_DATA.reduce((acc, category) => {
    category.items.forEach(item => {
        acc[item.id] = item.express;
    });
    return acc;
}, {});

export default function Dashboard() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(null); // { type: 'accept' | 'cancel', id: string }
    const [showRescheduleModal, setShowRescheduleModal] = useState(null); // { id: string }
    const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAllList, setShowAllList] = useState(false);
    const [listPage, setListPage] = useState(0);
    const [detailModal, setDetailModal] = useState(null); // appointment
    const [detailAdminNote, setDetailAdminNote] = useState('');
    const [notificationModal, setNotificationModal] = useState(null); // { type, app }
    const recentListRef = useRef(null);

    // Reschedule state
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [newDeliveryDate, setNewDeliveryDate] = useState('');
    const [newDeliveryTime, setNewDeliveryTime] = useState('');
    const [autoDelivery, setAutoDelivery] = useState(true);

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
    const [view, setView] = useState('week');
    const [date, setDate] = useState(new Date());
    const monthOptions = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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
        // Llevar el slider al inicio para mostrar la mбs reciente
        requestAnimationFrame(() => {
            if (recentListRef.current) {
                recentListRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            }
        });
    };

    const getServiceIdsFromApp = (app) => {
        return (app?.service_id || '').split(',').map(id => id.trim()).filter(Boolean);
    };

    const calculateDelivery = (startDate, serviceIds = []) => {
        const allExpress = serviceIds.length > 0 && serviceIds.every(id => SERVICE_EXPRESS_MAP[id]);
        const delivery = new Date(startDate);
        if (allExpress) {
            delivery.setHours(19, 0, 0, 0);
        } else {
            delivery.setDate(delivery.getDate() + 1);
            delivery.setHours(19, 0, 0, 0);
        }
        return {
            date: delivery.toLocaleDateString('en-CA'),
            time: delivery.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            dateObj: delivery
        };
    };

    const recalcDeliveryFromState = (dateVal, timeVal) => {
        if (!showRescheduleModal) return;
        const baseApp = showRescheduleModal.app || appointments.find(a => a.id === showRescheduleModal.id);
        const serviceIds = getServiceIdsFromApp(baseApp);
        const safeDate = dateVal || newDate;
        const safeTime = timeVal || newTime;
        if (!safeDate || !safeTime) return;
        const result = calculateDelivery(new Date(`${safeDate}T${safeTime}`), serviceIds);
        setNewDeliveryDate(result.date);
        setNewDeliveryTime(result.time);
    };

    const sendWebhook = (app) => {
        const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || (typeof window !== 'undefined' && window.BICICOLOMBIA_WEBHOOK_URL);
        if (!webhookUrl || !app) return;

        const payload = {
            client_name: app.client_name,
            client_phone: app.client_phone,
            bike_type: app.bike_type,
            service_name: app.service_name,
            service_price: app.service_price,
            appointment_date: app.appointment_date,
            appointment_time: app.appointment_time,
            delivery_date: app.delivery_date,
            delivery_time: app.delivery_time,
            notes: app.notes,
            created_at: new Date().toISOString()
        };

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error('Webhook Error:', err));
    };

    const openDetail = (app) => {
        setDetailModal(app);
        setDetailAdminNote(app?.admin_note || '');
    };

    const saveAdminNote = async () => {
        if (!detailModal) return;
        const { error } = await supabase
            .from('citas')
            .update({ admin_note: detailAdminNote })
            .eq('id', detailModal.id);
        if (!error) {
            fetchAppointments();
        } else {
            alert('No se pudo guardar la nota interna. Verifica que la columna admin_note exista en la tabla.');
        }
    };

    const buildWhatsappLink = (app, type = 'info') => {
        const rawPhone = (app?.client_phone || '').replace(/\D/g, '');
        if (!rawPhone) return '#';
        const phone = rawPhone.startsWith('57') ? rawPhone : rawPhone.length === 10 ? `57${rawPhone}` : rawPhone;
        const services = app?.service_name || 'Servicio';
        const date = app?.appointment_date || '';
        const time = app?.appointment_time || '';
        const deliveryLine = app?.delivery_date && app?.delivery_time
            ? ` Entrega estimada: ${app.delivery_date} a las ${app.delivery_time}.`
            : '';
        let message = '';
        if (type === 'confirm') {
            message = `Hola ${app?.client_name || ''}, confirmamos tu cita el ${date} a las ${time} para ${services}.${deliveryLine} Te esperamos.`;
        } else if (type === 'reschedule') {
            message = `Hola ${app?.client_name || ''}, actualizamos tu cita para el ${date} a las ${time} para ${services}.${deliveryLine} Aceptas este nuevo horario?`;
        } else {
            message = `Hola ${app?.client_name || ''}, tu cita es el ${date} a las ${time} para ${services}.${deliveryLine}`;
        }
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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
            if (newStatus === 'confirmed') {
                const app = appointments.find(a => a.id === id);
                if (app) {
                    const needsDelivery = !app.delivery_date || !app.delivery_time;
                    const delivery = needsDelivery ? calculateDelivery(new Date(`${app.appointment_date}T${app.appointment_time}`), getServiceIdsFromApp(app)) : null;
                    const appWithDelivery = needsDelivery ? { ...app, delivery_date: delivery.date, delivery_time: delivery.time } : app;
                    sendWebhook(appWithDelivery);
                    setNotificationModal({ type: 'confirm', app: appWithDelivery });
                }
            }
        }
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!showRescheduleModal || !newDate || !newTime) return;

        const sourceApp = showRescheduleModal.app || appointments.find(a => a.id === showRescheduleModal.id);
        const startDate = new Date(`${newDate}T${newTime}`);
        const serviceIds = getServiceIdsFromApp(sourceApp);
        const computedDelivery = calculateDelivery(startDate, serviceIds);
        const deliveryDateVal = autoDelivery ? computedDelivery.date : newDeliveryDate;
        const deliveryTimeVal = autoDelivery ? computedDelivery.time : newDeliveryTime;

        const { error } = await supabase
            .from('citas')
            .update({
                appointment_date: newDate,
                appointment_time: newTime,
                delivery_date: deliveryDateVal,
                delivery_time: deliveryTimeVal,
                status: 'pending'
            })
            .eq('id', showRescheduleModal.id);

        if (!error) {
            const updatedApp = appointments.find(a => a.id === showRescheduleModal.id);
            if (updatedApp) {
                sendWebhook({
                    ...updatedApp,
                    appointment_date: newDate,
                    appointment_time: newTime,
                    delivery_date: deliveryDateVal,
                    delivery_time: deliveryTimeVal
                });
            }
            fetchAppointments();
            setNotificationModal({
                type: 'reschedule',
                app: {
                    ...(sourceApp || {}),
                    appointment_date: newDate,
                    appointment_time: newTime,
                    delivery_date: deliveryDateVal,
                    delivery_time: deliveryTimeVal
                }
            });
            setShowRescheduleModal(null);
            setNewDate('');
            setNewTime('');
            setNewDeliveryDate('');
            setNewDeliveryTime('');
            setAutoDelivery(true);
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
        const deliveryEstimate = calculateDelivery(new Date(`${newApp.date}T${newApp.time}`), newApp.selectedServices.map(s => s.id));

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
                    delivery_date: deliveryEstimate.date,
                    delivery_time: deliveryEstimate.time,
                    notes: newApp.comments,
                    status: 'confirmed' // Walk-ins are automatically confirmed
                }
            ]);

        if (!error) {
            sendWebhook({
                client_name: newApp.name,
                client_phone: newApp.phone,
                bike_type: newApp.bikeType,
                service_name: serviceNames,
                service_price: totalPrice,
                appointment_date: newApp.date,
                appointment_time: newApp.time,
                delivery_date: deliveryEstimate.date,
                delivery_time: deliveryEstimate.time,
                notes: newApp.comments
            });
            // Trigger n8n Webhook
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
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredAppointments = normalizedSearch
        ? appointments.filter(app =>
            (app.client_name || '').toLowerCase().includes(normalizedSearch) ||
            (app.client_phone || '').toLowerCase().includes(normalizedSearch)
        )
        : appointments;

    const recentAppointments = filteredAppointments.slice(0, 25);
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / pageSize));
    const paginatedAppointments = filteredAppointments.slice(listPage * pageSize, (listPage + 1) * pageSize);

    // Map confirmed appointments to calendar events (Entry and Exit)
    const events = appointments
        .filter(app => app.status === 'confirmed')
        .flatMap(app => {
            const start = new Date(`${app.appointment_date}T${app.appointment_time}`);
            const serviceNames = (app.service_name || '').split(' + ');

            const entryEvent = {
                title: `Entrada: ${capitalizeName(app.client_name)}`,
                start,
                end: new Date(start.getTime() + 60 * 60000), // Visual duration 1h
                resource: app,
                type: 'entry',
                details: `${serviceNames.length} servicios: ${app.service_name}`
            };

            const exitDate = (app.delivery_date && app.delivery_time)
                ? new Date(`${app.delivery_date}T${app.delivery_time}`)
                : calculateDelivery(start, getServiceIdsFromApp(app)).dateObj;

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
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="text-blue-500" size={20} />
                            Solicitudes Recientes
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white text-xs px-2 py-0.5 rounded-full">{recentAppointments.length}</span>
                        </h2>
                        <div className="flex flex-col md:flex-row gap-2 md:items-center">
                            <input
                                type="text"
                                placeholder="Buscar por nombre o teléfono"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setListPage(0); }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={fetchAppointments}
                                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold"
                                >
                                    Actualizar
                                </button>
                                <button
                                    onClick={() => setShowAllList(prev => !prev)}
                                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
                                >
                                    {showAllList ? 'Ocultar lista' : 'Ver todas'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {recentAppointments.length === 0 ? (
                        <div className="text-slate-500 text-sm italic">No hay solicitudes registradas.</div>
                    ) : (
                        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar snap-x" ref={recentListRef}>
                            {recentAppointments.map((app) => (
                                <div key={app.id} className={`min-w-[340px] rounded-xl p-6 border shadow-lg relative group transition-all snap-start flex-shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex flex-col min-h-[220px]`}>
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

                                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg mb-4 text-sm border border-slate-200 dark:border-slate-800/50 transition-colors duration-300 min-h-[78px]">
                                        <p
                                            className="text-slate-700 dark:text-slate-300 font-medium leading-snug"
                                            title={app.service_name}
                                            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                        >
                                            {app.service_name}
                                        </p>
                                        <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium">
                                            <span>{app.appointment_date}</span>
                                            <span>{app.appointment_time}</span>
                                        </div>
                                    </div>

                                    {/* Actions with Ghost Icons */}
                                    <div className="flex items-center gap-3 mt-auto pt-2">
                                        {app.status !== 'cancelled' && (
                                            <>
                                                {app.status === 'pending' && (
                                                    <button
                                                        onClick={() => setShowConfirmModal({ type: 'accept', id: app.id })}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                                        title="Aceptar Cita"
                                                    >
                                                        <Check size={14} /> Confirmar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        const startDate = new Date(`${app.appointment_date}T${app.appointment_time}`);
                                                        const deliverySeed = (app.delivery_date && app.delivery_time)
                                                            ? { date: app.delivery_date, time: app.delivery_time }
                                                            : calculateDelivery(startDate, getServiceIdsFromApp(app));
                                                        setShowRescheduleModal({ id: app.id, app });
                                                        setNewDate(app.appointment_date);
                                                        setNewTime(app.appointment_time);
                                                        setNewDeliveryDate(deliverySeed.date);
                                                        setNewDeliveryTime(deliverySeed.time);
                                                        setAutoDelivery(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Reprogramar"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setShowConfirmModal({ type: 'cancel', id: app.id })}
                                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Cancelar cita"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openDetail(app)}
                                                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                    title="Ver detalle"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <a
                                                    href={buildWhatsappLink(app, 'info')}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-2 text-slate-400 hover:text-green-600 transition-colors"
                                                    title="Contactar por WhatsApp"
                                                >
                                                    <MessageCircle size={16} />
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {showAllList && (
                        <div className="mt-8 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Listado completo</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setListPage(p => Math.max(0, p - 1))}
                                        disabled={listPage === 0}
                                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <ChevronLeft size={14} /> Anterior
                                    </button>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Página {listPage + 1} / {totalPages}</span>
                                    <button
                                        onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={listPage >= totalPages - 1}
                                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        Siguiente <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paginatedAppointments.map((app) => (
                                    <div key={app.id} className="rounded-xl p-5 border shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col min-h-[200px]">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white capitalize">{capitalizeName(app.client_name)}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={12} /> {app.client_phone}</p>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${app.status === 'pending' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' :
                                                app.status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' :
                                                    app.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' :
                                                        'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                                            }`}>
                                                {app.status === 'pending' ? 'Pendiente' :
                                                    app.status === 'confirmed' ? 'Confirmada' :
                                                        app.status === 'completed' ? 'Entregada' : 'Cancelada'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 mb-3 min-h-[64px]">
                                            <p
                                                className="leading-snug"
                                                title={app.service_name}
                                                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                            >
                                                {app.service_name}
                                            </p>
                                            <p>{app.appointment_date} {app.appointment_time}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs mt-auto">
                                            <button
                                                onClick={() => openDetail(app)}
                                                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                                            >
                                                <Eye size={14} /> Detalle
                                            </button>
                                            <a
                                                href={buildWhatsappLink(app, 'info')}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-green-600 flex items-center gap-1"
                                            >
                                                <MessageCircle size={14} /> WhatsApp
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Mes</span>
                                    <div className="grid grid-cols-6 gap-1">
                                        {monthOptions.map((m, idx) => (
                                            <button
                                                key={m}
                                                onClick={() => setDate(new Date(date.getFullYear(), idx, 1))}
                                                className={`px-2 py-1 text-xs rounded ${date.getMonth() === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                            >
                                                {m.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Año</span>
                                    <input
                                        type="number"
                                        value={date.getFullYear()}
                                        onChange={(e) => {
                                            const year = parseInt(e.target.value || `${new Date().getFullYear()}`, 10);
                                            if (!isNaN(year)) setDate(new Date(year, date.getMonth(), 1));
                                        }}
                                        className="w-20 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                                    />
                                </div>
                            </div>
                            <BigCalendar
                                localizer={localizer}
                                events={events}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: '100%' }}
                                culture='es'
                                view={view}
                                onView={setView}
                                views={['week', 'day']}
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

            {/* DETAIL MODAL */}
            {detailModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 max-w-2xl w-full shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto custom-scrollbar transition-colors duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <p className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Detalle de cita</p>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">{capitalizeName(detailModal.client_name)}</h3>
                            </div>
                            <button onClick={() => setDetailModal(null)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm text-slate-700 dark:text-slate-300">
                            <div className="space-y-1">
                                <p><span className="font-semibold">Teléfono:</span> {detailModal.client_phone}</p>
                                <p><span className="font-semibold">Bicicleta:</span> {detailModal.bike_type}</p>
                                <p><span className="font-semibold">Fecha:</span> {detailModal.appointment_date}</p>
                                <p><span className="font-semibold">Hora:</span> {detailModal.appointment_time}</p>
                                <p><span className="font-semibold">Entrega estimada:</span> {detailModal.delivery_date || 'Pendiente'} {detailModal.delivery_time || ''}</p>
                            </div>
                            <div className="space-y-1">
                                <p><span className="font-semibold">Servicios:</span></p>
                                <p className="whitespace-pre-line text-slate-600 dark:text-slate-300">{detailModal.service_name}</p>
                                <p><span className="font-semibold">Notas cliente:</span></p>
                                <p className="whitespace-pre-line text-slate-600 dark:text-slate-300">{detailModal.notes || 'Sin notas'}</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Nota interna</label>
                            <textarea
                                value={detailAdminNote}
                                onChange={(e) => setDetailAdminNote(e.target.value)}
                                rows="3"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                            />
                            <button
                                onClick={saveAdminNote}
                                className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                            >
                                Guardar nota
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <a
                                href={buildWhatsappLink(detailModal, 'info')}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-green-600 flex items-center gap-2"
                            >
                                <MessageCircle size={16} /> Contactar
                            </a>
                            <a
                                href={buildWhatsappLink(detailModal, 'confirm')}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-blue-600 flex items-center gap-2"
                            >
                                <MessageCircle size={16} /> Confirmar por WhatsApp
                            </a>
                            <a
                                href={buildWhatsappLink(detailModal, 'reschedule')}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-700 text-amber-600 flex items-center gap-2"
                            >
                                <MessageCircle size={16} /> Avisar reprogramación
                            </a>
                        </div>
                    </div>
                </div>
            )}

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
                                    onChange={(e) => {
                                        setNewDate(e.target.value);
                                        if (autoDelivery) {
                                            recalcDeliveryFromState(e.target.value, newTime);
                                        }
                                    }}
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
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setNewTime(val);
                                        if (autoDelivery) {
                                            recalcDeliveryFromState(newDate, val);
                                        }
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Horario: 9 a.m. a 7 p.m.</p>
                            </div>
                            <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Salida estimada</label>
                                    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <input
                                            type="checkbox"
                                            checked={!autoDelivery}
                                            onChange={(e) => {
                                                const manual = e.target.checked;
                                                setAutoDelivery(!manual);
                                                if (!manual) {
                                                    recalcDeliveryFromState(newDate, newTime);
                                                }
                                            }}
                                        />
                                        <span>Editar manualmente</span>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <input
                                            type="date"
                                            value={newDeliveryDate}
                                            onChange={(e) => setNewDeliveryDate(e.target.value)}
                                            disabled={autoDelivery}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-60"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="time"
                                            value={newDeliveryTime}
                                            onChange={(e) => setNewDeliveryTime(e.target.value)}
                                            disabled={autoDelivery}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-60"
                                        />
                                    </div>
                                </div>
                                {autoDelivery ? (
                                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Se calcula automaticamente segun servicios (Express mismo dia 7 p.m., de lo contrario +1 dia 7 p.m.).</p>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => { setAutoDelivery(true); recalcDeliveryFromState(newDate, newTime); }}
                                        className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-500"
                                    >
                                        Volver a calculo automatico
                                    </button>
                                )}
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

            {/* NOTIFICATION MODAL AFTER CONFIRM/RESCHEDULE */}
            {notificationModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 max-w-md w-full shadow-2xl animate-fade-in-up transition-colors duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <p className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">{notificationModal.type === 'confirm' ? 'Cita confirmada' : 'Cita reprogramada'}</p>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Avisar por WhatsApp</h3>
                            </div>
                            <button onClick={() => setNotificationModal(null)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300 mb-6">
                            <p><span className="font-semibold">Cliente:</span> {notificationModal.app?.client_name}</p>
                            <p><span className="font-semibold">Entrada:</span> {notificationModal.app?.appointment_date} {notificationModal.app?.appointment_time}</p>
                            {notificationModal.app?.delivery_date && notificationModal.app?.delivery_time && (
                                <p><span className="font-semibold">Salida estimada:</span> {notificationModal.app.delivery_date} {notificationModal.app.delivery_time}</p>
                            )}
                            <p><span className="font-semibold">Servicios:</span> {notificationModal.app?.service_name}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <a
                                href={buildWhatsappLink(notificationModal.app, notificationModal.type === 'reschedule' ? 'reschedule' : 'confirm')}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-emerald-500/20 transition-all text-center"
                            >
                                <MessageCircle size={18} />
                                Avisar por WhatsApp
                            </a>
                            <button
                                onClick={() => setNotificationModal(null)}
                                className="flex-1 inline-flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
