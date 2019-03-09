//////////////////
// Dependencies //
//////////////////
const GrpcServer = require('./grpc_server.js');
const protoLoader = require("./proto_loader.js");
const { SERVER_PORT } = require("../constants.js");

//////////////////////////
// Class Implementation //
//////////////////////////

/*
	Class: WatchDataReceiver
	Inherits from <GrpcServer>
	Wrapper for gRPC server that is in charge of handling the WatchDataReceiver service.
 */
class WatchDataReceiver extends GrpcServer {
  /*
    Function: constructor
    Initializes the WatchDataReceiver

    Parameters:
    Args is a dictionary which contains:

    console (optional) - a console with a .log interface to which we output results
    serverAddress - the address of the gRPC server to which the receiver should connect to
    onSensorDataReceived - an external callback function that handles the reception of new, incoming sensor data blocks
  */
  constructor(args) {
    args.serverAddress = (args.serverAddress || "0.0.0.0:"+SERVER_PORT); // Use default address if not provided
    super(args);
    this.onSensorDataReceived = args.onSensorDataReceived;

    const WatchDataReceiverService = protoLoader.loadProto("watch_data").posepair.WatchDataReceiver.service;
    this.bindServerWithService(WatchDataReceiverService, {
      StreamWatchData: (call)=> {
        this._console.log("Set up StreamWatchData");
        call.on('error', (err)=> this._console.log(err));
        call.on('data', this.onSensorDataReceived);
      }
    });

    this._console.log("WatchDataReceiver Initialized!");
  }
}

/////////////
// Exports //
/////////////
module.exports = WatchDataReceiver;