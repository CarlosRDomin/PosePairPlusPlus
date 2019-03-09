import axios from "axios/index";
import constants from "./constants";


export default class VirtualSpace {

  constructor() {
    this.url = constants.virtualSpaceUrl;
  }

  getItems(params){
    return axios.get(this.url+'/api/items', {
      params: params
    })
  }

  getModComponents(){
    return axios.get(this.url+'/api/mod_components');
  }
}