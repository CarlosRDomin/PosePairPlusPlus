package edu.cs4730.wearsensorsdemo;

import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
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
import android.os.StrictMode;
import android.view.View;
import android.widget.ToggleButton;


public class MainActivity extends WearableActivity {


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
    String hostname = "192.168.0.17";
    int port = 2010;
    EditText inputIp, inputPort, inputLimit;
    Button applyButton;

    int counter = 0;
    int limit = 100;
    ByteBuffer dataBuffer = ByteBuffer.allocate(4 * 3 * limit);
    StringBuilder sbX = new StringBuilder();
    StringBuilder sbY = new StringBuilder();
    StringBuilder sbZ = new StringBuilder();

    boolean isTransmit = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // processing android.os.NetworkOnMainThreadException
        if (android.os.Build.VERSION.SDK_INT > 9) {
            StrictMode.ThreadPolicy policy = new StrictMode.ThreadPolicy.Builder().permitAll().build();
            StrictMode.setThreadPolicy(policy);
        }
        setAmbientEnabled();

        mContainerView = (BoxInsetLayout) findViewById(R.id.container);
        mTextView = (TextView) findViewById(R.id.text);
        mData = (TextView) findViewById(R.id.data);
        toggleButton = (ToggleButton) findViewById(R.id.toggleButton);
        toggleButton.setOnClickListener(new View.OnClickListener() {

            public void onClick(View v) {
                if(toggleButton.isChecked()){
                    isTransmit = true;
                }
                else{
                    isTransmit = false;
                }

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

        connectToServer();
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
                    outputBinaryData(event.values);
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
        try {
            hostname = inputIp.getText().toString().equals("") ? "192.168.0.17" : inputIp.getText().toString();
            port = inputPort.getText().toString().equals("") ? 2010 : Integer.parseInt(inputPort.getText().toString());
            socket = new Socket(hostname, port);
        } catch (UnknownHostException ex) {
            System.out.println("Server not found: " + ex.getMessage());
        } catch (IOException ex) {
            System.out.println("I/O error: " + ex.getMessage());
        }
    }

    void outputBinaryData(float[] data) {
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
    }
}
