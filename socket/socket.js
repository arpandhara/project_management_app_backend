import { Server } from "socket.io";

let io;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    pingTimeout: 60000,
    cors: {
      // Allow any origin for dev (simplifies localhost vs 127.0.0.1 issues)
      origin: true, 
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Connected to socket:", socket.id);

    socket.on("setup", (userData) => {
      if (userData?.userId) {
        socket.join(`user_${userData.userId}`);
        socket.emit("connected");
        console.log(`👤 User joined room: user_${userData.userId}`);
      }
    });

    socket.on("join_project", (room) => {
      socket.join(room);
      console.log(`Ps User joined project room: ${room}`);
    });

    socket.on("leave_project", (room) => {
      socket.leave(room);
    });

    socket.on("disconnect", () => {
      // console.log("USER DISCONNECTED", socket.id);
    });
  });

  return io;
};

export { initializeSocket, io };