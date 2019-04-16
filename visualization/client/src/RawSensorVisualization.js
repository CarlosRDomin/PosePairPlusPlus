import React, {Component} from "react";
import _set from "lodash.set";
import CircularBuffer from "./lib/CircularBuffer";
import Visualization from "./GenericVisualization";
import {Joints} from "./lib/constants";

// Extra controls for RawSensorVisualization (xlims, ylims, download data, etc.)
class RawSensorExtraControls extends Component {

  updateYlims = () => {
    this.props.onUpdate({yaxis: {autorange: !this.yAutorange.checked, range: [this.yMin.value, this.yMax.value]}});
  };

  render() {
    return(
      <div style={{position: 'absolute', padding: 5, width: 275, left: this.props.layout.width+10, top: 75, backgroundColor: '#CFF5'}}>
        <fieldset><legend><label><input type="checkbox" ref={(el) => {this.yAutorange = el;}} defaultChecked={false} onChange={this.updateYlims} /> Vertical zoom</label></legend>
          <div>
            <div style={{display: 'flex', justifyContent: 'space-around'}}>
              <div>Min y: <input type="number" ref={(el) => {this.yMin = el;}} defaultValue="-100" onChange={this.updateYlims} style={{width: 42}} /></div>
              <div>Max y: <input type="number" ref={(el) => {this.yMax = el;}} defaultValue="100" onChange={this.updateYlims} style={{width: 42}} /></div>
            </div>
            <div style={{marginTop: 10}}>Plot height: <input type="number" step={10} min={250} max={2500} defaultValue={this.props.layout.height} onChange={(e) => this.props.onUpdate({height: e.target.value})} style={{width: 45}} /> px</div>
          </div>
        </fieldset>
        <br/>
        <fieldset><legend><label><input type="checkbox" defaultChecked={true} onChange={(e) => this.props.onUpdate({xaxis: {autorange: !e.target.checked}})} /> Horizontal zoom</label></legend>
          Show last <input type="number" step={0.1} min={0.5} defaultValue={this.props.layout.xRangeInSec} onChange={(e) => this.props.onUpdate({xRangeInSec: e.target.value})} style={{width: 35}} /> s
        </fieldset>
        <br/>
        <div style={{display: 'flex', justifyContent: 'space-evenly'}}>
          <button onClick={this.props.onDownload}>Download data</button>
          <label><input type="radio" name={"asCsv"+this.props.uniqueName} checked={!this.props.layout.downloadAsCsv} onChange={() => this.props.onUpdate({downloadAsCsv: false})} /> As json</label>{' '}
          <label><input type="radio" name={"asCsv"+this.props.uniqueName} checked={this.props.layout.downloadAsCsv} onChange={() => this.props.onUpdate({downloadAsCsv: true})} /> As csv</label>
        </div>
      </div>
    );
  }
}

RawSensorExtraControls.defaultProps = {
  layout: {
    xRangeInSec: 5,
    downloadAsCsv: false,
    width: 700,
    height: 350
  },
  uniqueName: '',
  onUpdate: () => {},
  onDownload: () => {},
};

// Specialized Visualization for raw sensor data (shows only last T secs of data)
class RawSensorVisualization extends Component {

  constructor(props) {
    super(props);
    this.state = {
      data: [],
      layout: [],
      sensorId_to_plotIdx_map: {},
      txtLog: 'Connecting...'
    };
  }

  componentDidMount() {
    this.timerXlims = setInterval(this.updateXlims, 100);
  }

  componentWillUnmount() {
    clearInterval(this.timerXlims);
  }

