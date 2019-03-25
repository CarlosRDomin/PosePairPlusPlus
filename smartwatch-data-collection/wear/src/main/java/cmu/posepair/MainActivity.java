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
    private static final String DEFAULT_HOSTNAME = "10.0.0.13";
    private static final int DEFAULT_PORT = 50051;

    private SensorManager sensorManager;
    private SensorEventListener sensorEventListener;

    private TextView mLblSensorData;
    private EditText mEditIp, mEditPort;

    private boolean bSendData = true;

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
        mEditIp.setText(DEFAULT_HOSTNAME);
        mEditPort.setText(String.valueOf(DEFAULT_PORT));

        // Initialize sensor service
        sensorManager = (SensorManager)getSystemService(SENSOR_SERVICE);
        logSensorList();
        registerSensor();

        // Initialize WatchDataBlock
        watchDataBlockBuilder = WatchDataBlock.newBuilder().setFSamp(50).setWatchId(1);

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

        List<Sensor> sensors = sensorManager.getSensorList(Sensor.TYPE_LINEAR_ACCELERATION);
        if(sensors.size() <= 0) {
            Log.wtf(TAG, "Couldn't find a LINEAR_ACCELERATION sensor! :(");
            return;
        }
        Sensor sensor = sensors.get(0); // There should only be one...

        sensorEventListener = new SensorEventListener() {
            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {
                // I have no desire to deal with the accuracy events
                Log.w(TAG, "Sensor " + sensor + " changed accuracy to " + accuracy + "!");
            }

            @Override
            public void onSensorChanged(SensorEvent event) {
                if(event.sensor.getType() == Sensor.TYPE_LINEAR_ACCELERATION) {
                    // Display values in the UI
                    mLblSensorData.setText(String.format(SENSOR_DATA_STR_FORMAT, event.values[0], event.values[1], event.values[2], event.timestamp/1e9));

                    // Append sensor data to their axis
                    watchDataBlockBuilder.addLinAccelX(event.values[0]);
                    watchDataBlockBuilder.addLinAccelY(event.values[1]);
                    watchDataBlockBuilder.addLinAccelZ(event.values[2]);

                    // Send message every WATCH_DATA_BLOCK_BUF_SIZE samples
                    if (watchDataBlockBuilder.getLinAccelXCount() == WATCH_DATA_BLOCK_BUF_SIZE) {
                        if (bSendData) {
                            watchDataBlockBuilder.setTLatest(TimeUtil.getCurrentTime());
                            //watchDataBlockBuilder.setTLatest(TimeUtil.createTimestampFromNanos(event.timestamp));
                            //Log.v(TAG, "Sending WatchDataBlock with timestamp " + event.timestamp);
                            WatchDataBlock data = watchDataBlockBuilder.build();
                            grpcThread.sendMessage(data);
                        }

                        // Recycle the same WatchDataBlockBuilder -> Just clear x,y,z values
                        watchDataBlockBuilder.clearLinAccelX();
                        watchDataBlockBuilder.clearLinAccelY();
                        watchDataBlockBuilder.clearLinAccelZ();
                    }
                }
            }
        };
        sensorManager.registerListener(sensorEventListener, sensor, SensorManager.SENSOR_DELAY_GAME);

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
