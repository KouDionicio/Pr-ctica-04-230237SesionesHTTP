import express from "express";
import sessions from "express-session";
import bodyParser from "body-parser";
import moment from "moment-timezone";
import {v4 as uuidv4} from 'uuid';

const app = express();
const PORT = 3500;

app.use(express.json());  // Asegúrate de usar este middleware
app.use(express.urlencoded({ extended: true }));

//? Funcion de utilidad que permitira acceder a la información de la interfaz de red en este caso (LAN)
const getClienteIP = (req)=>{
    return (
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket?.remoteAddres
        
    );
}

//? Login Endpoint
app.post("/login", (req, res)=>{
    console.log("Datos recibidos:", req.body);
    const {email, nickname, macAddress} = req.body;

    if(!email || !nickname || !macAddress){
        return res.status(400).json({message: "Se esperan campos requeridos"})
    }

    const sessionId = uuidv4();
    const now = new Date();

    sessions[sessionId] ={
        sessionId,
        email,
        nickname,
        macAddress,
        ip: getClienteIP(req),
        createdAt: now,
        lastAccessed: now
    };

    res.status(200).json({
        message: "Se ha logeado de manera exitosa !!!",
        sessionId
    });
});

//? Logout Endpoint
app.post("/logout",(req, res)=>{
    const {sessionId} = req.body;

    if(!sessionId || !sessions[sessionId]){
        return res.status(404).json({message: "No se encuentra una sesión activa"})
    }

    delete sessions[sessionId];
    req.session.destroy((err)=>{
        if(err){
            return res.status(500).send('Error al cerrar sesión')
        }
    })
    res.status(200).json({message: "Logout successful"});
});

//? Actualización de la Sesión
app.purge("/update", (req, res) =>{
    const {sessionId, email,nickname} = req.body;

    if(!sessionId || !sessions[sessionId]){
        return res.status(404).json({message: "No existe una sesión activa"})
    } 

    if (email) sessions[sessionId].email = email;
    if (nickname) sessions[sessionId].nickname = nickname;  
    sessions[sessionId].lastAccessed = new Date();

    res.status(200).json({
        message: "Sesión ha sido actualizada",
        session: sessions[sessionId]
    })
})

//?
app.get("/status", (req, res)=>{
    const sessionId= req.query.sessionId;

    if(!sessionId || !sessions[sessionId]){
        return res.status(404).json({message: "No existe una sesión activa"})
    } 

    res.status(200).json({
        message: "Sesión activa",
        session: sessions[sessionId]
    })
})


//? Inicializamos el servicio
app.listen(PORT,()=>{
    console.log(`Servicio iniciando en http://localhost:${PORT}`);
})



//? Sesiones almacenadas en Memoria RAM
