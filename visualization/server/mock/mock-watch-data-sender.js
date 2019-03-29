//////////////////
// Dependencies //
//////////////////
const GrpcClient = require("../lib/grpc/grpc_client.js");
const protoLoader = require("../lib/grpc/proto_loader.js");
const { SERVER_ADDR } = require("../lib/constants.js");

//////////////////////////
// Class Implementation //
//////////////////////////

/*
	Class: MockWatchDataSender
	Helper to start several gRPC clients sending mock watch data to the SensorDataReceiver service.
 */
class MockWatchDataSender {
  /*
    Function: constructor
    Initializes the MockWatchDataSender

    Parameters:
    Args is a dictionary which contains:

    console (optional) - a console with a .log interface to which we output results
    serverAddress - the address of the gRPC server to which the receiver should connect to
    watch_ids - (Arbitrary) IDs for the mock watches. Should be a list with as many elements as mock watches to create
    block_size (optional) - Number of samples to send in each watch sensor data block (defaults to 100)
    F_samp (optional) - Sampling frequency of the mock watches (defaults to 1000)
    onServerError - an external callback function that handles a connection error
  */
  constructor(args) {
    this._console = (args.console || console);
    this.serverAddress = (args.serverAddress || SERVER_ADDR);
    this.watch_ids = (args.watch_ids || [1]);
    this.block_size = (args.block_size || 10);
    this.F_samp = (args.F_samp || 200);
    this.onServerError = args.onServerError;

    this.SensorDataReceiverService = protoLoader.loadProto("sensor_data").posepair.SensorDataReceiver;
    this._console.log("MockWatchDataSender Initialized!");
  }


  /*
    Function: start
    Connects the gRPC clients to the server and starts broadcasting mock data.
  */
  start() {
    this.mockWatchGrpcClients = new Array(this.watch_ids.length);
    this.dataGenerationIntervals = new Array(this.watch_ids.length);  // Keep track of previous setIntervals so we can stop old data generation on a new request
    this.mockData_F_sin = new Array(this.watch_ids.length);
    this.mockData_amplitudes = new Array(this.watch_ids.length);
    this.mockData_phaseOffs = new Array(this.watch_ids.length);

    for (let i=0; i<this.watch_ids.length; i++) { // Create a grpc client for each mock watch
      try {
        this.mockWatchGrpcClients[i] = new GrpcClient({ serverAddress: this.serverAddress });
        this.mockWatchGrpcClients[i]._connect({
          service: this.SensorDataReceiverService,
          method: "StreamWatchData",
          params: {},
          onStreamReceived: (sensorData) => {
            this._console.log("MockWatchDataSender received data: " + sensorData + "!");  // Shouldn't happen :P
          },
          onError: (error, retryTimeOut) => {
            this._console.log("MockWatchDataSender - Error on gRPC client for watch " + this.watch_ids[i] + ":", error);
          },
          onClose: () => {
            this._console.log("MockWatchDataSender - gRPC client for watch " + this.watch_ids[i] + " closed!");
          },
          onConnect: () => {
            this._console.log("MockWatchDataSender - gRPC client for watch " + this.watch_ids[i] + " started!");
            this.streamMockData(i);
          }
        });
      } catch (e) {
        this._console.log(e)
      }
    }
  }

  /*
    Function: streamMockData
    Handles the mock data generation, sending blocks of (mock) watch data for each sensor ID in this.watch_ids
   */
  streamMockData(watch_idx) {
    if (this.dataGenerationIntervals[watch_idx]) clearInterval(this.dataGenerationIntervals[watch_idx]);  // Stop any previous data generation

    // Generate random (frequency,amplitude,phase) for mock sin signals
    const N_axes = 3;
    this.mockData_F_sin[watch_idx] = new Array(N_axes).fill(0).map(() => this.F_samp/(0.25 + 0.2*Math.random()));
    this.mockData_amplitudes[watch_idx] = new Array(N_axes).fill(0).map(() => 3 + 4*Math.random());
    this.mockData_phaseOffs[watch_idx] = new Array(N_axes).fill(0).map(() => 2*Math.PI*Math.random());

    this.dataGenerationIntervals[watch_idx] = setInterval(()=> {
        this.mockWatchGrpcClients[watch_idx].call.write({
          watch_id: this.watch_ids[watch_idx],
          F_samp: this.F_samp,
          t_latest: {
            seconds: Math.floor(Date.now()/1000),
            nanos: 1000000*(Date.now()%1000)
          },
          linAccel_x: Array.from(new Float32Array(this.block_size).map((v,ind)=> this._mockDataPoint(watch_idx, ind, 0))),
          linAccel_y: Array.from(new Float32Array(this.block_size).map((v,ind)=> this._mockDataPoint(watch_idx, ind, 1))),
          linAccel_z: Array.from(new Float32Array(this.block_size).map((v,ind)=> this._mockDataPoint(watch_idx, ind, 2)))
        });

        // Update the phase offsets so on next iteration the signals start where this iteration ended
        this.mockData_phaseOffs[watch_idx].map((phase, phaseIdx) => { this.mockData_phaseOffs[watch_idx][phaseIdx] = (phase + 2*Math.PI/this.mockData_F_sin[watch_idx][phaseIdx]*this.block_size) % (2*Math.PI); });
      }, 1000*this.block_size/this.F_samp
    );
  }

  /*
    Function: _mockDataPoint
    Returns the value of the point_idx-th point in a block of mock watch data for watch #watch_idx, for the axis
   */
  _mockDataPoint(watch_idx, point_idx, axis) {
    return this.mockData_amplitudes[watch_idx][axis]*Math.sin(2*Math.PI/this.mockData_F_sin[watch_idx][axis]*point_idx + this.mockData_phaseOffs[watch_idx][axis]) + 0.25*(Math.random()-0.5);
  }
}

let mockWatchDataSender = new MockWatchDataSender({ serverAddress: SERVER_ADDR, watch_ids: [1,3] });
mockWatchDataSender.start();