var FlightSuretyApp = require('../../build/contracts/FlightSuretyApp.json');
var Config = require('./config.json');
var Web3 = require('Web3');
var TruffleContract = require('@truffle/contract');

var OracleSet = require('./OracleSet.js');

console.log("Starting up daemon for listening Solidity events");

Daemon = {		
		web3Provider: null,
		web3: null,
		config: Config['localhost'],
		contracts: {},
		instance: null,
		oracleSet: null,

		init: async() => {
			return await Daemon.initWeb3();
		},	
	    initWeb3: async() => {			
	        Daemon.web3Provider = new Web3.providers.WebsocketProvider(Daemon.config.url.replace('http', 'ws'));
	        return await Daemon.initFlightSurety();
	    },	
		initFlightSurety: async() => {
            Daemon.contracts.flightSuretyApp = TruffleContract(FlightSuretyApp);
            Daemon.contracts.flightSuretyApp.setProvider(Daemon.web3Provider);

            return Daemon.initInstance();
	    },
		initInstance: async() => {
			Daemon.instance = await Daemon.contracts.flightSuretyApp.at(Daemon.config.appAddress);
			return Daemon.createOracleSet(); 
		},
		createOracleSet: async() => {
			Daemon.web3 = new Web3(Daemon.web3Provider);
			Daemon.oracleSet = new OracleSet(Daemon.instance, Daemon.web3);
			await Daemon.oracleSet.createOracles();
			
			return Daemon.bindEventListener(); 
		},
		bindEventListener: async() => {
			console.log(`Binding Event Listener to this daemon.`);
			Daemon.instance.OracleRequest(async(err, event) => {
				if(err) console.log(err);
				
				let request = {
					index : event.returnValues.index,
					airline: event.returnValues.airline,
					flight : event.returnValues.flight,
					timestamp: event.returnValues.timestamp
				};
				console.log(`Flight ${event.returnValues.flight} to get status.`)
				await Daemon.oracleSet.getFlightStatus(request);
			});
			return Daemon.ready();
		},
		ready: () => {
			console.log(`Daemon listening for OracleRequests...`);
		}
}

Daemon.init();



/*

function (params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = {};
    }

    // As callback
    if (callback !== undefined) {
      const intermediary = function (err, e) {
        if (err) return callback(err);
        if (!dedupe(e.id)) return;
        callback(null, decode.call(constructor, e, true)[0]);
      };

      return constructor
        .detectNetwork()
        .then(() => fn.call(constructor.events, params, intermediary));
    }

    // As EventEmitter
    const emitter = new EventEmitter();

    constructor.detectNetwork().then(() => {
      const event = fn(params);

      event.on(
        "data",
        e =>
          dedupe(e.id) &&
          emitter.emit("data", decode.call(constructor, e, true)[0])
      );
      event.on(
        "changed",
        e =>
          dedupe(e.id) &&
          emitter.emit("changed", decode.call(constructor, e, true)[0])
      );
      event.on("error", e => emitter.emit("error", e));
    });

    return emitter;
  }

*/


