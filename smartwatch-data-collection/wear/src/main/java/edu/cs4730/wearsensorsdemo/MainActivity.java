package edu.cs4730.wearsensorsdemo;

import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Message;
import android.support.wearable.activity.WearableActivity;
import android.support.wear.widget.BoxInsetLayout;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import java.nio.ByteBuffer;
import java.util.List;
import java.net.*;
import java.io.*;
import java.util.concurrent.CountDownLatch;

import android.os.StrictMode;
import android.view.View;
import android.widget.ToggleButton;


import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.stub.StreamObserver;
import com.google.protobuf.Empty;
import com.google.protobuf.util.TimeUtil;
import edu.cs4730.wearsensorsdemo.protos.WatchDataBlock;
import edu.cs4730.wearsensorsdemo.protos.WatchDataReceiverGrpc;


public class MainActivity extends WearableActivity {

    private static final int WATCH_DATA_BLOCK = 1;
    private static final int WATCH_DATA_BLOCK_BUF_SIZE = 20;

    BoxInsetLayout mContainerView;
    TextView mTextView, mData;
    private SensorManager sensorManager;
    private List<Sensor> sensors;
    private Sensor sensor;
    private SensorEventListener listener;
    String TAG = "WearActivity";

    Socket socket;

    ToggleButton toggleButton;

    // https://developer.android.com/studio/run/emulator-networking#networkaddresses
    // ifconfig | grep "inet " | grep -v 127.0.0.1
    String hostname = "10.0.0.204";
    int port = 50051;
    EditText inputIp, inputPort, inputLimit;
    Button applyButton;

    int limit = 100;
    ByteBuffer dataBuffer = ByteBuffer.allocate(4 * 3 * limit);
    StringBuilder sbX = new StringBuilder();
    StringBuilder sbY = new StringBuilder();
    StringBuilder sbZ = new StringBuilder();

    boolean isTransmit = false;

    private WatchDataBlock.Builder watchDataBlockBuilder;
    private ManagedChannel grpcChannel = null;
    private GrpcThread grpcThread = null;


    private class GrpcThread extends HandlerThread {

        Handler handler;
        private final CountDownLatch finishLatch = new CountDownLatch(1);
        private final StreamObserver<WatchDataBlock> requestStream;

        GrpcThread(ManagedChannel channel) {
            super("GrpcTask", MAX_PRIORITY);
            this.requestStream = WatchDataReceiverGrpc.newStub(channel).streamWatchData(new StreamObserver<Empty>() {
                @Override
                public void onNext(Empty empty) {
                    // Should never get here...
                }

                @Override
                public void onError(Throwable t) {
                    Log.e(TAG, "gRPC error: " + t.getMessage() + ". Cause:\n" + t.getCause());
                    finishLatch.countDown();
                }

                @Override
                public void onCompleted() {
                    Log.i(TAG, "gRPC completed!");
                    finishLatch.countDown();
                }
            });
        }

        void sendMessage(WatchDataBlock watchDataBlock) {
            handler.obtainMessage(WATCH_DATA_BLOCK, watchDataBlock).sendToTarget();
        }

        @Override
        protected void onLooperPrepared() {
            handler = new Handler(getLooper()) {
                @Override
                public void handleMessage(Message msg) {
                    requestStream.onNext((WatchDataBlock) msg.obj);
                    if (finishLatch.getCount() == 0) {  // RPC completed or errored before we finished sending. Sending further requests won't error, but they will just be thrown away.
                        Log.d(TAG, "Sent WatchDataBlock, but probably won't get there because RPC call failed/terminated");
                    }
                }
            };
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // processing android.os.NetworkOnMainThreadException
        StrictMode.ThreadPolicy policy = new StrictMode.ThreadPolicy.Builder().permitAll().build();
        StrictMode.setThreadPolicy(policy);
        setAmbientEnabled();

        mContainerView = (BoxInsetLayout) findViewById(R.id.container);
        mTextView = (TextView) findViewById(R.id.text);
        mData = (TextView) findViewById(R.id.data);
        toggleButton = (ToggleButton) findViewById(R.id.toggleButton);
        toggleButton.setOnClickListener(new View.OnClickListener() {

            public void onClick(View v) {
                isTransmit = toggleButton.isChecked();
            }
        });
        inputIp = (EditText) findViewById(R.id.ip);
        inputPort = (EditText) findViewById(R.id.port);
        inputLimit = (EditText) findViewById(R.id.limit);
        limit = Integer.parseInt(inputLimit.getText().toString());
        applyButton = (Button) findViewById(R.id.applyButton);
        applyButton.setOnClickListener(new View.OnClickListener() {

            public void onClick(View v) {
                try{
//                    if(!hostname.equals(inputIp.getText().toString()) ||
//                            port != Integer.parseInt(inputPort.getText().toString())){
                        if (socket != null) {
                            socket.close();
                        }
                        connectToServer();
//                    }
                }catch (IOException ex){
                    System.out.println("I/O error: " + ex.getMessage());
                }

                limit = Integer.parseInt(inputLimit.getText().toString());
                dataBuffer = ByteBuffer.allocate(4 * 3 * limit); // Each float is 4B, there's x y and z data, and we send the buffer every `limit` points
            }
        });
        inputIp.setText(hostname);
        inputPort.setText(String.valueOf(port));
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);

