// MQTT Light Bulb Accessory plugin for Homebridge (based on MQTT Switch Accessory plugin for HomeBridge)
//
// Remember to add accessory to config.json. Example:
// "accessories": [
//     {
//         "accessory": "mqttlightbulb",
//         "name": "PUT THE NAME OF YOUR SWITCH HERE",
//         "url": "PUT URL OF THE BROKER HERE",
//         "username": "PUT USERNAME OF THE BROKER HERE",
//         "password": "PUT PASSWORD OF THE BROKER HERE"
//         "caption": "PUT THE LABEL OF YOUR SWITCH HERE",
//         "topics": {
//             "getOn":  "MQTT TOPIC FOR THE GETTING THE STATUS OF YOUR SWITCH HERE (may be published to homebridge to notify of state)",
//             "setOn":  "MQTT TOPIC FOR THE SETTING THE STATUS OF YOUR SWITCH HERE (published by homebridge)",
//             "getBrightness": "MQTT GET BRIGHTNESS TOPIC (optional)",
//             "setBrightness": "MQTT SET BRIGHTNESS TOPIC (optional)",
//             "getHue": "MQTT GET HUE TOPIC (optional)",
//             "setHue": "MQTT SET HUE TOPIC (optional)",
//             "getSaturation": "MQTT GET SATURATION TOPIC (optional)",
//             "setSaturation": "MQTT SET SATURATION TOPIC (optional)",
//         },
//         "onValue": "OPTIONALLY PUT THE VALUE THAT MEANS ON HERE (DEFAULT true)",
//         "offValue": "OPTIONALLY PUT THE VALUE THAT MEANS OFF HERE (DEFAULT false)",
//         "integerValue": "OPTIONALLY SET THIS TRUE TO USE 1/0 AS VALUES"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict';

var Service, Characteristic;
var mqtt = require("mqtt");


function mqttlightbulbAccessory(log, config) {
    this.log  = log;
    this.name = config["name"];
    this.url = config["url"];
    this.client_Id = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    this.options = {
      keepalive: 10,
      clientId: this.client_Id,
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    will: {
      topic: 'WillMsg',
      payload: 'Connection Closed abnormally..!',
      qos: 0,
      retain: false
    },
      username: config["username"],
      password: config["password"],
      rejectUnauthorized: false
  };
  this.caption = config["caption"];
  this.topics = config["topics"];
  this.onValue = (config["onValue"] !== undefined) ? config["onValue"]: "true";
  this.offValue = (config["offValue"] !== undefined) ? config["offValue"]: "false";
  if (config["integerValue"]) {
    this.onValue = "1";
    this.offValue = "0";
  }
  this.on = false;
  this.brightness = 0;
  this.hue = 0;
  this.saturation = 0;

  this.service = new Service.Lightbulb(this.name);
  this.service
    .getCharacteristic(Characteristic.On)
    .on('get', this.getStatus.bind(this))
    .on('set', this.setStatus.bind(this));

  // brightness/hue/saturation characters are optional - only applied if set topics configured
  if (this.topics.setBrightness) {
    this.service
      .getCharacteristic(Characteristic.Brightness)
      .on('get', this.getBrightness.bind(this))
      .on('set', this.setBrightness.bind(this));
  }
  if (this.topics.setHue) {
    this.service
      .getCharacteristic(Characteristic.Hue)
      .on('get', this.getHue.bind(this))
      .on('set', this.setHue.bind(this));
  }
  if (this.topics.setSaturation) {
    this.service
      .getCharacteristic(Characteristic.Saturation)
      .on('get', this.getSaturation.bind(this))
      .on('set', this.setSaturation.bind(this));
  }

  // connect to MQTT broker
  this.client = mqtt.connect(this.url, this.options);
  var that = this;
  this.client.on('error', function (err) {
    that.log('Error event on MQTT:', err);
  });

  this.client.on('message', function (topic, message) {
    // console.log(message.toString(), topic);

    if (topic == that.topics.getOn) {
      var status = message.toString();
      that.on = (status == that.onValue ? true : false);
      that.service.getCharacteristic(Characteristic.On).setValue(that.on, undefined, 'fromSetValue');
    }

    if (topic == that.topics.getBrightness) {
      var val = parseInt(message.toString());
      that.brightness = val;
      that.service.getCharacteristic(Characteristic.Brightness).setValue(that.brightness, undefined, 'fromSetValue');
    }

    if (topic == that.topics.getHue) {
      var val = parseInt(message.toString());
      that.hue = val;
      that.service.getCharacteristic(Characteristic.Hue).setValue(that.hue, undefined, 'fromSetValue');
    }

    if (topic == that.topics.getSaturation) {
      var val = parseInt(message.toString());
      that.saturation = val;
      that.service.getCharacteristic(Characteristic.Brightness).setValue(that.saturation, undefined, 'fromSetValue');
    }
  });

  // Subscibe to get topics
  this.client.subscribe(this.topics.getOn);

  if (this.topics.getBrightness) {
    this.client.subscribe(this.topics.getBrightness);
  }
  if (this.topics.getHue) {
    this.client.subscribe(this.topics.getHue);
  }
  if (this.topics.getSaturation) {
    this.client.subscribe(this.topics.getSaturation);
  }
}

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-mqttlightbulb", "mqttlightbulb", mqttlightbulbAccessory);
}

mqttlightbulbAccessory.prototype.getStatus = function(callback) {
    callback(null, this.on);
}

mqttlightbulbAccessory.prototype.setStatus = function(status, callback, context) {
  if(context !== 'fromSetValue') {
    this.on = status;
    this.client.publish(this.topics.setOn, status ? this.onValue : this.offValue);
  }
  callback();
}

mqttlightbulbAccessory.prototype.getBrightness = function(callback) {
    callback(null, this.brightness);
}

mqttlightbulbAccessory.prototype.setBrightness = function(brightness, callback, context) {
  if(context !== 'fromSetValue') {
    this.brightness = brightness;
    // console.log("Brightness:",this.brightness);
    if (this.topics.setBrightness) {
      this.client.publish(this.topics.setBrightness, this.brightness.toString());
    }
  }
  callback();
}

mqttlightbulbAccessory.prototype.getHue = function(callback) {
    callback(null, this.hue);
}

mqttlightbulbAccessory.prototype.setHue = function(hue, callback, context) {
  if(context !== 'fromSetValue') {
    this.hue = hue;
    // console.log("Hue:",this.hue);
    if (this.topics.setHue) {
      this.client.publish(this.topics.setHue, this.hue.toString());
    }
  }
  callback();
}

mqttlightbulbAccessory.prototype.getSaturation = function(callback) {
    callback(null, this.saturation);
}

mqttlightbulbAccessory.prototype.setSaturation = function(saturation, callback, context) {
  if(context !== 'fromSetValue') {
    this.saturation = saturation;
    // console.log("Saturation:",this.saturation);
    if (this.topics.setSaturation) {
      this.client.publish(this.topics.setSaturation, this.saturation.toString());
    }
  }
  callback();
}

mqttlightbulbAccessory.prototype.getServices = function() {
  return [this.service];
}
