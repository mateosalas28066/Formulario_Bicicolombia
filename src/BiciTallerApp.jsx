import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import {
    Calendar,
    Clock,
    Wrench,
    CheckCircle,
    Video,
    MessageCircle,
    ChevronRight,
    ChevronDown,
    MapPin,
    Info,
    Bike
} from 'lucide-react';
import videoEjemplo from './assets/Video_ejemplo.mp4';
import { SERVICE_DATA } from './data/services';

const TEAM_DATA = [
    {
        name: "Carlos Rodríguez",
        role: "Fundador & Mecánico Jefe",
        image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400"
    },
    {
        name: "Ana María Gómez",
        role: "Administradora Taller",
        image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400"
    },
    {
        name: "Jhon Jairo",
        role: "Especialista Suspensión",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400"
    },
    {
        name: "David Torres",
        role: "Técnico Hidráulicos",
        image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400"
    }
];

// Generate time slots from 9:00 AM to 7:00 PM
const TIME_SLOTS = [];
for (let hour = 9; hour < 19; hour++) {
    TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
}
TIME_SLOTS.push("19:00");

const getInitialFormData = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA');
    let defaultTime = "09:00";
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (let slot of TIME_SLOTS) {
        const [h, m] = slot.split(':').map(Number);
        if (h > currentHour || (h === currentHour && m > currentMinute)) {
            defaultTime = slot;
            break;
        }
    }

    return {
        date: dateStr,
        time: defaultTime,
        name: '',
        phone: '',
        email: '',
        bikeType: 'MTB',
        comments: ''
    };
};

