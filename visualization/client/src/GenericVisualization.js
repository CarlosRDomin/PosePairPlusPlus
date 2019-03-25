import React, {Component, Fragment} from "react";
import Plot from 'react-plotly.js';
import axios from "axios/index";
import {INIT_MSG} from "./lib/constants"

// Generic Visualization class (has Play/Pause buttons, arbitrary number of plots, text log...)
class Visualization extends Component {

  constructor() {
    super();
    this.state = {
      isSSEconnected: false,
      latestUpdatePerPlot: {},
      frameCounter: {overallTicks: 0}
    };
    this.timeoutScroll = null;
    this.isMouseDown = false; // TEMPORARY HACK: Because of a bug in Plotly, updating the graph while the user is interacting with it crashes

    /* When an SSE connection is open, the lastEventId is reset to 1. Since we use this msgId as the key for each plot,
     closing and reopening the SSE connection would lead to duplicate keys -> Add an offset to the msgId (which is updated on closeSSE) */
    this.msgIdOffset = 0;
    this.lastMsgId = 0; // lastEventId is only accessible from the onMessage callback -> Store a copy it here

    axios.get("/config").then((res) => { // Fetch gRPC server address
      try {
        this.grpcAddrRef.value = res.data[this.props.visType].serverAddress;
      } catch (e) {
        this.props.updateTxtLog("Unable to fetch gRPC server config");
      }
    });
  }

  componentDidMount() {
    this.startSSE();
    this.timerFps = (this.props.fps>0)? setInterval(this.frameRateTick, 1000/this.props.fps):null;
    document.addEventListener("mouseup", this.onMouseUp); // TEMPORARY HACK: Plotly adds a div overlay on user interacting with the graph -> Need mouseup to be detected in document, not in the plot itself
  }

  componentWillUnmount() {
    clearTimeout(this.timeoutScroll);
    clearInterval(this.timerFps);
    this.closeSSE();  // Don't leave SSEs open in the background if they won't be able to update the foreground
  }

