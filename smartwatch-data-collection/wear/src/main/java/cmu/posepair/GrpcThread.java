package cmu.posepair;

import android.os.Handler;
import android.os.HandlerThread;
import android.os.Message;
import android.util.Log;

import cmu.posepair.protos.WatchDataBlock;
import cmu.posepair.protos.WatchDataReceiverGrpc;
import com.google.protobuf.Empty;

import io.grpc.ConnectivityState;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.stub.StreamObserver;
import java.util.concurrent.CountDownLatch;


public class GrpcThread extends HandlerThread {

    private static final String TAG = GrpcThread.class.getSimpleName();
    private static final int START_RPC_MESSAGE = 0;
    private static final int WATCH_DATA_MESSAGE = 1;
    private static final int CLOSE_CHANNEL_MESSAGE = 2;
    private final String serverAddr;
    private final CountDownLatch finishLatch = new CountDownLatch(1);
    private final StreamObserver<Empty> grpcEmptyStreamResponse;
    private StreamObserver<WatchDataBlock> requestStream;
    private ManagedChannel grpcChannel;
    private Handler handler;

    GrpcThread(String host, int port) {
        this(host + ":" + port);
    }

    GrpcThread(String serverAddr) {
        super("GrpcTask", MAX_PRIORITY);

        this.serverAddr = serverAddr;
        this.grpcEmptyStreamResponse = new StreamObserver<Empty>() {
            @Override
            public void onNext(Empty empty) {
                // Should never enter here...
            }

            @Override
            public void onError(Throwable t) {
                Log.e(TAG, "gRPC error: " + t.getMessage() + ". Cause:\n" + t.getCause());
                startRPC(); // On error, reconnect
            }

            @Override
            public void onCompleted() {
                // Should never enter here...
                Log.i(TAG, "gRPC completed!");
                startRPC(); // On error, reconnect
            }
        };

    }

    void startRPC() {
        shutdownChannel();  // Just in case, close the channel (if not null)
        handler.obtainMessage(START_RPC_MESSAGE).sendToTarget(); // Enqueue a request to start the RPC call
    }

    void sendMessage(WatchDataBlock watchDataBlock) {
        handler.obtainMessage(WATCH_DATA_MESSAGE, watchDataBlock).sendToTarget(); // Enqueue the watchDataBlock to the handler (with `what` code WATCH_DATA_MESSAGE)
    }

    void shutdownChannel() {
        handler.obtainMessage(CLOSE_CHANNEL_MESSAGE).sendToTarget(); // Enqueue a request to shutdown the grpc channel
    }

    boolean terminate() {
        shutdownChannel();
        return quitSafely();
    }

    @Override
    protected void onLooperPrepared() {
        handler = new Handler(getLooper()) {
            @Override
            public void handleMessage(Message msg) {
                switch (msg.what) {
                case START_RPC_MESSAGE:
                    grpcChannel = ManagedChannelBuilder.forTarget(serverAddr).usePlaintext().build();
                    grpcChannel.notifyWhenStateChanged(ConnectivityState.IDLE, new Runnable() {
                        @Override
                        public void run() {
                            Log.d(TAG, "grpcChannel state is: " + grpcChannel.getState(false));
                        }
                    });
                    requestStream = WatchDataReceiverGrpc.newStub(grpcChannel).streamWatchData(grpcEmptyStreamResponse);
                    Log.i(TAG, "Connecting to gRPC server at " + serverAddr);
                    break;
                case WATCH_DATA_MESSAGE:
                    requestStream.onNext((WatchDataBlock) msg.obj); // Forward the message to the gRPC stream

                    // Make sure gRPC connection is still valid
                    if (finishLatch.getCount() == 0) {  // This only happens when RPC completed or errored before we finished sending. Sending further requests won't error, but they would silently be thrown away.
                        Log.d(TAG, "Sent WatchDataBlock, but probably won't get there because RPC call failed/terminated");
                    }
                    break;
                case CLOSE_CHANNEL_MESSAGE:
                    if (grpcChannel != null){
                        grpcChannel.shutdown();
                        Log.i(TAG, "Closed gRPC channel to " + serverAddr);
                    }
                    break;
                }
            }
        };
        startRPC(); // Start the RPC call as soon as the thread is started
    }
}