  updateGraph = (sensor_data) => {
    const is_watch = (sensor_data.person_id === undefined);
    const N_dims = (is_watch? 3:2);
    const id = sensor_data[is_watch? "watch_id":"person_id"];
    const t = sensor_data[is_watch? "t_latest":"t"];
    const block_size = (is_watch? sensor_data.linAccel_x.length:1);

    // Keep a reference to the buffers allocated to this watch_id (allocate new ones if necessary)
    let plotIdx = this.state.sensorId_to_plotIdx_map[id];  // Get the index in this.state.data where sensorId's data is stored
    if (plotIdx === null) return; // Null indicates "ignore this watchID"
    const isNewSensorId = (plotIdx === undefined || this.state.data[plotIdx][id] === undefined);

    let buffsXY = [];
    if (!isNewSensorId) { // If buffers were already allocated, use them (will append data to them below)
      buffsXY = this.state.data[plotIdx][id];
    } else {  // Otherwise, allocate and initialize buffers
      for (let i=0; i<N_dims; i++) {
        buffsXY.push({
          x: new CircularBuffer(this.props.buffPlotLength, Array),
          y: new CircularBuffer(this.props.buffPlotLength, Float32Array),
          title: (is_watch? 'Watch ':'Person #') + id + ' [' + String.fromCharCode('x'.charCodeAt(0) + i) + ']'
        });
      }
    }

    // Compute x-axis values (compute Date for each datapoint)
    const T_samp_millis = 1000/(is_watch? sensor_data.F_samp:13);
    let tLatest = Date.now(); // Default value in case t_latest is not specified
    if (t && (t.seconds.low || t.nanos)) {
      tLatest = t.seconds.low*1000 + t.nanos/1000000;
    } else if (buffsXY[0].x.at(-1) !== undefined) {  // If t_latest isn't specified but there's a valid time at the end of the xAxis
      tLatest = buffsXY[0].x.at(-1).getTime() + block_size*T_samp_millis; // Compute tLatest as an offset from the last time recorded
    }
    const tEarliest = tLatest - (block_size-1)*T_samp_millis;
    const xData = Array.from(Array(block_size), (e, i) => new Date(tEarliest + i*T_samp_millis));

    // Fill in the buffers
    for (let i=0; i<N_dims; i++) {
      buffsXY[i].x.push(xData);
      let letter = String.fromCharCode('x'.charCodeAt(0) + i);
      if (is_watch) {
        buffsXY[i].y.push(sensor_data['linAccel_' + letter]);
      } else {
        buffsXY[i].y.push([sensor_data['pos_' + letter][Joints.LEYE]]);  // rWrist=4; lWrist=7
      }
    }

    // Append buffers to state if we hadn't received data from this sensor yet
    if (isNewSensorId) {
      let map = this.state.sensorId_to_plotIdx_map;
      let data = this.state.data;
      let layout = this.state.layout;

      // Initialize plot info (which plot index to render at, default layout, etc.)
      if (plotIdx === undefined) plotIdx = data.length; // If a plot index hasn't been assigned to this sensorID yet, create a new plot at the bottom
      if (data[plotIdx] === undefined) {  // If creating a new plot, initialize its data and layout
        data[plotIdx] = {};
        layout[plotIdx] = {...this.props.layout};
      }

      // Update data, map and plot titles
      data[plotIdx][id] = buffsXY; // Save a reference to the newly allocated buffers
      map[id] = plotIdx; // And store the mapping watch_id <-> plotIdx
      layout[plotIdx].title = this.computePlotTitle(Object.keys(data[plotIdx]));

      // And save the new state
      this.setState({data: data, layout: layout, sensorId_to_plotIdx_map: map});
      this.requestSensorIDtoPlotIDmap.value = data.map((plotData) => {
        let sensorIDs = Object.keys(plotData).map((key)=> (isNaN(parseInt(key))? '"' + key + '"' : key));
        return (sensorIDs.length>1)? ('[' + sensorIDs + ']') : sensorIDs;
      });
    }
  };

  computePlotTitle = (sensorIDs) => {
    return "Stream from watch" + ((sensorIDs.length > 1)? "es ":" ") + sensorIDs.join(", ");
  };

  onRelayout = (update, plotIdx) => {
    let layout = this.state.layout;

    Object.keys(update).forEach((key) => {
      _set(layout[plotIdx], key, update[key]);
    });

    this.setState({layout: layout});
  };

  onRestyle = (update, plotIdx) => {
    // update is a 2-item array: update[0] contains a dictionary of properties that have changed; update[1] contains the indices of the traces whose properties have changed
    // When we store the data though, data[plotIdx] is a dictionary of sensorIDs, so we can't access directly the update[1]'th line.
    // We need to get the keys of data[plotIdx] (the IDs) and then select the update[1]'th key (i.e. select keys[update[1]])
    // Also note that for each property in update[0], the contents of that dictionary entry are an array of the same length as update[1]
    // (e.g.: update[0] = {visible: [true, false]}; update[1] = [2, 3]; would mean that line 2's visible is now true, and line 3's should be false)
    // So the approach is to iterate each line in update[1] that has changed, and then iterate each property in update[0], access the corresponding index and save the value in the corresponding entry in this.state.data

    let data = this.state.data;
    let updatePropKeys = Object.keys(update[0]);  // List all the properties that have changed

    // Precompute info about all lines in the current plot (data[plotIdx]) so we can access the one specified by update[1]
    // data[plotIdx] is a dictionary with a key for each watch_id in that plot, and then each watch_id is an array with 1 or more signals (depending on the number of axes in that sensing modality)
    let plotKeys = [];  // Save the [watch_id, axis] for each line in the plot
    Object.keys(data[plotIdx]).forEach((sensorKey) => data[plotIdx][sensorKey].forEach((_, axisIdx) => {
      plotKeys.push([sensorKey, axisIdx]);
    }));

    // Iterate every line index in update[1] (there could be multiple) and update the corresponding data properties indicated by update[0]
    update[1].forEach((lineIdx, updateIdx) => {
      let lineKeys = plotKeys[lineIdx];  // Get the keys (watch_id, axis) of the lineIdx'th line in this plot (data[plotIdx])

      // Iterate every property in update[0] that has changed, and update data with the updateIdx'th value of each property
      updatePropKeys.forEach((updateProp) => {
        data[plotIdx][lineKeys[0]][lineKeys[1]][updateProp] = update[0][updateProp][updateIdx]; // Add update[0] to the dictionary (overwrites existing properties if necessary)
      });
    });

    this.setState({data: data});
  };

