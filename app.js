import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment-timezone";
import { v4 as uuidv4 } from 'uuid';
import os from "os"
import cors from "cors"

const app = express();
const PORT = 3500;

app.use(express.json());  // Asegúrate de usar este middleware
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Configuración del middleware de sesión
app.use(session({
    secret: "p04-CPD#seiyakoulovers-SesionesPersistentes",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 }
}));

// Función de utilidad que permitirá acceder a la información de la interfaz de red (LAN)
const getClienteIP = (req) => {
    return (
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket?.remoteAddres
    );
};

// Endpoint para mensaje de bienvenida
app.get("/", (req, res) => {
    return res.status(200).json({
        message: "Bienvenida al API de Control de Sesiones",
        author: "Citlalli Perez Dionicio"
    });
});

// Función de utilidad que permitirá acceder a la información de la interfaz de red
const getServerNetworkInfo = () => {
    const interfaces = os.networkInterfaces();

    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return { serverIp: iface.address, serverMac: iface.mac };
            }
        }
    }
};

const sessionStore = {};

// Configuración del intervalo de inactividad (2 minutos = 120,000 ms)
const SESSION_TIMEOUT = 2 * 60 * 1000; // 2 minutos en milisegundos

// Función para eliminar sesiones inactivas
const cleanupInactiveSessions = () => {
    const now = moment.tz("America/Mexico_City"); // Usamos un objeto moment válido
    for (const sessionId in sessionStore) {
        const session = sessionStore[sessionId];
        const lastAccessed = moment(session.lastAccessed, "DD-MM-YYYY HH:mm:ss"); // Usamos el formato personalizado

        // Verificamos si lastAccessed es válido
        if (!lastAccessed.isValid()) {
            console.error(`Fecha no válida para la sesión ${sessionId}`);
            continue;
        }

        const inactivityDuration = now.diff(lastAccessed);

        if (inactivityDuration > SESSION_TIMEOUT) {
            // Si la sesión ha estado inactiva por más de 2 minutos, eliminarla
            delete sessionStore[sessionId];
            console.log(`Sesión ${sessionId} eliminada por inactividad.`);
        }
    }
};

// Intervalo para limpiar sesiones inactivas
setInterval(cleanupInactiveSessions, 60 * 1000); // Revisa cada minuto

// Login Endpoint
app.post("/login", (req, res) => {
    console.log("Datos recibidos:", req.body);
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Se esperan campos requeridos" });
    }

    // Generar un ID de sesión único
    const sessionId = uuidv4();
    const now = moment.tz('America/Mexico_City').format('DD-MM-YYYY HH:mm:ss'); // Formato de hora personalizado

    // Guardar los datos de la sesión en sessionStore
    sessionStore[sessionId] = {
        sessionId,
        email,
        nickname,
        macAddress,
        ip: getServerNetworkInfo(),
        createAt: now,
        lastAccessed: now,
        isActive: true
    };

    res.status(200).json({
        message: "Se ha logeado de manera exitosa !!!",
        sessionId
    });
});

// Logout Endpoint
app.post("/logout", (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || !sessionStore[sessionId]) {
        return res.status(404).json({ message: "No se encuentra una sesión activa" });
    }

    // Eliminar la sesión de sessionStore
    delete sessionStore[sessionId];  // Elimina la sesión del almacenamiento

    res.status(200).json({ message: "Logout successful" });
});

// Actualización de la sesión
app.put("/update", (req, res) => {
    const { sessionId, email, nickname } = req.body;

    if (!sessionId || !sessionStore[sessionId]) {
        return res.status(404).json({ message: "No existe una sesión activa" });
    }

    const session = sessionStore[sessionId];
    const now = moment.tz("America/Mexico_City"); 

    if (email) sessionStore[sessionId].email = email;
    if (nickname) sessionStore[sessionId].nickname = nickname;
    session.lastAccessed = now.format('DD-MM-YYYY HH:mm:ss'); 
    session.isActive = true;
    
    // Verificamos si las fechas son válidas
    const createdAtMoment = moment(session.createdAt, 'DD-MM-YYYY HH:mm:ss');
    const lastAccessedMoment = moment(session.lastAccessed, 'DD-MM-YYYY HH:mm:ss');

    if (!createdAtMoment.isValid() || !lastAccessedMoment.isValid()) {
        return res.status(500).json({ message: "Error: Fechas no válidas." });
    }

    // Tiempo de conexión (diferencia entre createdAt y la hora actual)
    const connectionTime = now.diff(createdAtMoment, 'seconds');

    // Tiempo de inactividad (diferencia entre lastAccessed y la hora actual)
    const inactivityTime = now.diff(lastAccessedMoment, 'seconds');
    res.status(200).json({
        message: "Sesión ha sido actualizada",
        session: {
            ...session,
            connectionTime: `${connectionTime} seconds`, // Tiempo de conexión
            inactivityTime: `${inactivityTime} seconds`  // Tiempo de inactividad
            
        }
    });
});

//? Endpoint para verificar el estado de la sesión
app.get("/status", (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId || !sessionStore[sessionId]) {
        return res.status(404).json({ message: "No existe una sesión activa" });
    }

    const session = sessionStore[sessionId];
    const now = moment.tz("America/Mexico_City");

    const createdAtMoment = moment(session.createdAt, 'DD-MM-YYYY HH:mm:ss');
    const lastAccessedMoment = moment(session.lastAccessed, 'DD-MM-YYYY HH:mm:ss');

    // Validación de las fechas
    if (!createdAtMoment.isValid() || !lastAccessedMoment.isValid()) {
        return res.status(500).json({ message: "Error: Fechas no válidas." });
    }

    // Tiempo de conexión (diferencia entre createdAt y la hora actual)
    const connectionTime = now.diff(createdAtMoment, 'seconds');

    // Tiempo de inactividad (diferencia entre lastAccessed y la hora actual)
    const inactivityTime = now.diff(lastAccessedMoment, 'seconds');

    
    res.status(200).json({
        message: "Sesión activa",
        session: {
            ...session,
            connectionTime: `${connectionTime} seconds`, // Tiempo de conexión
            inactivityTime: `${inactivityTime} seconds`  // Tiempo de inactividad
        }
    });
});

app.get("/sessions", (req, res) => {
    res.status(200).json({
        message: "Sesiones activas",
        activeSessions: Object.values(sessionStore)
    });
});

app.get("/sessions", (req, res) => {
    res.status(200).json({
        message: "Sesiones activas",
        activeSessions: Object.values(sessionStore).filter(s => s.isActive)
    });
});

// Nuevo endpoint para el registro de todas las sesiones
app.get("/session-log", (req, res) => {
    res.status(200).json({
        message: "Registro de todas las sesiones",
        sessions: Object.values(sessionStore)
    });
});


// Inicializamos el servicio
app.listen(PORT, () => {
    console.log(`Servicio iniciando en http://localhost:${PORT}`);
});


//? Sesiones almacenadas en Memoria RAM
