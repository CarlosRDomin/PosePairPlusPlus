import React, { Component } from 'react';
import RawSensorVisualization from "./RawSensorVisualization";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import './App.css';


// Helper functions for Arrays
/*Array.prototype.pushArray = function(arr) {
  this.push.apply(this, arr);
  return this;
};

Array.prototype.sum = function() {
  return this.reduce(function(sum, a) { return sum + a }, 0);
};

Array.prototype.mean = function() {
  return this.sum() / (this.length||1);
};*/

// Main App component
class App extends Component {

  render() {
    return (
      <div className="App flex-vert">
        <header className="App-header">
          <h1 className="App-title" style={{margin: 0}}>
            <img src="Einstein-white.png" width="50" style={{verticalAlign: 'top'}} alt="Einstein" />
            <img src="Visualization-white.png" width="55" style={{verticalAlign: 'middle'}} alt="Visualization" />{' '}
            PosePair++ Demo!
          </h1>
        </header>
        <Tabs className="flex-vert">
          <TabList>
            <Tab>Raw sensor data</Tab>
          </TabList>

          <TabPanel>
            <RawSensorVisualization lineStyle="" />
          </TabPanel>
        </Tabs>
      </div>
    );
  }
}

export default App;
