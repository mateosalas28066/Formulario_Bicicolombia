import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import {
    Calendar,
    Clock,
    Wrench,
    CheckCircle,
    Video,
    MessageCircle,
    ChevronRight,
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

export default function BiciAgenda() {
    const [step, setStep] = useState(1);
    const [selectedServices, setSelectedServices] = useState([]);
    const [formData, setFormData] = useState(() => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-CA');
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return {
            date: dateStr,
            time: timeStr,
            name: '',
            phone: '',
            email: '',
            bikeType: 'MTB',
            comments: ''
        };
    });

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);

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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

    const isAllExpress = () => {
        return selectedServices.length > 0 && selectedServices.every(s => s.express);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
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
            setStep(3);
        } catch (error) {
            console.error('Error saving appointment:', error);
            alert('Hubo un error al agendar la cita. Por favor intenta nuevamente.');
        }
    };

    const generateCalendarLink = () => {
        if (selectedServices.length === 0 || !formData.date || !formData.time) return '#';
        const startTime = new Date(`${formData.date}T${formData.time}`);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        const formatTime = (date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const details = `Cliente: ${formData.name}\nTel: ${formData.phone}\nBici: ${formData.bikeType}\nNota: ${formData.comments}`;
        const title = `Cita Taller: ${getServiceNames()}`;
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatTime(startTime)}/${formatTime(endTime)}&details=${encodeURIComponent(details)}&location=Taller Bicicolombia`;
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
    };

    return (
        // Changed main background to very dark slate
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200" >
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
        }
        ::-webkit-scrollbar-track {
          background: #0f172a; 
        }
        ::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #475569; 
        }
      `}</style>

            {/* --- HEADER --- */}
            {/* Changed to dark with blur and border */}
            <header className="bg-slate-900/90 backdrop-blur-md text-white border-b border-slate-800 sticky top-0 z-50" >
                <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-2 rounded-full shadow-lg shadow-blue-500/20">
                            <Wrench className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold leading-none tracking-tight">BICICOLOMBIA</h1>
                            <p className="text-xs text-slate-400">Taller Especializado</p>
                        </div>
                    </div>
                    <a
                        href="https://wa.me/573000000000"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:shadow-lg hover:shadow-green-500/20"
                    >
                        <MessageCircle size={16} />
                        <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                </div>
            </header >

            <main className="max-w-6xl mx-auto px-4 py-8">

                <div className="grid md:grid-cols-3 gap-8">

                    {/* --- LEFT COLUMN: CONTENT --- */}
                    <div className="md:col-span-2 space-y-6">

                        {/* --- STEP 1: SERVICE SELECTION --- */}
                        {step === 1 && (
                            <div className="space-y-6 animate-fade-in">
                                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Bike className="text-blue-500" />
                                    Selecciona tus Servicios
                                </h2>

                                {SERVICE_DATA.map((category, idx) => (
                                    <div key={idx} className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                                        <div className="bg-slate-800/50 px-4 py-3 font-bold text-slate-300 border-b border-slate-700/50 uppercase text-xs tracking-wider">
                                            {category.category}
                                        </div>
                                        <div className="divide-y divide-slate-800">
                                            {category.items.map((service) => {
                                                const isSelected = selectedServices.some(s => s.id === service.id);
                                                return (
                                                    <button
                                                        key={service.id}
                                                        onClick={() => handleServiceSelect(service)}
                                                        className={`w-full text-left px-4 py-4 flex justify-between items-center hover:bg-slate-800 transition-all duration-200 group ${isSelected ? 'bg-blue-900/20 ring-1 ring-inset ring-blue-500/50' : ''}`}
                                                    >
                                                        <div>
                                                            <p className={`font-medium ${isSelected ? 'text-blue-400' : 'text-slate-200'} group-hover:text-blue-400 transition-colors`}>{service.name}</p>
                                                            <div className="flex items-center gap-3 mt-1.5">
                                                                <span className="text-emerald-400 font-bold tracking-tight">{formatPrice(service.price)}</span>
                                                                {service.express ? (
                                                                    <span className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-red-900/50 flex items-center gap-1">
                                                                        <Clock size={10} /> Express
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium border border-slate-700">
                                                                        24h
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isSelected ? (
                                                            <CheckCircle className="text-blue-500 w-5 h-5 shadow-lg shadow-blue-500/50 rounded-full" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border border-slate-600 group-hover:border-blue-500 transition-colors"></div>
                                                        )}
                                                    </button>
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
                                    className="mb-6 text-sm text-slate-500 hover:text-blue-400 flex items-center gap-2 transition-colors"
                                >
                                    ← Volver a servicios
                                </button>

                                <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6 md:p-10">
                                    <h2 className="text-2xl font-bold text-white mb-8">Agenda tu cita</h2>

                                    <div className="bg-slate-800/50 p-4 rounded-lg mb-8 border border-slate-700">
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="bg-slate-700 p-3 rounded-full text-blue-400">
                                                <Wrench size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Servicios seleccionados ({selectedServices.length})</p>
                                                <p className="text-sm font-bold text-emerald-400">{formatPrice(getTotalPrice())}</p>
                                            </div>
                                        </div>
                                        <ul className="space-y-1 pl-14">
                                            {selectedServices.map(s => (
                                                <li key={s.id} className="text-sm text-slate-300 list-disc list-inside">{s.name}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Fecha</label>
                                                <input
                                                    required
                                                    type="date"
                                                    name="date"
                                                    min={new Date().toISOString().split('T')[0]}
                                                    value={formData.date}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Hora</label>
                                                <input
                                                    required
                                                    type="time"
                                                    name="time"
                                                    min="09:00"
                                                    max="19:00"
                                                    value={formData.time}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-2 text-right">9:00 AM - 7:00 PM</p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre Completo</label>
                                                <input
                                                    required
                                                    type="text"
                                                    name="name"
                                                    placeholder="Ej: Juan Pérez"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Teléfono</label>
                                                <input
                                                    required
                                                    type="tel"
                                                    name="phone"
                                                    placeholder="Ej: 300 123 4567"
                                                    value={formData.phone}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tipo de Bicicleta</label>
                                            <select
                                                name="bikeType"
                                                value={formData.bikeType}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            >
                                                <option value="MTB">MTB (Montaña)</option>
                                                <option value="Ruta">Ruta</option>
                                                <option value="Urbana">Urbana</option>
                                                <option value="Eléctrica">Eléctrica</option>
                                                <option value="Infantil">Infantil</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Comentarios Adicionales</label>
                                            <textarea
                                                name="comments"
                                                rows="3"
                                                placeholder="Ej: Tiene un ruido extraño al frenar..."
                                                value={formData.comments}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                            ></textarea>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95 mt-4"
                                        >
                                            Confirmar Cita
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* --- STEP 3: CONFIRMACIÓN --- */}
                        {step === 3 && (
                            <div className="animate-fade-in text-center pt-4">
                                <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                                    <CheckCircle size={48} />
                                </div>
                                <h2 className="text-4xl font-bold text-white mb-4">¡Cita Agendada!</h2>
                                <p className="text-slate-400 mb-10 text-lg">Gracias {formData.name}, te esperamos para dejar tu bicicleta como nueva.</p>

                                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-8 mb-8 text-left relative overflow-hidden max-w-xl mx-auto">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                                    <div className="grid grid-cols-2 gap-y-6 text-sm relative z-10">
                                        <div className="text-slate-500 uppercase font-bold tracking-wider text-xs pt-1">Servicios ({selectedServices.length})</div>
                                        <div className="font-bold text-white text-right text-base">
                                            <ul className="list-none">
                                                {selectedServices.map(s => (
                                                    <li key={s.id} className="truncate max-w-[200px] ml-auto">{s.name}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="text-slate-500 uppercase font-bold tracking-wider text-xs pt-1">Fecha</div>
                                        <div className="font-bold text-white text-right text-base">{formData.date} - {formData.time}</div>

                                        <div className="text-slate-500 uppercase font-bold tracking-wider text-xs pt-1">Total</div>
                                        <div className="font-bold text-emerald-400 text-right text-base">{formatPrice(getTotalPrice())}</div>
                                    </div>
                                </div>

                                <div className="space-y-4 max-w-xl mx-auto">
                                    <a
                                        href={generateCalendarLink()}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors shadow-lg shadow-blue-600/20"
                                    >
                                        <Calendar size={20} />
                                        Agregar a Google Calendar
                                    </a>

                                    <button
                                        onClick={() => {
                                            setStep(1);
                                            setSelectedServices([]);
                                            setFormData({ ...formData, comments: '' });
                                        }}
                                        className="block w-full bg-slate-900 border border-slate-800 text-slate-400 font-medium py-4 px-4 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
                                    >
                                        Agendar otro servicio
                                    </button>
                                </div>

                                <div className="mt-12 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium tracking-wide">
                                    <MapPin size={12} />
                                    <span>CALLE 5 # 34-12, CALI, COLOMBIA</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* --- RIGHT COLUMN: STICKY SIDEBAR --- */}
                    <div className="md:col-span-1 relative">
                        <div className="sticky top-24 space-y-6">

                            {/* --- STEPS INDICATOR (MOVED HERE) --- */}
                            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg">
                                <div className="flex flex-col gap-4">
                                    <div className={`flex items-center gap-3 ${step >= 1 ? 'text-blue-400' : 'text-slate-500'}`}>
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-bold transition-all ${step >= 1 ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 bg-slate-800'}`}>1</span>
                                        <span className="font-medium text-sm">Seleccionar Servicio</span>
                                    </div>
                                    {/* Connector Line */}
                                    <div className="w-0.5 h-4 bg-slate-800 ml-4"></div>

                                    <div className={`flex items-center gap-3 ${step >= 2 ? 'text-blue-400' : 'text-slate-500'}`}>
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-bold transition-all ${step >= 2 ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 bg-slate-800'}`}>2</span>
                                        <span className="font-medium text-sm">Datos del Cliente</span>
                                    </div>
                                    {/* Connector Line */}
                                    <div className="w-0.5 h-4 bg-slate-800 ml-4"></div>

                                    <div className={`flex items-center gap-3 ${step >= 3 ? 'text-blue-400' : 'text-slate-500'}`}>
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-bold transition-all ${step >= 3 ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 bg-slate-800'}`}>3</span>
                                        <span className="font-medium text-sm">Confirmación</span>
                                    </div>
                                </div>
                            </div>

                            {/* Video Container - Only visible when service selected */}
                            {selectedServices.length > 0 ? (
                                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl aspect-video relative group border border-slate-800 animate-fade-in">
                                    <video
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        poster="https://images.unsplash.com/photo-1616428612745-0d04c107f9c2?auto=format&fit=crop&q=80"
                                        src={videoEjemplo}
                                    />
                                    {/* Dark gradient overlay */}
                                    <div className="absolute inset-0 flex items-end p-4 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                                <p className="text-white text-[10px] uppercase tracking-wider font-bold">Referencia Técnica</p>
                                            </div>
                                            <p className="text-slate-100 font-medium text-sm leading-tight drop_shadow-md">
                                                Procedimiento para: <span className="text-blue-400">{selectedServices[selectedServices.length - 1].name}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-8 text-center animate-fade-in">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                                        <Video size={32} />
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">Selecciona un servicio para ver el video de referencia.</p>
                                </div>
                            )}

                            {/* Info Card */}
                            {selectedServices.length > 0 && (
                                <div className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm rounded-xl p-5 animate-fade-in-up shadow-lg">
                                    <h3 className="font-bold text-blue-400 mb-2 text-sm uppercase tracking-wide">Resumen</h3>
                                    <p className="text-sm text-slate-300 mb-4 font-medium">{selectedServices.length} servicios seleccionados</p>

                                    <div className="flex items-start gap-3 mb-5 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {isAllExpress()
                                                ? "Servicios de mecánica rápida. Si los traes en la mañana, podrían estar listos hoy mismo."
                                                : "Incluye servicios especializados. Requiere dejar la bicicleta para garantizar la mejor calidad (24-48h)."}
                                        </p>
                                    </div>

                                    {step === 1 && (
                                        <button
                                            onClick={() => setStep(2)}
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                                        >
                                            Continuar <ChevronRight size={18} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- SECCIÓN: NUESTRO EQUIPO (Dark Style Refined) --- */}
                <div className="bg-slate-900 rounded-2xl p-8 md:p-12 mt-20 animate-fade-in shadow-2xl border border-slate-800">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6 border-b border-slate-800 pb-8">
                        <div>
                            <h2 className="text-3xl font-bold mb-2 text-white">Nuestro Equipo</h2>
                            <p className="text-blue-400 font-medium">Expertos apasionados por el ciclismo</p>
                        </div>
                        <p className="text-slate-500 max-w-md text-sm md:text-right italic">
                            "El talento gana partidos, pero el trabajo en equipo y la inteligencia ganan campeonatos."
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {TEAM_DATA.map((member, idx) => (
                            <div key={idx} className="group cursor-pointer">
                                <div className="aspect-square overflow-hidden rounded-xl mb-4 bg-slate-950 relative border border-slate-800 shadow-lg">
                                    {/* Gradient overlay on hover */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60 group-hover:opacity-0 transition-all duration-500 z-10"></div>
                                    <img
                                        src={member.image}
                                        alt={member.name}
                                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 transform group-hover:scale-110"
                                    />
                                </div>
                                <h3 className="font-bold text-lg leading-tight text-slate-200 group-hover:text-blue-400 transition-colors">{member.name}</h3>
                                <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mt-2">{member.role}</p>
                            </div>
                        ))}
                    </div>
                </div>

            </main>
        </div >
    );
}