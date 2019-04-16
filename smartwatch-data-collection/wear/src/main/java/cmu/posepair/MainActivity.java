package cmu.posepair;

import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.support.wearable.activity.WearableActivity;
import android.util.Log;
import android.os.StrictMode;
import android.view.View;
import android.widget.ToggleButton;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;
import com.google.protobuf.util.TimeUtil;
import cmu.posepair.protos.WatchDataBlock;


public class MainActivity extends WearableActivity {

    private static final String TAG = MainActivity.class.getSimpleName();
    private static final int WATCH_DATA_BLOCK_BUF_SIZE = 5;
    private static final String SENSOR_DATA_NUM_FORMAT = "%6.3f";
    private static final String SENSOR_DATA_STR_FORMAT = String.format("x: %s%ny: %s%nz: %s%n@t=%%.3f", SENSOR_DATA_NUM_FORMAT, SENSOR_DATA_NUM_FORMAT, SENSOR_DATA_NUM_FORMAT);
    private static final String DEFAULT_ID = "A";
    private static final String DEFAULT_HOSTNAME = "192.168.43.58"; //"10.0.0.13";
    private static final int DEFAULT_PORT = 50051;

    private SensorManager sensorManager;
    private SensorEventListener sensorEventListener;

    private TextView mLblSensorData;
    private EditText mEditIp, mEditPort, mEditID;

    private boolean bSendData = true, bSetRotationOffset = false;

    private WatchDataBlock.Builder watchDataBlockBuilder;
    private GrpcThread grpcThread;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (BuildConfig.DEBUG) {
            Log.w(TAG, "======================================================");
            Log.w(TAG, "======= APPLICATION IN STRICT MODE - DEBUGGING =======");
            Log.w(TAG, "======================================================");

            // Don't allow anything on the main thread related to resource access
            StrictMode.setThreadPolicy(new StrictMode.ThreadPolicy.Builder()
                    .detectAll()
                    .penaltyLog()
                    .penaltyFlashScreen()
                    .penaltyDeath()
                    .build());

            // Don't allow any leakage of the application's components
            StrictMode.setVmPolicy(new StrictMode.VmPolicy.Builder()
                    .detectLeakedRegistrationObjects()
                    .detectFileUriExposure()
                    .detectLeakedClosableObjects()
                    .detectLeakedSqlLiteObjects()
                    .penaltyLog()
                    .penaltyDeath()
                    .build());
        }
        //setAmbientEnabled();

        // Initialize UI
        mLblSensorData = findViewById(R.id.lblSensorData);
        mEditIp = findViewById(R.id.editIp);
        mEditPort = findViewById(R.id.editPort);
        mEditID = findViewById(R.id.editID);
        mEditIp.setText(DEFAULT_HOSTNAME);
        mEditPort.setText(String.valueOf(DEFAULT_PORT));
        mEditID.setText(DEFAULT_ID);

        // Initialize WatchDataBlock
        watchDataBlockBuilder = WatchDataBlock.newBuilder();

        // Initialize sensor service
        sensorManager = (SensorManager)getSystemService(SENSOR_SERVICE);
        logSensorList();
        registerSensor();