  clearPlot = () => {
    this.setState({data: [], layout: [], sensorId_to_plotIdx_map: {}});
  };

  downloadPlot = (plotIdx) => {
    const asCsv = this.state.layout[plotIdx].downloadAsCsv;
    let minDate = Date.now(), maxDate = new Date(0);
    let blobContents = null;

    if (asCsv) {
      let csvRows = [];

      Object.keys(this.state.data[plotIdx]).forEach((watch_id) => {  // Fill out the csv contents with data from all sensors in plotIdx
        let sensorData = this.state.data[plotIdx][watch_id];
        minDate = Math.min(minDate, sensorData[0].x.at(0));   // Minimum between current min and oldest point for this sensorID
        maxDate = Math.max(maxDate, sensorData[0].x.at(-1));  // Maximum between current max and latest point for this sensorID
        sensorData.forEach((sensorDataRow, rowIdx) => {
          csvRows.push(['x', 'y'].map((key) => '' + watch_id + ',' + rowIdx + ',' + key + ',' + sensorDataRow[key].values().map((v) => v.valueOf()).join(',')));
        });
      });

      blobContents = new Blob([csvRows.map((rowXY) => rowXY.join('\n')).join('\n')], {type: "text/csv; charset=utf-8;"});
    } else {  // Download as JSON
      let jsonDict = {};

      Object.keys(this.state.data[plotIdx]).forEach((watch_id) => {  // Fill out jsonDict with data from all sensors in plotIdx
        let sensorData = this.state.data[plotIdx][watch_id];
        minDate = Math.min(minDate, sensorData[0].x.at(0));   // Minimum between current min and oldest point for this sensorID
        maxDate = Math.max(maxDate, sensorData[0].x.at(-1));  // Maximum between current max and latest point for this sensorID

        jsonDict[watch_id] = sensorData.map((sensorDataRow) => ({
          x: sensorDataRow.x.values().map((v) => v.valueOf()),
          y: Array.from(sensorDataRow.y.values()) // Convert TypedArray to Array
        }));
      });

      blobContents = new Blob([JSON.stringify(jsonDict)], {type: "application/json"});
    }

    function twoDigit(n) { return ('0' + n).slice(-2); }	// Helper function to convert 1-digit numbers to 2-digit strings (eg: 2->'02')
    function dateToStr(d) {
      d = new Date(d);  // Make sure it's a Date
      let strDate = [d.getFullYear(), d.toLocaleString('en-US', {month: 'short'}), twoDigit(d.getDate())].join('-');
      let strTime = [twoDigit(d.getHours()), twoDigit(d.getMinutes()), twoDigit(d.getSeconds())].join('-');
      return [strDate, strTime].join('_');
    }

    const filename = [this.state.layout[plotIdx].title, dateToStr(minDate), 'to', dateToStr(maxDate)].join('_') + '.' + (asCsv? 'csv':'json');
    const url = URL.createObjectURL(blobContents);
    let link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.click();	// Start the download
  };

  onMessage = (e) => {
    let msg = JSON.parse(e.data);
    this.updateGraph(msg);
    this.setState({txtLog: 'Packet received with ID ' + e.msgId + '\n'});
  };

  onUpdateExtraControls = (newLayout, plotIdx) => {
    let layout = this.state.layout;

    function isDict(v) {
      return (typeof v==='object') && v!==null && !(v instanceof Array) && !(v instanceof Date);
    }

    function setRecursive(obj, path, newProps) {
      Object.keys(newProps).forEach((key) => {
        let nestedPath = path + (path.length>0? '.':'') + key;
        if (!isDict(newProps[key])) {  // End recursion: assign the value (it's not a nested dictionary)
          _set(obj, nestedPath, newProps[key]);
        } else {
          setRecursive(obj, nestedPath, newProps[key]);
        }
      });
    }
    setRecursive(layout[plotIdx], '', newLayout);

    this.setState({layout: layout});
  };