  componentDidUpdate() {
    if (this.props.scrollOnUpdate === true) {
      this.scrollToBottom();
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    // If mouse is down (user is interacting, e.g. zooming) there's a bug on Plotly, so for now don't update until mouse is up
    return !this.isMouseDown;
  }

  frameRateTick = () => {
    let latestUpdatePerPlot = {};
    let frameCounter = {};
    let newData = false;

    this.props.data.forEach((plot) => {
      latestUpdatePerPlot[plot.key] = plot.latestData;

      // Only need to rerender plot if new data
      if (this.state.latestUpdatePerPlot[plot.key] !== plot.latestData) {
        newData = true;
        frameCounter[plot.key] = (this.state.frameCounter[plot.key] !== undefined)? this.state.frameCounter[plot.key]+1 : 0;
      }
    });

    if (newData) {
      frameCounter.overallTicks = this.state.frameCounter.overallTicks+1;
      this.setState({latestUpdatePerPlot: latestUpdatePerPlot, frameCounter: frameCounter});
    }
  };

  startSSE = () => { // Use Server-Side-Events to receive plot data
    let source = new EventSource('/events/' + this.props.SSEurl);
    source.reconnecting = false;  // Use a flag to determine if SSE is opening because we told it to or because it reopened after 2min of inactivity
    console.log("SSE created: /events/" + this.props.SSEurl);

    this.closeSSE = () => {
      source.close();
      this.setState({ isSSEconnected: false });
      this.props.updateTxtLog("SSE connection closed");
      console.log("SSE connection closed");
      this.msgIdOffset += this.lastMsgId; // Update msgIdOffset so no two plots have the same ID/key on SSE reconnection
    };

    source.addEventListener('message', (e) => {
      this.lastMsgId = parseInt(e.lastEventId, 10);
      e.msgId = this.lastMsgId + this.msgIdOffset;  // Create a msgId by adding an offset to e.lastMsgId, which guarantees no two plots have the same ID/key
      if (e.data !== INIT_MSG) this.props.onMessage(e);  // Forward the call to props.onMessage, unless it's an INIT message (opens the connection and avoids "Connecting..." until it timeouts)
    }, false);

    source.addEventListener('open', (e) => {
      this.setState({ isSSEconnected: true });
      let strOpened = (source.reconnecting? "reopened (after 2min of inactivity)" : "opened");
      this.props.updateTxtLog("SSE connection " + strOpened);
      console.log("SSE connection " + strOpened);
    }, false);

    source.addEventListener('error', (e) => {
      if (source.readyState === source.CLOSED) {
        this.setState({ isSSEconnected: false });
        this.props.updateTxtLog("Error on SSE - Connection closed! :(");
        console.log("Error on SSE -> Connection closed!");
        this.msgIdOffset += this.lastMsgId; // Update msgIdOffset so no two plots have the same ID/key on SSE reconnection
        source.reconnecting = false;
      } else {  // source.readyState === source.CONNECTING
        source.reconnecting = true;
      }
    }, false);
  };

  reconnectToGrpcAddr = () => {
    let grpcAddr = this.grpcAddrRef.value;
    this.props.updateTxtLog("Updating gRPC server address to " + grpcAddr + "...");

    let newConfig = {};
    newConfig[this.props.visType] = {serverAddress: grpcAddr};

    axios.post("/config", newConfig).then((res) => {
      if (res.data.success !== true) {
        this.props.updateTxtLog("Couldn't update gRPC server address: " + res.data.msg);
      } else {
        this.props.updateTxtLog("Successfully updated gRPC server address to " + res.data.config[this.props.visType].serverAddress + "!");
      }
    });
  };

  scrollToBottom = () => {
    this.timeoutScroll = setTimeout(() => {if (this.bottomEl) this.bottomEl.scrollIntoView({ behavior: "smooth" })}, 100); // Wait 100ms so the plot is added and bottomEl is moved further down, then scroll to it
  };

  onMouseDown = () => {
    this.isMouseDown = true;
  };

  onMouseUp = () => {
    this.isMouseDown = false;
  };

  xLimsFromLatestData = (plotIdx) => {
    let xRange = this.props.layout[plotIdx].xRangeInSec;

    if (xRange === undefined || xRange <= 0) {
      return {};
    } else {
      let latestData = this.props.data[plotIdx].latestData || Date.now();
      return {
        xaxis: {
          ...this.props.layout[plotIdx].xaxis,
          range: [new Date(latestData-1000*xRange), latestData]
        }
      };
    }
  };

  clearPlots = () => {
    this.msgIdOffset = (this.state.isSSEconnected? -this.lastMsgId:0); // Reset the msgId counter
    this.props.clearPlots();  // And forward the call to props.clearPlots so the parent element can clear the plots via props.data
  };

  render() {
    return (
      <div className="Visualization">
        <div style={{alignSelf: 'center'}}>
          <div className="bottomMargin" style={{display: 'flex', width: '400px', marginLeft: 'auto', marginRight: 'auto'}}>
            <div style={{flex: 1.5, display: 'flex'}}>
              <input type="text" ref={(el) => {this.grpcAddrRef = el;}} style={{flex: 1}} />
              <button style={{fontFamily: 'Lucida Sans Unicode', margin: '0 5px'}} onClick={this.reconnectToGrpcAddr} disabled>&#8635;</button>
            </div><div style={{flex: 1}}>
              <button onClick={this.state.isSSEconnected? this.closeSSE:this.startSSE}>{this.state.isSSEconnected? 'Close connection':'(Re)connect'}</button>
            </div><div style={{flex: 1}}>
              <button onClick={this.clearPlots}>Clear plot{this.props.data.length>1? 's':''}</button>
            </div>
          </div>
          <div className="bottomMargin" style={{display: 'flex', width: '700px'}}>
            { this.props.extraControls }
          </div>
        </div>
        <div className="PlotsOuterContainer" onMouseDown={this.onMouseDown}><div className="PlotsInnerContainer">
          {this.props.data.map((plotData, plotIdx) =>
            <div key={plotData.key} ref={(el) => {this.bottomEl = el;}} style={{position: 'relative', width: this.props.layout[plotIdx].width, margin: '0 auto'}}>
              { (plotData.plotData.length <= 0)?
                <p>Graph for watch ID(s) {plotData.key} will go here</p>
                  :
                <Fragment>
                  <Plot revision={this.state.frameCounter[plotData.key] || 0}
                        data={plotData.plotData.map((lineData) => ({ ...this.props.style, ...lineData }))}
                        layout={{...this.props.layout[plotIdx], ...this.xLimsFromLatestData(plotIdx)}}
                        config={this.props.plotConfig}
                        onRestyle={(e) => {this.props.onRestyle(e, plotIdx)}} onRelayout={(e) => {this.props.onRelayout(e, plotIdx)}}
                  />
                  { plotData.summary }
                </Fragment>
              }
            </div>
          )}
        </div></div>

        <p style={{whiteSpace: "pre-wrap"}}>{this.props.txtLog}</p>
      </div>
    );
  }
}

Visualization.defaultProps = {
  data: [],
  style: {},
  layout: [{
    width: 700,
    height: 400,
  }],
  plotConfig: {},
  extraControls: null,
  fps: 10,
  visType: "",
  scrollOnUpdate: false,
  SSEurl: "",
  txtLog: "",
  updateTxtLog: (txtLog) => {},
  onMessage: (e) => {},
  onRestyle: (e,i) => {},
  onRelayout: (e,i) => {},
  clearPlots: () => {}
};

export default Visualization;