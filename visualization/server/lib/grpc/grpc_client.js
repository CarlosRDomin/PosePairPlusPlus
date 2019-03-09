//////////////////
// Dependencies //
//////////////////
const Deferred = require("../deferred.js");
const grpc = require('grpc');
const { GRPC_SERVER_TIMEOUT_SECS } = require("../constants.js");

//////////////////////////
// Class Implementation //
//////////////////////////

/*
	Class: GrpcClient
	Abstract class from which all gRPC clients (receivers) should import.
	Implements the logic for handling streams from a gRPC server. It manages the 
	connection of the gRPC client by providing callback functions that are sent to 
	classes, handles errors and reconnection attempts, and provides an API to
	know if a successful connection has been made to the server.
 */
class GrpcClient {
  /*
    Function: constructor
    Initalizes the GrpcClient.

    Parameters:
    args is a dictionary that contains:

    console (optional) - the console to which any output should be made
    serverAddress - the address of the gRPC server to which a client should connect to.
    onServerError - callback function fired when an error in an existing connection has occured.
   */
  constructor(args) {
    this._connectionEstablished = new Deferred();
    this._console = (args.console || console);

    this.serverAddress = args.serverAddress;
    this.onServerError = args.onServerError;
    this.reconnectAttempts = 0;
    this.lastSentMessage = null;
  }

  /*
    Function: connectionEstablished
    Helper function that helps determine if a client-server connection has been established.

    Returns:
    Promise that resolves once the client has started receiving information from the server
   */
  connectionEstablished() {
    return this._connectionEstablished.promise;
  }

  /*
    Function: _onConnect
  */
  _onConnect() {
    if (!this._connectionEstablished.hasResolved) {
      if (this.reconnectAttempts > 0) {
        this._onReconnect();
      }
      this._connectionEstablished.resolve();
    }
  }

  /*
    Function: _onReconnect
    Helper function that is called when a reconnect attempt to server is successful
   */
  _onReconnect() {
    if (this.onReconnect) {
      this.onReconnect(this.reconnectAttempts);
    }
    this.reconnectAttempts = 0;
  }

  /*
    Function: _reconnectAttempt
    Helper function that handles the logic of what to do in a reconnection attempt.
   */
  _reconnectAttempt(args) {
    this.reconnectAttempts += 1;
    this._connect(args);
    try {
      if (this.lastSentMessage) {
        this._write(this.lastSentMessage);
      }
    } catch (e) {
      this._console.log(e);
    }
  }

  /*
    Function: _connect
    Establishes the connection the gRPC server. Handles the logic of reconnecting upon failure.

    Parameters:
    args is a dictionary that contains:

    service - the gRPC service to which we would like to connect to.
    method - the method of the gRPC server that we want to handle.
    params - the paramaters sent to the method.
    onStreamReceived - callback function fired when a stream of data is received
    onClose (optional) - callback function fired when the connection is closed
    onError - callback function fired when the connection encounters and error.
   */
  _connect(args) {
    try {
      let client = new args.service(this.serverAddress, grpc.credentials.createInsecure());
      client.shouldReconnect = true;  // HACK: avoid reconnecting to the latest serverAddress if connection to old serverAddress timed out
      this.client = client;
      this.call = this.client[args.method](args.params, (err, response)=> { if(err) this._console.log("Error: " + err); else this._console.log('Response: ', response.message) });

      let deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + GRPC_SERVER_TIMEOUT_SECS);
      grpc.waitForClientReady(this.client, deadline, (err) => {
        if (!err) {
          this._onConnect();
          args.onConnect();

          this.call.on('data', (data) => {
            args.onStreamReceived(data);
          });

          this.call.on("error", (error) => {
            if (error.code === grpc.status.UNAVAILABLE || error.code === grpc.status.EOF) {
              this._handleServerError(args, error);
            } else if (error.code !== grpc.status.CANCELLED) {
              // If the error status is CANCELLED, we ignore it, since we assume it happened from our call.cancel upon closing
              // TODO: Send a message to front end and close app (maybe panic)
              this._console.log(error)
            }
          });

        } else if (client.shouldReconnect) {
            this._handleServerError(args, err);
        } else {
          console.log("gRPC connection timed out but I shouldn't reconnect");
        }
      })
    } catch (e) {
      this._console.log(e);
    }
  }

  /*
    Function: _write
    Sends a message to the gRPC server. Records the last message to send again upon reconnecting after failure.

    Parameters:

    args - dictionary with parameters to send. Varies depending on class that inherits the GrpcClient
   */
  _write(args) {
    try {
      this.lastSentMessage = args;
      this.call.write(args);
    } catch (e) {
      this._console.log(e);
    }
  }

  /*
    Function: _handleServerError
    Handles an error from the server.

    Parameters:
    args - a dictionary that contains all the original parameters from the connection
    error - the error returned by gRPC
   */
  _handleServerError(args, error) {
    this._console.log(error);
    this._console.log("Trying to connect again");
    this._close(args.onClose);
    args.onError(error, GRPC_SERVER_TIMEOUT_SECS);
    this._reconnectAttempt(args);
  }

  /*
    Function: _close
    Closes the connection of the gRPC to the server by notifying the server and closing the channel.

    Parameters:
    callback - a function fired when the connection has been succesfully closed.
   */
  _close(callback) {
    if (this.client) {
      try {

        this.call.cancel();
        this.client.shouldReconnect = false;  // HACK: avoid reconnecting to the latest serverAddress if connection to old serverAddress timed out
        // grpc.closeClient(this.client);
        this.client = null;
        this.call = null;

        if (this._connectionEstablished.hasResolved) {
          this._connectionEstablished = new Deferred();
        }

        if (callback) {
          callback();
        }
      } catch (e) {
        this._console.log(e)
      }
    }
  }
}

module.exports = GrpcClient;