
var Test = require('./testConfig.js');
var constants = require("./constants.js").Constants();
//var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 35;
  var config;
    // Watch contract events
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

  before('setup contract', async () => {
    config = await Test.Config(accounts);
	await config.flightSuretyData.authorizeContract(config.flightSuretyApp.address);

  });


  it('can register oracles', async () => {
    
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
	try{
	    for(let a=15; a<TEST_ORACLES_COUNT; a++) {
	      await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
	      let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
	      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
	    }
	} catch(e) {
		console.log(e);
	}
  });

  it('can request flight status', async () => {
    
    // ARRANGE
    let flight = constants.flights[0]; // Course number
    let timestamp = constants.getTimeStap(1);
	
	//Register flight
	let result = await config.flightSuretyApp.registerFlight(flight, timestamp, {from: config.owner});
	result.logs.forEach(l => {
		if(l.event === 'FlightRegistered') {
			assert.equal(l.args.flightId, 1);
			constants.flightIds[0] = l.args.flightId; // save flightIds for later testing. 
			console.log('Flight registered: ' + l.args.flightId);
		}
	});

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.owner, flight, timestamp);
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a=15; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          	let result = await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.owner, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] });
			result.logs.forEach(l => {
				console.log(l.event);
				console.log('FlightName: ' + l.args.flight);
				console.log('Flight Status: ' + l.args.status);
			});			
        }
        catch(e) {
          // Enable this when debugging
          //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp, e.message);
			assert.include(e.message, constants.errors.oracleRandomIndexNoMatch, 'Unexpected error: [' + e.message + ']');	
        }

      }
    }


  });


 
});
