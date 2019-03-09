/*
	File: constants.js
	Stores the constants of the codebase
 */
const _SERVER_PORT = 50051;

module.exports = {
    // Constant: GRPC_SERVER_TIMEOUT_SECS
    // Seconds to wait before attempting to reconnect with gRPC server
    GRPC_SERVER_TIMEOUT_SECS: 2,

    // Constant: PROTO_DIR
    // Directory containing the proto-contracts
    PROTO_DIR: __dirname + "/../../../proto-contracts/",

    // Constant: SERVER_PORT
    // gRPC server default port
    SERVER_PORT: _SERVER_PORT,

    // Constant: SERVER_ADDR
    // gRPC server default address (accept any hosts on SERVER_PORT)
    SERVER_ADDR: "127.0.0.1:" + _SERVER_PORT,
};