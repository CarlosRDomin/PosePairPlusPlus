# PosePair++
This repo contains all the code pertaining the PosePair++ demo at IPSN'19.

### Visualization
The visualization code is divided into two main components:
 * A Node.js+Express backend server (in folder `visualization/server`). This server is responsible for receiving and parsing gRPC packets containing raw sensor data (launches its own gRPC server). _Note_: for debugging purposes, we also include a mock gRPC client which sends random sensor data using the appropriate proto-contract data structures.
 * A React-based frontend client (in folder `visualization/client`). This client displays a web interface that receives chunks of sensor data from the backend server (using Server-Side Events) and renders them in real-time using a plotting library (plotly.js).

#### How to run the visualization
First of all, make sure you have all the dependencies installed, by running:
```sh
sh visualization/install_npm_deps.sh
```
(which internally calls `npm install` for you)

There are currently two options based on the source of the sensor data (commands assume you first `cd visualization`):
 * If you want to use our mock gRPC data, run `npm run start-mock`
 * Otherwise, assuming smartwatch(es) are already feeding in sensor data, simply run `npm start` (or `npm run start`)

### Compiling protos
In order to use the protos in Android/Java (anything other than Node really), they need to be compiled using `protoc`.
This involves several steps:
 - [Installing protoc](installing-protoc)
 - [Installing protoc plugin for Java](installing-protoc-plugin-for-java)
 - [Compiling the protos](compiling-the-protos)

#### Installing protoc
The simplest way to install the Protocol Buffers compiler (`protoc`) is by [downloading the pre-built binary](https://github.com/protocolbuffers/protobuf/releases) (get the latest released version for your platform, e.g., `protoc-3.7.0-osx-x86_64.zip
`). After extracting the zip file, either use the full path to the `protoc` binary or add the folder to your `$PATH` (e.g., `export PATH="$PATH:<folder where the downloaded protoc is>"`)

#### Installing protoc plugin for Java
 - Clone or download the latest release of [Java gRPC](https://github.com/grpc/grpc-java)
 - Follow the instructions at `compiler/README.md`, which can be summarized as:
    * Execute `cd $GRPC_JAVA_ROOT/compiler`
    * Execute `../gradlew java_pluginExecutable`
    * The Java gRPC plugin is now at `$GRPC_JAVA_ROOT/compiler/build/exe/java_plugin/protoc-gen-grpc-java`

#### Compiling the protos
Finally, we can use this line to compile the protos (replace `<repo main folder>` with this PosePair++'s main directory and `<path to grpc-java>` with the actual path you downloaded in the previous step):
```sh
cd <repo main folder>/proto-contracts
protoc --plugin=protoc-gen-grpc-java=<path to grpc-java>/compiler/build/exe/java_plugin/protoc-gen-grpc-java --grpc-java_out=. --java_out=. watch_data.proto
```
