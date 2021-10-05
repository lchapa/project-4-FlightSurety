//import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
//import Config from './config.json';



App = {
	web3Provider: null,
	config: null,
	network: "localhost",
	contracts: {},
	
	init: async function () {
	    /// Setup access to blockchain
	    return await App.initWeb3();
	},	
    initWeb3: async function () {
		$.getJSON('config.json', function(data) {
			App.config = data
	        App.web3Provider = new Web3.providers.HttpProvider(App.config[App.network].url);
		});
		return await App.initFlightSurety();
    },	
	initFlightSurety: async function() {
        /// JSONfy the smart contracts
        $.getJSON('FlightSuretyApp.json', function(data) {
            console.log('data',data);
            var FlightSuretyAppArtifact = data;
            App.contracts.FlightSuretyAppArtifact = TruffleContract(FlightSuretyAppArtifact);
            App.contracts.FlightSuretyAppArtifact.setProvider(App.web3Provider);
            App.getContractStatus(); 
        });
        return App.bindEvents();
    },
	bindEvents: function() {
    	$('#flightStatusBtn').on('click', App.getFlightStatus);
    },
	getContractStatus: async function() {
    	App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
            return instance.isOperational();
        }).then(function(result) {
            $("#display-wrapper").text('Contract is Operational: ' + result);
        }).catch(function(err) {
            console.log(err.message);
        });
    },
	getFlightStatus: async function() {    	
    	App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
    		return instance.fetchFlightStatus("0x963865f57804b38459dd4b2da2f760211a200438", $('#flightId').val(), 1000, {from: "0xfde1716debe4ef4712304e38572c56e74149c7cc"});
    	}).then(function(result){
    		$('#flightStatusLbl').text(result);
    	}).catch(function(err) {
            console.log(err.message);
        });
    }
};


$(function () {
    $(window).load(function () {
        App.init();
    });
});


/*export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }
}*/