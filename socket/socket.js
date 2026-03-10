let io;

function initSocket(server) {
    io = require("socket.io")(server, {
        cors: {
            origin: "*",
        },
    });

    io.on("connection", (socket) => {
        socket.on("join_inbox", (email) => {
            if (!email) return;
            socket.join(`inbox:${String(email).toLowerCase()}`);
        });

        socket.on("leave_inbox", (email) => {
            if (!email) return;
            socket.leave(`inbox:${String(email).toLowerCase()}`);
        });
    });

    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
}

module.exports = {
    initSocket,
    getIO,
};
