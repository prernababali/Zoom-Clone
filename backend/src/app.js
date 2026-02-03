import express from "express";

import {createServer} from "node:http";
import {Server} from "socket.io";

import mongoose from "mongoose";
import connectToSocket from "./controllers/socketManager.js";
import cors from "cors";

//for routes
import userRoutes from "./routes/users.routes.js";


const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port",process.env.PORT || 8000);
app.use(cors());
app.use(express.json({limit:"50kb"}));
app.use(express.urlencoded({limit: "50kb",extended: true}));

app.use("/api/v1/users", userRoutes);


// app.get("/home",(req,res)=>{
//     return res.json({"Hello": "World"});
// });
     const start = async () => {
        const connectionDb = await mongoose.connect("mongodb+srv://masoompartha1999_db:Partha1999@cluster0.m7m7dnw.mongodb.net/")
        console.log(`MONGO connected Partha Host:${connectionDb.connection.host}`);
        server.listen(app.get("port"),()=>{
    console.log("Welcome to port partha ");
});
     }
     start();