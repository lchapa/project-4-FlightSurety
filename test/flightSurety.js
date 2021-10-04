
var Test = require('./testConfig.js');
var constants = require("./constants.js").Constants();
var BigNumber = require('bignumber.js');



contract('Flight Surety Tests', async (accounts) => {
  	var config;
  	before('setup contract', async () => {
    	config = await Test.Config(accounts);
    	await config.flightSuretyData.authorizeContract(config.flightSuretyApp.address);
 		
	    var minAirlineFund = Number(await config.flightSuretyApp.getMinAirlineFund());  //10 ether
		assert.equal(web3.utils.toWei(constants.airlinePayment, constants.currency), minAirlineFund);
	    var minAirlineCountNoConsensus = Number(await config.flightSuretyApp.getMinAirlineCountNoConsensus()); //3
		assert.equal(constants.askForConsensusAfterCount, minAirlineCountNoConsensus);
	    var consensusProportion  = Number(await config.flightSuretyApp.getConsensusProportion()); //2
		assert.equal(constants.consensusGrantedProportion, consensusProportion);
	    var insuranceMaxPrice  = Number(await config.flightSuretyApp.getInsuranceMaxPrice()); //2
		assert.equal(web3.utils.toWei(constants.insuranceMaxPrice, constants.currency), insuranceMaxPrice);
		var sumInsuranceNum = Number(await config.flightSuretyApp.getSumInsuranceNum());
		assert.equal(constants.sumInsuranceNum, sumInsuranceNum);
		var sumInsuranceDen = Number(await config.flightSuretyApp.getSumInsuranceDen());
		assert.equal(constants.sumInsuranceDen, sumInsuranceDen);
  	});

  	it(`(multiparty) has correct initial isOperational() value`, async function () {

    	// Get operating status
	    let statusApp =  await config.flightSuretyApp.isOperational.call();
	    let statusData = await config.flightSuretyData.isOperational.call();
	    assert.equal(statusApp, true, "Incorrect initial operating status value in Application Contract");
	    assert.equal(statusData, true, "Incorrect initial operating status value in Data Contract");
  	});

  	it(`(multiparty) test Operational feature`, async function () {
  		// Ensure that access is denied for non-Contract Owner account
		try {
			await config.flightSuretyData.setOperatingStatus(false, { from: accounts[2] });
  		}
  		catch(e) {
			assert.include(e.message, constants.errors.requireContractOwner, 'Unexpected error: [' + e.message + ']');
  		}            

	  	// Ensure that access is allowed for Contract Owner account
	  	try {
	      	await config.flightSuretyData.setOperatingStatus(false, {from: config.owner});
		  	var isOperationalApp = await config.flightSuretyApp.isOperational.call();
		  	var isOperationalData = await config.flightSuretyData.isOperational.call();
		  	assert.equal(isOperationalApp, isOperationalData, "Both Contracts must be unable to operate");
	  	}
	  	catch(e) {
    		assert.isNotOk('Should NOT catch this msg.sender is the Owner: ' + e.message)
		}
  	// Set isOperational == true for next test. 
	await config.flightSuretyData.setOperatingStatus(true, {from: config.owner});
	});

	it(`(multiparty) test App Contract authorization in Data Contract feature`, async function () {
		// Test Application Contract Deauthorized to request Data Contract.
		await config.flightSuretyData.deauthorizeContract(config.flightSuretyApp.address);
		try{
			await config.flightSuretyApp.registerAirline(accounts[2], {from: config.owner});
		} catch(e) {
			assert.include(e.message, constants.errors.requireApplicationContract, 'Unexpected error: [' + e.message + ']');
		}
		
		// Test Application Contract Authorized to request Data Contract.
		await config.flightSuretyData.authorizeContract(config.flightSuretyApp.address);
		  	var isOperationalApp = await config.flightSuretyApp.isOperational.call();
		  	assert.equal(isOperationalApp, true, "App Contract must be operable again to keep going");
		
	})

	it(`(airline) test App Contract register Airline`, async function () {
		// There is already 1 airline registered at deployment: Owner.
		
		// Try to register a new Airline from a non-registered airline.
		try{
			await config.flightSuretyApp.registerAirline(accounts[1], {from: accounts[2]});	
		} catch(e) {
			assert.include(e.message, constants.errors.airlineRegistered, 'Unexpected error: [' + e.message + ']');
		}
		
		//2nd and 3rd airlines can be registered without consensus
		var newAirlines = [accounts[1], accounts[2]];		
		try {
			newAirlines.forEach( async (airline) => {
				var result  = await config.flightSuretyApp.registerAirline(airline, {from: config.owner});
				result.logs.forEach(l => {
					if(l.event === 'AirlineRegistered') {
						assert.equal(l.args.airline, airline);	
						console.log('Event: ' + l.event + ' - Airline: ' + l.args.airline);
					}
				});
			});	
		} catch(e) {
			//console.log("Error:" + e.message)
			assert.isNotOk("No exception at registering 2 more new airlines, besides de Owner one");
		}		
        
		// 4th airline registration cannot be registered without consensus
		var oneMoreAirline = accounts[3];
		try {
			var result = await config.flightSuretyApp.registerAirline(oneMoreAirline, {from: config.owner}); 
			result.logs.forEach(l => {
				if(l.event === 'GrantConsensus') {
					assert.isFalse(l.args.registered, 'Registered flag is false, no consensus has been reached yet');
					assert.isTrue(l.args.consentCount > 0, 'At least one airline has granted registration to the app: this');
					assert.isTrue(l.args.airlineCount >= 3, 'At least 3 airlines are registered so far, next ones need consensus');
					console.log('Event: ' + l.event + ' - Airline Registered: ' + l.args.registered + ' - count: ' + l.args.consentCount + ' / ' + l.args.airlineCount);
				}
			});
		} catch(e) {
			//console.log("Error:" + e.message)
			assert.isNotOk("No exception at registration one more airline that needs consensus");			
		}

		// 4th airline registration - same registered and funded ariline cannot grant registration to new airlines, only once
		try {
			await config.flightSuretyApp.registerAirline(oneMoreAirline, {from: config.owner}); 
		} catch(e) {
			assert.include(e.message, constants.errors.airlineNotGranted, 'Unexpected error: [' + e.message + ']');
		}	

		// 4th airline registration cannot be registered without consensus and granted airline has funded to the app 10 ether
		// the from address is an airline, registered but not funded so an exception will be launched by the blockchain
		try {
			await config.flightSuretyApp.registerAirline(oneMoreAirline, {from: newAirlines[0]}); 
		} catch(e) {
			assert.include(e.message, constants.errors.airlineFunded, 'Unexpected error: [' + e.message + ']');			
		}	
		
		// 4th has already one consent, let's give one more for fully registration
		// But first, any other registered airline must pay funds to the app.
		try {
			var appBalanceBeforeFunding = Number(await web3.eth.getBalance(config.flightSuretyData.address));	
			for(var i = 0; i < newAirlines.length; i++) 
			{
				var airline = newAirlines[i];
				var resultFunds = await config.flightSuretyApp.fundAirline({from: airline,        value: web3.utils.toWei(constants.airlinePayment, constants.currency)});
				resultFunds.logs.forEach(l => {
					if(l.event === 'AirlineHasFunded') {
						assert.equal(l.args.airline, airline, 'Airline that has funded to the app is not the same in the event emitted');		
						assert.equal(l.args.amount, web3.utils.toWei(constants.airlinePayment, constants.currency), 'Amount airline has funded to the app is not the emitted in event');
						console.log('Event: ' + l.event + ' - Airline Funded: ' + l.args.airline + ' - amount: ' + l.args.airline);
					}
				});
	
				appBalanceBeforeFunding = appBalanceBeforeFunding + Number(web3.utils.toWei(constants.airlinePayment, constants.currency));
				var newBalanceAfterFunding = Number(await web3.eth.getBalance(config.flightSuretyData.address));
				assert.equal(appBalanceBeforeFunding, newBalanceAfterFunding, 'Data Contract must have increased its value');	
				
				var resultRegister = await config.flightSuretyApp.registerAirline(oneMoreAirline, {from: airline}); 
				resultRegister.logs.forEach(l => {
					if(l.event === 'GrantConsensus') {
						assert.isTrue(l.args.consentCount > 0, 'At least one airline has granted registration to the app: this');
						assert.isTrue(l.args.airlineCount >= 3, 'At least 3 airlines are registered so far, next ones need consensus');
						console.log('Event: ' + l.event + ' - Airline Registered: ' + l.args.registered + ' - count: ' + l.args.consentCount + ' / ' + l.args.airlineCount);
					} else if(l.event === 'AirlineRegistered') {
						assert.equal(l.args.airline, oneMoreAirline, "Not registered after consensus reached");
						console.log('Event: ' + l.event + ' - Airline: ' + l.args.airline);					}
				});
			}
			// 4th airline not funded for register flight testing purposes
			/*var resulFunded = await config.flightSuretyApp.fundAirline({from:oneMoreAirline, value:web3.utils.toWei(constants.airlinePayment, constants.currency)});
			resulFunded.logs.forEach(l => {
				if(l.event === 'AirlineFunded') {
					assert.equal(l.args.airline, onwMoreAirline, 'Airline that has funded to the app is not the same in the event emitted');
				}
			});*/
		} catch(e) {
			console.log("Error: " + e);
			assert.isNotOk('For second and third airlines to fund paymento to app no exception is expected');
		}
		
		//So far 4 Airlines has been registered
		var airlinesRegisteredCount = 0;
		for(var account of accounts) {
			try {
				var airlineRegistered = await config.flightSuretyApp.getAirline(account);	
				airlinesRegisteredCount = airlinesRegisteredCount + 1;
				assert.equal(airlineRegistered.airline_, account, 'Airline not registered');
				assert.equal(airlineRegistered.id_, airlinesRegisteredCount, 'AirlineCount does not match');
				//assert.equal(airlineRegistered.hasFunded_, true, 'Airline has to be funded');
			} catch(e) {
				assert.include(e.message, constants.errors.airlineRegistered, 'Unexpected error: [' + e.message + ']');
				break;
			}			
		}
		assert.equal(airlinesRegisteredCount, 4, '4 Airlines has been registered at this point');
  	});
 
	it('(flight) test registration flight to be monitored', async() => {
		
		try {
			await config.flightSuretyApp.registerFlight(constants.flights[0], constants.getTimeStap(1), {from: accounts[4]});		
		}
		catch(e) {
			assert.include(e.message, constants.errors.airlineRegistered, 'Unexpected error: [' + e.message + ']');
		}
		
		try {
			await config.flightSuretyApp.registerFlight(constants.flights[0], constants.getTimeStap(1), {from: accounts[3]});	
		}
		catch(e) {
			assert.include(e.message, constants.errors.airlineFunded, 'Unexpected error: [' + e.message + ']');
		}
		
		try {
			await config.flightSuretyApp.registerFlight(constants.flights[0], constants.getTimeStap(-1), {from: config.owner});	
		}
		catch(e) {
			assert.include(e.message, constants.errors.flightTimeValid, 'Unexpected error: [' + e.message + ']');
		}
		
		try {
			let accountIndex = 0;
			for(let flight of constants.flights) {
				let timestamp = constants.getTimeStap(1);
				let result = await config.flightSuretyApp.registerFlight(flight, timestamp, {from: accounts[accountIndex]});
				result.logs.forEach(l => {
					if(l.event === 'FlightRegistered') {
						assert.equal(l.args.flightId, accountIndex + 1);
						constants.flightIds[accountIndex] = l.args.flightId; // save flightIds for later testing. 
						console.log('Event: ' + l.event + ' - FlightID: ' + l.args.flightId);
					}
				});
				accountIndex = accountIndex + 1;		
			}
		} catch(e) {
			console.log("Error: " + e);
			assert.isNotOk('Flights registered without issues');
		}
	});
	
	it('(passengers) buy insurance and pay up to 1 ether per flight', async() => {
		//We get 3 passengers for 3 available fligths in the constants object
		let passengers = [accounts[10], accounts[11], accounts[12]];
		//Passenger to test invalid scenarios
		let passengerInvalid = accounts[13];
		
		try {
			await config.flightSuretyApp.buyInsurance(100, {from: passengerInvalid, value: web3.utils.toWei(constants.buyInsurance, constants.currency)});
		} catch(e) {
			assert.include(e.message, constants.errors.flightRegisteredById, 'Unexpected error: [' + e.message + ']');	
		}
			 
		try {			
			var flightIndex = 0;
			for(var passenger of passengers) {
				
				var passengerBalance = Number(await web3.eth.getBalance(passenger));
				var result = await config.flightSuretyApp.buyInsurance(constants.flightIds[flightIndex], {from: passenger, value: web3.utils.toWei(constants.buyInsurance, constants.currency)});
				result.logs.forEach(l => {
					if(l.event === 'InsuranceValid') {
						assert.equal(passenger, l.args.passenger, 'Passenger is not the one who bought the insurance');
						assert.isTrue(constants.flightIds[flightIndex].eq(l.args.flightId), 'Flight is not the one passenger has bought');
						console.log('Event: ' + l.event + ' - Passenger: ' + l.args.passenger + ' - FlightId: ' + l.args.flightId);
					}				
				});
				var passengerNewBalance = Number(await web3.eth.getBalance(passenger));
				var value1 = passengerBalance - Number(web3.utils.toWei(constants.buyInsurance, constants.currency));
				assert.isTrue(constants.isEqual(new BigNumber(passengerNewBalance), new BigNumber(value1)), 'Passenger incorrect balance after buying insurance');
			}
		} catch(e) {
			console.log("Error: " + e);
			assert.isNotOk('Passengers can buy these flights without issues without issues');
		}
	});
});