  updateSensorIDtoPlotIDmap = () => {
    let newMap = '[' + this.requestSensorIDtoPlotIDmap.value + ']';
    if (!newMap.startsWith('[')) newMap = '[' + newMap;
    if (!newMap.endsWith(']')) newMap += ']';
    try {
      newMap = JSON.parse(newMap);
    } catch (e) {
      this.setState({txtLog: "Unable to parse SensorID-Plot mapping (" + newMap + "), incorrect format!"});
      return; // Exit, nothing to do
    }

    // Perform the remap
    let newData = new Array(newMap.length).fill(0).map(() => ({})), newLayout = new Array(newMap.length), newDictionaryMap = {};
    newMap.forEach((plotKeys, plotIdx) => {
      if (!Array.isArray(plotKeys)) plotKeys = [plotKeys];  // Ensure plotKeys is iterable

      // Move/Remap each plot according to the new configuration
      plotKeys.forEach((watch_id) => {
        let oldPlotIndex = this.state.sensorId_to_plotIdx_map[watch_id];
        if (oldPlotIndex !== undefined) { // Data existed, just move it to the new plotIdx
          newData[plotIdx][watch_id] = this.state.data[oldPlotIndex][watch_id];
          newLayout[plotIdx] = {...this.state.layout[oldPlotIndex]};
        } else {  // Plot doesn't exist, initialize default values
          newData[plotIdx][watch_id] = undefined;
          newLayout[plotIdx] = {...this.props.layout};
        }
        // Update this.state.map to point to the new plotIdx
        newDictionaryMap[watch_id] = plotIdx;
      });

      // Update the plot title to match the sensorIDs in the new mapping
      newLayout[plotIdx].title = this.computePlotTitle(plotKeys);
    });

    // Save the remapped values
    this.setState({data: newData, layout: newLayout, sensorId_to_plotIdx_map: newDictionaryMap});
    this.visualizationEl.forceReRender();
  };

  render() {
    return(
      <Visualization SSEurl="sensorData" visType="sensorDataReceiver" ref={(el) => {this.visualizationEl = el;}}
        data={ this.state.data.map((plotData, plotIdx) => {
          const keys = Object.keys(plotData);
          const strKeys = keys.join(", ");

          let data = [];
          keys.forEach((watch_id) => plotData[watch_id] && plotData[watch_id].forEach((sensorDataRow, rowIdx) => {
              data.push({
                ...sensorDataRow, // Include the properties in sensorDataRow, such as `visible`
                x: sensorDataRow.x.values(),
                y: sensorDataRow.y.values(),
                name: sensorDataRow.title,
                key: watch_id + "." + rowIdx
              });
            })
          );

          return {
            plotData: data,
            latestData: keys.map((watch_id) => (plotData[watch_id]? plotData[watch_id][0].x.at(-1) : new Date(0))).reduce((latestData, currLatestData) => Math.max(latestData, currLatestData)),
            summary: (<RawSensorExtraControls layout={this.state.layout[plotIdx]} uniqueName={plotIdx} onUpdate={(newLayout) => { this.onUpdateExtraControls(newLayout, plotIdx); }} onDownload={() => this.downloadPlot(plotIdx) }/>),
            key: strKeys
          };
        })} clearPlots={this.clearPlot}
        layout={this.state.layout} style={{mode: 'lines', line: this.props.lineStyle}}
        plotConfig={{displayModeBar: true, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud']}}
        extraControls={
          <div style={{flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center'}}>
            <div style={{fontSize: 'smaller', flexShrink: 0, margin: '0 5px'}}>WatchID↔PlotOrder:</div>
            <input type="text" ref={(el) => {this.requestSensorIDtoPlotIDmap = el;}} style={{minWidth: 25, maxWidth: 100, flex: 1}} />
            <button onClick={this.updateSensorIDtoPlotIDmap} style={{flexShrink: 0, margin: '0 5px'}}>Update</button>
          </div>
        }
        txtLog={this.state.txtLog} updateTxtLog={(txtLog) => { this.setState({txtLog: txtLog}); }}
        onMessage={this.onMessage} onRelayout={this.onRelayout} onRestyle={this.onRestyle} />
    );
  };
}

RawSensorVisualization.defaultProps = {
  lineStyle: {
    color: 'red',
    width: 1
  },
  layout: {
    width: 1000, //700,
    height: 600, //350,
    margin: {
      l: 40,
      r: 10,
      b: 60,
      t: 80,
      pad: 4
    },
    showlegend: true,
    legend: {orientation: 'h', x:0, y:1.08, font: {size: 15}},
    title: 'Raw signal visualization',
    xRangeInSec: 5,
    downloadAsCsv: false
  },
  buffPlotLength: 1000, // How many data points we store for each sensor id
};

export default RawSensorVisualization;
