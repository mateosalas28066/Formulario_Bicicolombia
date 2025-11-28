export const SERVICE_DATA = [
    {
        category: "Mantenimiento General",
        items: [
            { id: 'm1', name: "Mto. Sencillo Gama 1", price: 75000, express: false },
            { id: 'm2', name: "Mto. Completo Gama 1", price: 110000, express: false },
            { id: 'm3', name: "Mto. Sencillo Gama 2", price: 85000, express: false },
            { id: 'm4', name: "Mto. Completo Gama 2 (Incluye Tijera)", price: 120000, express: false },
            { id: 'm5', name: "Mto. Suspensión Aire Gama 2", price: 125000, express: false },
            { id: 'm6', name: "Mto. Suspensión Aire Gama 1", price: 65000, express: false },
            { id: 'm7', name: "Mto. Suspensión Hidráulica Gama 1", price: 45000, express: false },
        ]
    },
    {
        category: "Llantas",
        items: [
            { id: 'l1', name: "Despinchada", price: 4000, express: true },
            { id: 'l2', name: "Cambio de Rin / Enradiada", price: 30000, express: true },
            { id: 'l3', name: "Cobalada Rin", price: 10000, express: true },
            { id: 'l4', name: "Tubelizada (por rueda)", price: 25000, express: false },
            { id: 'l5', name: "Engrase Manzana Delantera/Trasera G1", price: 10000, express: false },
        ]
    },
    {
        category: "Frenos",
        items: [
            { id: 'f1', name: "Purgada Parcial", price: 10000, express: true },
            { id: 'f2', name: "Purgada Total", price: 20000, express: true },
            { id: 'f3', name: "Mto. Frenos Hidráulicos Gama 1", price: 40000, express: false }, // Marcado rojo en imagen
            { id: 'f4', name: "Cambio Pastillas Disco Sencillo", price: 15000, express: true },
            { id: 'f5', name: "Cambio de Borradores", price: 10000, express: true },
            { id: 'f6', name: "Mto. Frenos SRAM (Der o Izq)", price: 55000, express: false }, // Marcado rojo en imagen
            { id: 'f7', name: "Purgada Frenos SRAM (Der o Izq)", price: 25000, express: true },
        ]
    },
    {
        category: "Sistema de Cambios",
        items: [
            { id: 'c1', name: "Calibrada de Cambios", price: 15000, express: true },
            { id: 'c2', name: "Cambio/Alineación de Uña", price: 8000, express: true },
            { id: 'c3', name: "Cambio de Pacha o Cassette", price: 20000, express: true },
        ]
    },
    {
        category: "Engrasada y Ajustes",
        items: [
            { id: 'e1', name: "Engrase de Centro o Caja", price: 15000, express: true },
            { id: 'e2', name: "Engrase Caja de Dirección", price: 10000, express: true },
            { id: 'e3', name: "Engrase Núcleo Sellado", price: 20000, express: false },
            { id: 'a1', name: "Alistamiento o Puesta a Punto", price: 35000, express: true },
        ]
    }
];
