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
	Class: SensorDataReceiver
	Inherits from <GrpcServer>
	Wrapper for gRPC server that is in charge of handling the SensorDataReceiver service.
 */
class SensorDataReceiver extends GrpcServer {
  /*
    Function: constructor
    Initializes the SensorDataReceiver

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
    this.onHumanPoseReceived = args.onHumanPoseReceived;

    const SensorDataReceiverService = protoLoader.loadProto("sensor_data").posepair.SensorDataReceiver.service;
    this.bindServerWithService(SensorDataReceiverService, {
      StreamWatchData: (call)=> {
        this._console.log("Set up StreamWatchData");
        call.on('error', (err)=> this._console.log(err));
        call.on('data', this.onSensorDataReceived);
      },
      StreamHumanPose: (call)=> {
        this._console.log("Set up StreamHumanPose");
        call.on('error', (err)=> this._console.log(err));
        call.on('data', this.onHumanPoseReceived);
      }
    });

    this._console.log("SensorDataReceiver Initialized!");
  }
}

/////////////
// Exports //
/////////////
module.exports = SensorDataReceiver;