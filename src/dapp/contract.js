let timestamp = new Date().valueOf();
const airlinesAvailable = 4; 
const airlines = [
	{
		name: "Avianca", 
		account: null
	},{
		name: "Aeromexico",
		account: null
	},{
		name: "Aereolineas Argentinas",
		account: null
	}];

App = {
	web3Provider: null,
	config: null,
	network: "localhost",
	ganache: 'ws://127.0.0.1:8545',
	contracts: {},
	accounts: null,
	passenger: null,
	
	init: async function () {
	    /// Setup access to blockchain
	    return await App.initWeb3();
	},	
    initWeb3: async function () {
		await $.getJSON('config.json', function(data) {
			App.config = data;
	        App.web3Provider = new Web3.providers.HttpProvider(App.config[App.network].url);
	    	App.web3 = new Web3(App.web3Provider);
		});
		
		return App.initAccounts();
    },
    initAccounts: async function() {
    	App.accounts = await App.web3.eth.getAccounts();
    	App.web3.eth.defaultAccount = App.accounts[0];
    	App.passenger = App.accounts[airlines.length + airlinesAvailable];
    	App.getBalance();
		
    	return App.initFlightSurety();	
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
        App.bindEvents();
    },
	bindEvents: function() {
    	$('#flightRegisterBtn').on('click', App.registerFlight);    	
    	$('#buyInsuranceBtn').on('click', App.buyInsurance);    	
    	$('#flightStatusRequestBtn').on('click', App.requireFlightStatus);
    	$('#flightInformationBtn').on('click', App.getflightInformation);
    	$('#myBalanceBtn').on('click', App.getBalance);
    	$('#withdrawlBtn').on('click', App.withdrawl);
    	
    },
	getContractStatus: async function() {
    	App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
            return instance.isOperational();
        }).then(function(result) {
            $("#display-wrapper").text('Contract is Operational: ' + result);
            if(result == true) {
            	App.fillAirlines();
            }
        }).catch(function(err) {
            console.log(err.message);
        });
    },
	fillAirlines: async function() {    
    	for(let i = 0; i < airlines.length; i++) {
    		airlines[i].account = App.accounts[i + airlinesAvailable];
    		await App.registerAirline(airlines[i].account);  
    		await App.fundAirline(airlines[i].account);
    		$('#airlines').append($('<option>', {
    		    value: airlines[i].account,
    		    text: airlines[i].name
    		}));			
    	}
    },
	registerAirline: async(airline) => {
		App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
			return instance.registerAirline(airline, {from: App.accounts[0]});
		}).then(function(result) {
			console.log(result.logs[0].event);
		}).catch(function(err) {
			console.log(err);
		});
	},
	fundAirline: async(airline) => {
		App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
			return instance.fundAirline({from: airline, value: Web3.utils.toWei("10", "ether")});
		}).then(function(result) {
			console.log(result.logs[0].event);
		}).catch(function(err) {
			console.log(err);
		});		
	},	
	registerFlight: async() => {
		let flight = $('#flightId').val();
		let airline = $('#airlines').val();
		App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
			return instance.registerFlight(flight, timestamp, {from: airline})
		}).then(function(result) {
			console.log(result.logs[0].event);
			
			$('#flights').append($('<option>', {
    		    value: result.logs[0].args.flightId,
    		    text: flight
    		}));		
			
			$('#flightRegiterLbl').text('Flight Registration: ' + result.logs[0].event);
		}).catch(function(e) {
			console.log(e);
		});
	},
	requireFlightStatus: async function() {  
		let airline = $('#airlines').val();
		let flight = $('#flightId').val();
		
    	App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
    		return instance.fetchFlightStatus(airline, flight, timestamp, {from: airline});
    	}).then(function(result){
			console.log(result.logs[0].event);    		
    		$('#flightStatusRequestLbl').text('Flight Status request: ' + result.logs[0].event);
    	}).catch(function(err) {
            console.log(err.message);
        });
    }, 
	buyInsurance: async function() {
    	let flightId = $('#flights').val();
    	App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
    		return instance.buyInsurance(flightId, {from: App.passenger, value: Web3.utils.toWei("1", "ether")})
    	}).then(function(result){
    		console.log(result.logs[0].event);
    		$('#buyInsuranceLbl').text('Result of you insurance: ' + result.logs[0].event);
    	}).catch(function(err) {
    		console.log(err.message);
    	});
    },
	getflightInformation: async function() {
    	let flightId = $('#flights').val();
    	App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
    		return instance.getFlightInfo(flightId)
    	}).then(function(result){
    		console.log(JSON.stringify(result.statusCode_));
    		if(result.statusCode_ == 20) {
    			$('#flightInformationLbl').text('Flight delayed due to airline, consult balance');
    		} else {
    			$('#flightInformationLbl').text('Flight Status: ' + result.statusCode_);
    		}
    		
    	}).catch(function(err) {
    		console.log(err.message);
    	});    	
    }, 	
	withdrawl: async function() {
    	App.contracts.FlightSuretyAppArtifact.deployed().then(function(instance) {
    		return instance.withdrawal(Web3.utils.toWei("1", "ether"), {from: App.passenger});
    	}).then(function(result){
    		console.log(result);
    	}).catch(function(err) {
    		console.log(err.message);
    	});    	
    	return App.getBalance();
    },
	getBalance: async function() {
    	let balance = Web3.utils.fromWei(await App.web3.eth.getBalance(App.passenger), "ether");
    	$('#myBalanceLbl').text("Passenger current balance (ETH): " + balance);    	
    }
};


$(function () {
    $(window).load(function () {
        App.init();        
    });
});