        //write out to the log all the sensors the device has.
        sensors = sensorManager.getSensorList(Sensor.TYPE_ALL);
        if (sensors.size() < 1) {
            Toast.makeText(this, "No sensors returned from getSensorList", Toast.LENGTH_SHORT).show();
            Log.wtf(TAG,"No sensors returned from getSensorList");
        }
        Sensor[] sensorArray = sensors.toArray(new Sensor[sensors.size()]);
        for (int i = 0; i < sensorArray.length; i++) {
            Log.wtf(TAG,"Found sensor " + i + " " + sensorArray[i].toString());
        }

        watchDataBlockBuilder = WatchDataBlock.newBuilder().setFSamp(50).setWatchId(1);

        connectToServer();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (grpcThread != null) grpcThread.quitSafely();
    }

    @Override
    public void onEnterAmbient(Bundle ambientDetails) {
        super.onEnterAmbient(ambientDetails);
        updateDisplay();
    }

    @Override
    public void onUpdateAmbient() {
        super.onUpdateAmbient();
        updateDisplay();
    }

    @Override
    public void onExitAmbient() {
        updateDisplay();
        super.onExitAmbient();
    }

    //part of the template code.  modified to add my textview.
    private void updateDisplay() {
        if (isAmbient()) {
            mContainerView.setBackgroundColor(Color.BLACK);
            mTextView.setTextColor(Color.WHITE);
            mData.setTextColor(Color.WHITE);

        } else {
            mContainerView.setBackground(null);
            mTextView.setTextColor(Color.BLACK );
            mData.setTextColor(Color.BLACK);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        registerSensor();
    }
    @Override
    protected void onPause() {
        super.onPause();
        unregisterSensor();
    }
    @Override
    protected void onStop() {
        super.onStop();
        //just to make sure.
        unregisterSensor();
    }
    void registerSensor() {
        //just in case
        if (sensorManager == null)
          sensorManager = (SensorManager)getSystemService(SENSOR_SERVICE);

        sensors = sensorManager.getSensorList(Sensor.TYPE_LINEAR_ACCELERATION);
        if(sensors.size() > 0)
            sensor = sensors.get(0);

        listener = new SensorEventListener() {
            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {
                // I have no desire to deal with the accuracy events

            }
            @Override

            //STRING_TYPE_LINEAR_ACCELERATION
            public void onSensorChanged(SensorEvent event) {
                //just set the values to a textview so they can be displayed.
                if(event.sensor.getType() == Sensor.TYPE_LINEAR_ACCELERATION) {
                    String x = String.valueOf(event.values[0]);
                    String y = String.valueOf(event.values[1]);
                    String z = String.valueOf(event.values[2]);
                    String msg = " x: "+ x +
                            "\n y: "+ y +
                            "\n z: "+ z; //+
                            //"\n 3: " + String.valueOf(event.values[3]) +    //for the TYPE_ROTATION_VECTOR these 2 exist.
                            //"\n 4: " + String.valueOf(event.values[4]);
                    mData.setText(msg);

                    watchDataBlockBuilder.addLinAccelX(event.values[0]);
                    watchDataBlockBuilder.addLinAccelY(event.values[1]);
                    watchDataBlockBuilder.addLinAccelZ(event.values[2]);
                    if (watchDataBlockBuilder.getLinAccelXCount() > WATCH_DATA_BLOCK_BUF_SIZE) {
                        if (isTransmit) {
                            //try {
                                watchDataBlockBuilder.setTLatest(TimeUtil.getCurrentTime());
                                grpcThread.sendMessage(watchDataBlockBuilder.build());
                                /*socket.getOutputStream().write(dataBuffer.array());
                            } catch (IOException e) {
                                System.out.println("Couldn't get socket outputStream");
                            }*/
                        }
                        watchDataBlockBuilder.clearLinAccelX();
                        watchDataBlockBuilder.clearLinAccelY();
                        watchDataBlockBuilder.clearLinAccelZ();
                        dataBuffer.clear();
                    }
                    //outputBinaryData(event.values);
                }
            }
        };
        sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME);

    }
    void unregisterSensor() {
        if (sensorManager != null && listener != null) {
            sensorManager.unregisterListener(listener);
        }
        //clean up and release memory.
        sensorManager = null;
        listener = null;
    }

    void connectToServer(){
        //try {
            hostname = inputIp.getText().toString().equals("") ? "192.168.0.107" : inputIp.getText().toString();
            port = inputPort.getText().toString().equals("") ? 2010 : Integer.parseInt(inputPort.getText().toString());

            if (grpcChannel != null) grpcChannel.shutdown();
            grpcChannel = ManagedChannelBuilder.forAddress(hostname, port).usePlaintext().build();

            if (grpcThread != null) grpcThread.quitSafely();
            grpcThread = new GrpcThread(grpcChannel);
            grpcThread.start();

            /*socket = new Socket(hostname, port);
        } catch (UnknownHostException ex) {
            System.out.println("Server not found: " + ex.getMessage());
        } catch (IOException ex) {
            System.out.println("I/O error: " + ex.getMessage());
        }*/
    }

    /*void outputBinaryData(float[] data) {
        for (float d: data) {
            dataBuffer.putFloat(d);
        }

        if (!dataBuffer.hasRemaining()) {
            if (isTransmit) {
                try {
                    socket.getOutputStream().write(dataBuffer.array());
                } catch (IOException e) {
                    System.out.println("Couldn't get socket outputStream");
                }
            }
            dataBuffer.clear();
        }
    }*/
}