        // Start the GrpcThread
        connectToServer();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "ON DESTROY!!!");

        unregisterSensor();
        if (grpcThread != null) {
            grpcThread.terminate();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "ON RESUME!!!");
        //registerSensor();
    }
    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "ON PAUSE!!!");
        //unregisterSensor();
    }
    @Override
    protected void onStop() {
        super.onStop();
        Log.d(TAG, "ON STOP!!!");
        //unregisterSensor();
    }

    public void onBtnToggleSendDataClick(View v) {
        bSendData = ((ToggleButton)v).isChecked();
    }

    public void onConnectToServerClick(View v) {
        connectToServer();
    }

    public void onSetRotationOffsetClick(View v) {
        bSetRotationOffset = true;
    }

    void connectToServer() {
        boolean bSendDataOrig = bSendData;
        bSendData = false;  // Make sure we stop sending data

        String host = mEditIp.getText().toString();
        int port = Integer.parseInt(mEditPort.getText().toString());

        if (grpcThread != null) {
            grpcThread.terminate(); // Custom method which shuts down the grpc channel and calls quitSafely on the HandlerThread
        }
        grpcThread = new GrpcThread(host, port);
        grpcThread.start();

        bSendData = bSendDataOrig;  // Restore send data to its original value
    }

    private void logSensorList() {
        List<Sensor> sensors = sensorManager.getSensorList(Sensor.TYPE_ALL);

        if (sensors.size() < 1) {
            Toast.makeText(this, "ERROR: No sensors available!", Toast.LENGTH_SHORT).show();
            Log.wtf(TAG,"No sensors returned from getSensorList");
        }

        for (int i = 0; i < sensors.size(); i++) {
            Log.d(TAG,"\tFound sensor " + i + " " + sensors.get(i));
        }
    }

    void registerSensor() {
        if (sensorManager == null) sensorManager = (SensorManager)getSystemService(SENSOR_SERVICE); // Just in case

        Sensor sensorLinAccel = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION, true);
        Sensor sensorOrient = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR, true);
        if (sensorLinAccel == null) {
            Log.wtf(TAG, "Couldn't find a LINEAR_ACCELERATION sensor! :(");
            return;
        }
        if (sensorOrient == null) {
            Log.wtf(TAG, "Couldn't find a ROTATION_VECTOR sensor! :(");
            return;
        }
        watchDataBlockBuilder.setFSamp((float) 1.0e6 / (float) sensorLinAccel.getMinDelay());

        sensorEventListener = new SensorEventListener() {
            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {
                Log.d(TAG, "Sensor " + sensor + " changed accuracy to " + accuracy + "!");
            }

            private long eventTimeReference = 0L, actualTimeReference = 0L;
            private float[] rotationMatrix  = {1, 0, 0, 0, 1, 0, 0, 0, 1};
            private float[] rotMatOffset    = {1, 0, 0, 0, 1, 0, 0, 0, 1};

            private float[] matrixMultiplication(float[] a, float[] b) {
                float[] result = new float[9];

                result[0] = a[0]*b[0] + a[1]*b[3] + a[2]*b[6];
                result[1] = a[0]*b[1] + a[1]*b[4] + a[2]*b[7];
                result[2] = a[0]*b[2] + a[1]*b[5] + a[2]*b[8];

                result[3] = a[3]*b[0] + a[4]*b[3] + a[5]*b[6];
                result[4] = a[3]*b[1] + a[4]*b[4] + a[5]*b[7];
                result[5] = a[3]*b[2] + a[4]*b[5] + a[5]*b[8];

                result[6] = a[6]*b[0] + a[7]*b[3] + a[8]*b[6];
                result[7] = a[6]*b[1] + a[7]*b[4] + a[8]*b[7];
                result[8] = a[6]*b[2] + a[7]*b[5] + a[8]*b[8];

                return result;
            }

            @Override
            public void onSensorChanged(SensorEvent event) {
                if (event.sensor.getType() == Sensor.TYPE_LINEAR_ACCELERATION) {
                    // Display values in the UI
                    mLblSensorData.setText(String.format(SENSOR_DATA_STR_FORMAT, event.values[0], event.values[1], event.values[2], event.timestamp/1e9));

                    // Append sensor data to their axis
                    watchDataBlockBuilder.addLinAccelX(rotationMatrix[0]*event.values[0] + rotationMatrix[1]*event.values[1] + rotationMatrix[2]*event.values[2]);
                    watchDataBlockBuilder.addLinAccelY(rotationMatrix[3]*event.values[0] + rotationMatrix[4]*event.values[1] + rotationMatrix[5]*event.values[2]);
                    watchDataBlockBuilder.addLinAccelZ(rotationMatrix[6]*event.values[0] + rotationMatrix[7]*event.values[1] + rotationMatrix[8]*event.values[2]);

                    // Send message every WATCH_DATA_BLOCK_BUF_SIZE samples
                    if (watchDataBlockBuilder.getLinAccelXCount() == WATCH_DATA_BLOCK_BUF_SIZE) {
                        if (bSendData) {
                            // set reference times
                            if(eventTimeReference == 0L && actualTimeReference == 0L) {
                                eventTimeReference = event.timestamp;
                                actualTimeReference = System.currentTimeMillis();
                            }

                            watchDataBlockBuilder.setWatchId(mEditID.getText().toString());
                            watchDataBlockBuilder.setTLatest(TimeUtil.createTimestampFromMillis(actualTimeReference + Math.round((event.timestamp-eventTimeReference)/1000000.0)));
                            //watchDataBlockBuilder.setTLatest(TimeUtil.getCurrentTime());
                            //Log.v(TAG, "Sending WatchDataBlock with timestamp " + event.timestamp);
                            WatchDataBlock data = watchDataBlockBuilder.build();
                            grpcThread.sendMessage(data);
                        }

                        // Recycle the same WatchDataBlockBuilder -> Just clear x,y,z values
                        watchDataBlockBuilder.clearLinAccelX();
                        watchDataBlockBuilder.clearLinAccelY();
                        watchDataBlockBuilder.clearLinAccelZ();
                    }
                } else if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
                    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
                    if (bSetRotationOffset) {   // Inverse of the current rotation matrix
                        float[] orientation = new float[3];
                        SensorManager.getOrientation(rotationMatrix, orientation);  // Orientation will be yaw, pitch, roll

                        rotMatOffset[0] = (float) Math.cos(orientation[0]);
                        rotMatOffset[1] = (float) -Math.sin(orientation[0]);
                        rotMatOffset[2] = 0;
                        rotMatOffset[3] = (float) Math.sin(orientation[0]);
                        rotMatOffset[4] = (float) Math.cos(orientation[0]);
                        rotMatOffset[5] = 0;
                        rotMatOffset[6] = 0;
                        rotMatOffset[7] = 0;
                        rotMatOffset[8] = 1;
                        bSetRotationOffset = false;
                        Log.i(TAG, "Alignment rotation reset! Yaw: " + orientation[0]);
                    }
                    rotationMatrix = matrixMultiplication(rotMatOffset, rotationMatrix);  // Apply offset rotation
                }
            }
        };
        sensorManager.registerListener(sensorEventListener, sensorOrient, SensorManager.SENSOR_DELAY_FASTEST);
        sensorManager.registerListener(sensorEventListener, sensorLinAccel, SensorManager.SENSOR_DELAY_FASTEST);

    }

    void unregisterSensor() {
        if (sensorManager != null && sensorEventListener != null) {
            sensorManager.unregisterListener(sensorEventListener);
        }

        // Clean up and release memory
        sensorManager = null;
        sensorEventListener = null;
    }
}
