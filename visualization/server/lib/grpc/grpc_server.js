//////////////////
// Dependencies //
//////////////////
const grpc = require('grpc');

//////////////////////////
// Class Implementation //
//////////////////////////

/*
	Class: GrpcServer
	Wrapper for a gRPC server. Used to set up a local gRPC server for testing purposes.
 */
class GrpcServer {
  /*
    Function: constructor
    Initilizaes the GrpcServer

    Parameters:
    Args is a dictionary which contains:

    console - a console we can use to log
    serverAddress - Address where the server should be launched
  */
  constructor(args) {
    this._console = (args.console || console);
    this.serverAddress = args.serverAddress;
    this.server = new grpc.Server();
    this.started = false;
  }

  /*
    Function: bindServerWithService
    Connects the server to a given service. The server must not have been started when this
    function is called.

    Parameters:

    service - A service defined in a proto file
    functionBindings - An object that contains the function bindings for the given service.
    These functions are defined in the proto file of the service.
   */
  bindServerWithService(service, functionBindings) {
    this.server.addService(service, functionBindings);
  }

  /*
    Function: start
    Starts the gRPC server
   */
  start() {
    this.server.bind(this.serverAddress, grpc.ServerCredentials.createInsecure());
    this.server.start();
    this.started = true;
  }

  /*
    Function: stop
    Forceful shutdown of the gRPC server
   */
  stop() {
    this.server.forceShutdown();
    this.started = false;
  }

  /*
    Function: gracefulStop
    Attempts to shutdown the gRPC server graciously.
   */
  gracefulStop() {
    this.server.tryShutdown(() => {});
    this.started = false;
  }
}

/////////////
// Exports //
/////////////
module.exports = GrpcServer;

