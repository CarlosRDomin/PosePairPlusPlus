/*
	File: proto_loader.js
	Wrapper that loads a proto file
 */

//////////////////
// Dependencies //
//////////////////
const grpc = require('grpc');
const constants = require('../constants');
const protoLoader = require('@grpc/proto-loader');

///////////////
// Functions //
///////////////

/*
	Function: loadProto
	Loads the proto definition from a proto file

	Parameters:

	protoFileName - a string that contains the name of the proto file. It does not
	contains the extension
	
	Returns:
	A proto object with the corresponding services and messages
 */
function loadProto(protoFileName) {
  const file = protoFileName + ".proto";

  try {
    const packageDefinition = protoLoader.loadSync(
      file,
      { keepCase: true,
        enums: String,
        includeDirs: [constants.PROTO_DIR]
      });
    return grpc.loadPackageDefinition(packageDefinition);
    //return grpc.load({root: constants.PROTO_DIR, file: file});
  } catch (e) {
    throw Error("Could not load: " + file + "\nReason: " + e.message + "\n\n" + e.stack);
  }

}

/////////////
// Exports //
/////////////
module.exports = {
  loadProto: loadProto
};