export default function BiciAgenda() {
    const [step, setStep] = useState(1);
    const [selectedServices, setSelectedServices] = useState([]);
    const [formData, setFormData] = useState(getInitialFormData);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleTimeSelect = (time) => {
        setFormData(prev => ({
            ...prev,
            time
        }));
    };

    const getTotalPrice = () => {
        return selectedServices.reduce((sum, service) => sum + service.price, 0);
    };

    const getServiceNames = () => {
        return selectedServices.map(s => s.name).join(' + ');
    };

    const getServiceIds = () => {
        return selectedServices.map(s => s.id).join(',');
    };

    // Video reference
    const videoRef = useRef(null);

    // Effect to handle video playback
    useEffect(() => {
        if (videoRef.current) {
            if (selectedServices.length > 0) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(error => console.log("Video play failed:", error));
            } else {
                videoRef.current.pause();
            }
        }
    }, [selectedServices]);

    const handleServiceSelect = (service) => {
        setSelectedServices(prev => {
            const isSelected = prev.find(s => s.id === service.id);
            if (isSelected) {
                return prev.filter(s => s.id !== service.id);
            } else {
                return [...prev, service];
            }
        });
    };

    const isAllExpress = () => {
        return selectedServices.length > 0 && selectedServices.every(s => s.express);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || (typeof window !== 'undefined' && window.BICICOLOMBIA_WEBHOOK_URL);

            const { error } = await supabase
                .from('citas')
                .insert([
                    {
                        client_name: formData.name,
                        client_phone: formData.phone,
                        client_email: formData.email,
                        bike_type: formData.bikeType,
                        service_id: getServiceIds(),
                        service_name: getServiceNames(),
                        service_price: getTotalPrice(),
                        appointment_date: formData.date,
                        appointment_time: formData.time,
                        notes: formData.comments,
                        status: 'pending'
                    }
                ]);

            if (error) throw error;

            // Trigger n8n Webhook
            console.log('Attempting to send webhook to:', webhookUrl);

            if (webhookUrl) {
                const payload = {
                    client_name: formData.name,
                    client_phone: formData.phone,
                    bike_type: formData.bikeType,
                    service_name: getServiceNames(),
                    service_price: getTotalPrice(),
                    appointment_date: formData.date,
                    appointment_time: formData.time,
                    notes: formData.comments,
                    created_at: new Date().toISOString()
                };
                console.log('Webhook Payload:', payload);

                fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                })
                    .then(response => {
                        console.log('Webhook Response Status:', response.status);
                        return response.text();
                    })
                    .then(data => console.log('Webhook Response Data:', data))
                    .catch(err => console.error('Webhook Error:', err));
            } else {
                console.warn('No VITE_N8N_WEBHOOK_URL defined in .env');
            }

            setStep(3);
        } catch (error) {
            console.error('Error saving appointment:', error);
            alert('Hubo un error al agendar la cita. Por favor intenta nuevamente.');
        }
    };

    const handleReset = () => {
        setSelectedServices([]);
        setFormData(getInitialFormData());
        setStep(1);
    };

    const generateCalendarLink = () => {
        if (!formData.date || !formData.time) return '#';

        const startTime = new Date(`${formData.date}T${formData.time}`);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        const formatTime = (date) => date.toISOString().replace(/-|:|\\.\\d\\d\\d/g, "");

        const isExpress = selectedServices.length > 0 && selectedServices.every(s => s.express);
        const deliveryTime = new Date(startTime);
        if (isExpress) {
            deliveryTime.setHours(19, 0, 0, 0);
        } else {
            deliveryTime.setDate(deliveryTime.getDate() + 1);
            deliveryTime.setHours(19, 0, 0, 0);
        }

        const arrivalHour = startTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const deliveryDateStr = deliveryTime.toLocaleDateString('es-CO');
        const deliveryHour = deliveryTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        const servicesList = selectedServices.length
            ? selectedServices.map(s => `- ${s.name}`).join('\n')
            : '- Servicio por definir';

        const details = [
            `Hola ${formData.name || ''} esta es tu cita en Bicicolombia.`,
            'Cita de mantenimiento.',
            `Servicios:\n${servicesList}`,
            `Entrega estimada: ${deliveryDateStr} ${deliveryHour}`,
            `Recuerda llevar tu bicicleta a las ${arrivalHour}.`,
            `Tiempo aproximado: ${isExpress ? 'Express (mismo día)' : '24 horas'}.`,
            'Contacto taller: 3332848000'
        ].filter(Boolean).join('\n');

        const title = 'Cita Taller Bicicolombia';
        const location = 'Cl. 5 #43-40, Cali';

        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatTime(startTime)}/${formatTime(endTime)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-200 transition-colors duration-300">
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        /* Custom scrollbar for dark mode */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .dark ::-webkit-scrollbar-track {
          background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: #334155;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .dark ::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }

        /* Hide scrollbar for time picker but keep functionality */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>

            <main className="max-w-6xl mx-auto px-4 py-8">

                <div className="grid md:grid-cols-3 gap-8 items-start">

                    {/* --- LEFT COLUMN: CONTENT --- */}
                    <div className="md:col-span-2 space-y-6">

                        {/* --- STEP 1: SERVICE SELECTION --- */}
                        {step === 1 && (
                            <div className="space-y-6 animate-fade-in">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    Selecciona tus Servicios
                                </h2>

                                {SERVICE_DATA.map((category, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
                                        <div className="bg-slate-100 dark:bg-slate-800/50 px-4 py-3 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/50 uppercase text-xs tracking-wider transition-colors duration-300">
                                            {category.category}
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {category.items.map((service) => {
                                                const isSelected = selectedServices.some(s => s.id === service.id);
                                                return (
                                                    <div
                                                        key={service.id}
                                                        onClick={() => handleServiceSelect(service)}
                                                        className={`p-4 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                                                                {isSelected && <CheckCircle size={14} className="text-white" />}
                                                            </div>
                                                            <div>
                                                                <p className={`font-medium transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white'}`}>{service.name}</p>
                                                                <p className="text-xs text-slate-500">{service.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(service.price)}</p>
                                                            {service.express ? (
                                                                <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-amber-200 dark:border-amber-500/30 flex items-center gap-1 justify-end mt-1">
                                                                    <Clock size={10} /> Express
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium border border-slate-200 dark:border-slate-700 mt-1 inline-block">
                                                                    24h
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* --- STEP 2: FORMULARIO --- */}
                        {step === 2 && (
                            <div className="animate-fade-in">
                                <button
                                    onClick={() => setStep(1)}
                                    className="mb-6 text-sm text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
                                >
                                    ← Volver a servicios
                                </button>

                                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 md:p-10 transition-colors duration-300">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Agenda tu cita</h2>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg mb-8 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="bg-slate-200 dark:bg-slate-700 p-3 rounded-full text-blue-600 dark:text-blue-400">
                                                <Wrench size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Servicios seleccionados ({selectedServices.length})</p>
                                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(getTotalPrice())}</p>
                                            </div>
                                        </div>
                                        <ul className="space-y-1 pl-14">
                                            {selectedServices.map(s => (
                                                <li key={s.id} className="text-sm text-slate-600 dark:text-slate-300 list-disc list-inside">{s.name}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Fecha</label>
                                                <input
                                                    required
                                                    type="date"
                                                    name="date"
                                                    min={new Date().toISOString().split('T')[0]}
                                                    value={formData.date}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Hora</label>
                                                <input
                                                    required
                                                    type="time"
                                                    name="time"
                                                    min="09:00"
                                                    max="19:00"
                                                    value={formData.time}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Horario: 9 a.m. a 7 p.m.</p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Nombre Completo</label>
                                                <input
                                                    required
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    placeholder="Tu nombre"
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Teléfono</label>
                                                <input
                                                    required
                                                    type="tel"
                                                    name="phone"
                                                    value={formData.phone}
                                                    onChange={handleInputChange}
                                                    placeholder="Tu teléfono"
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tipo de Bicicleta</label>
                                            <div className="relative">
                                                <select
                                                    name="bikeType"
                                                    value={formData.bikeType}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 pr-10 h-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 text-sm leading-tight focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
                                                >
                                                    <option value="MTB">MTB (Montaña)</option>
                                                    <option value="Ruta">Ruta</option>
                                                    <option value="Urbana">Urbana</option>
                                                    <option value="Eléctrica">Eléctrica</option>
                                                    <option value="Infantil">Infantil</option>
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Comentarios Adicionales</label>
                                            <textarea
                                                name="comments"
                                                value={formData.comments}
                                                onChange={handleInputChange}
                                                rows="3"
                                                placeholder="¿Algo más que debamos saber?"
                                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                            ></textarea>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            Confirmar Cita
                                            <CheckCircle size={20} />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="animate-fade-in">
                                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 md:p-10 transition-colors duration-300">
                                    <div className="flex items-center gap-3 mb-6">
                                        <CheckCircle size={28} className="text-emerald-500" />
                                        <div>
                                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Cita agendada</p>
                                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">¡Gracias por confiar en nosotros!</h2>
                                        </div>
                                    </div>

                                    <p className="text-slate-600 dark:text-slate-300 mb-6">
                                        Te esperamos el <span className="font-semibold text-slate-900 dark:text-white">{formData.date}</span> a las <span className="font-semibold text-slate-900 dark:text-white">{formData.time}</span>. Revisa tu teléfono para futuras confirmaciones.
                                    </p>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                <Wrench size={16} className="text-blue-500" />
                                                Servicios reservados ({selectedServices.length})
                                            </div>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatPrice(getTotalPrice())}</span>
                                        </div>
                                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                            {selectedServices.map(s => (
                                                <li key={s.id} className="list-disc list-inside">{s.name}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-3">
                                        <a
                                            href={generateCalendarLink()}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-emerald-500/20 transition-all text-center"
                                        >
                                            <Calendar size={18} />
                                            Agregar a Google Calendar
                                        </a>
                                        <button
                                            onClick={handleReset}
                                            className="flex-1 inline-flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <ChevronRight size={18} />
                                            Agendar otra cita
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* --- RIGHT COLUMN: VIDEO & SUMMARY --- */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
                            <div className="relative aspect-video bg-slate-950">
                                <video
                                    ref={videoRef}
                                    src={videoEjemplo}
                                    className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                                    controls={false}
                                    muted
                                    loop
                                    poster="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&q=80&w=800"
                                />
                            </div>
                            <div className="p-4">
                                {selectedServices.length > 0 ? (
                                    <>
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-1">{selectedServices[selectedServices.length - 1].name}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{selectedServices[selectedServices.length - 1].description}</p>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-slate-500">Tiempo estimado:</span>
                                            {selectedServices[selectedServices.length - 1].express ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1"><Clock size={10} /> Express</span>
                                            ) : (
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">24 Horas</span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-1">Nuestros Servicios</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona un servicio para ver los detalles.</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* --- SELECTED SERVICES SUMMARY (Step 1 Only) --- */}
                        {step === 1 && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-5 sticky top-4 transition-colors duration-300">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Wrench size={16} className="text-blue-500" />
                                    Resumen
                                </h3>

                                {selectedServices.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-4">
                                        Selecciona un servicio para continuar
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            {selectedServices.map(s => (
                                                <div key={s.id} className="flex justify-between text-sm">
                                                    <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatPrice(s.price)}</span>
                                                </div>
                                            ))}
                                            <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between font-bold">
                                                <span className="text-slate-900 dark:text-white">Total</span>
                                                <span className="text-emerald-600 dark:text-emerald-400">{formatPrice(getTotalPrice())}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setStep(2)}
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            Continuar
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* --- FOOTER: TEAM --- */}
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 text-xl">
                        <Info size={24} className="text-blue-500" />
                        Nuestro Equipo
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {TEAM_DATA.map((member, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center transition-colors duration-300">
                                <img src={member.image} alt={member.name} className="w-20 h-20 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700 mb-3" />
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-slate-200">{member.name}</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{member.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
