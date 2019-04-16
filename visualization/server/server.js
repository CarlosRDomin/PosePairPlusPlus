const express = require("express");
const {SSE} = require("./lib/server-side-events");
const grpcConstants = require("./lib/constants.js");
const SensorDataReceiver = require("./lib/grpc/sensor_data_receiver");

const app = express();
app.set("port", process.env.PORT || 3001);

const sseSensorData = new SSE();
const defaultSensorDataGrpcServerAddr = "0.0.0.0:" + grpcConstants.SERVER_PORT;

const sensorDataReceiver = new SensorDataReceiver({
  serverAddress: defaultSensorDataGrpcServerAddr,
  onSensorDataReceived: (sensorData)=> {
    //console.log("Received data from watch " + sensorData.watch_id + "!");
    sseSensorData.send(sensorData);
  },
  onHumanPoseReceived: (humanPose)=> {
    // console.log("Received data from person #" + humanPose.person_id + "!");
    sseSensorData.send(humanPose);
  }
});
sensorDataReceiver.start();

// Express only serves static assets in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));
}
app.use(express.json());  // Allows reading body in POST requests

app.get("/events/sensorData", sseSensorData.init);

getConfig = () => {
  return {
    sensorDataReceiver: { serverAddress: sensorDataReceiver.serverAddress }
  };
};
app.get("/config", (req, res)=> {
  res.json(getConfig());
});
app.post("/config", (req, res)=> {
  console.log("Updating config to", req.body);

  // If more than one configuration property wants to be changed, do it all at once by closing the current connection, making the changes, and reconnecting
  function updateReceiverConfig(receiver, newConfig) {
    let needToReconnect = (newConfig.serverAddress !== undefined);  // Determine whether we need to close the connection and open it again or whether we can just change the config live

    // Close the connection if changing the server address
    if (needToReconnect) receiver.stop();

    // Make all the necessary changes
    Object.keys(newConfig).map((newConfigKey) => { receiver[newConfigKey] = newConfig[newConfigKey]; });

    // Reconnect or push changes
    if (needToReconnect){
      receiver.start();
    }
  }

  // Iterate through all receivers (keys of req.body) that want to be changed
  Object.keys(req.body).map((receiverKey) => {
    let receiverNewConfig = req.body[receiverKey];
    let receiverToUpdate;

    // Find the gRPC receiver that corresponds to this configuration key
    switch (receiverKey) {
      case "sensorDataReceiver":
        receiverToUpdate = sensorDataReceiver;
        break;
      default:
        res.json({success: false, msg: "Incorrect receiver field (" + receiverKey + "). Whose config do you want to change?"});
        return;
    }

    // Make the changes
    updateReceiverConfig(receiverToUpdate, receiverNewConfig);
  });
  res.json({success: true, config: getConfig()});
});

app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});
