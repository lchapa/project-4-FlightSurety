const ORACLES_COUNT = 20;
const STATUS_CODES = [0,10,20,30,40,50]; 
const PROBABILITY_OF_DELAY = 0.8;        //About 80% of flights are delayed for testing purposes
const VALUE_TO_REGISTER = "1";

module.exports = class OracleSet {
	
	constructor(fligthSuretyApp, web3) {
		this.fligthSuretyApp = fligthSuretyApp;
		this.web3 = web3;
		this.oracles = [];
	}	
	
	async createOracles() {
		console.log(`Oracle set initializing with ${ORACLES_COUNT} oracles.`);
	
		let accounts = await this.web3.eth.getAccounts();
		let i = 1;
		while(i < ORACLES_COUNT + 1) {
			let account = accounts[10 + i];
			try {
				let result  = await this.fligthSuretyApp.registerOracle({from: account, value: this.web3.utils.toWei(VALUE_TO_REGISTER, "ether")});
				let indexes = null;
				result.logs.forEach(l => {
					if(l.event === 'OracleRegistered') {
						indexes = l.args.indexes;
					}
				});
				this.oracles.push(new Oracle(account, indexes));
				console.log(`Oracle ${i}th registered ${account} indexes ${indexes}.`);
				i++;
			} catch(e) {console.log(`Error (${i}) - ${e.message}`);}
		}
	}
	
	async getFlightStatus(request) {
		let i = 1;
		loopingOracles: for(let o of this.oracles) {
			console.log(`(${i}).- Finding index ${request.index} in ${o.indexes}`);
			if(o.findIndex(request.index)) {
				console.log(`Flight ${request.flight} submitted by oracle ${o.account}.`)
				let result = await this.fligthSuretyApp.submitOracleResponse(					
					request.index,
		            request.airline,
		            request.flight,
		            request.timestamp,
		            o.getFlightStatus(), 
		            {from : o.account});
				
				for(let log of result.logs) {
					if(log.event === 'OracleReport') {
						console.log(`Flight ${log.args.flight} report status so far: ${log.args.status}`);
					} else if(log.event === 'FlightStatusInfo') {
						console.log(`Flight ${log.args.flight} status Info: ${log.args.status}`);
						break loopingOracles;
					} else {
						console.log(`Flight ${request.flight} is wrong.`);
					}					
				}	
			} 
			i++;
		}
		
	}
	
}

class Oracle {
	constructor(account, indexes) {
		this.account = account;
		this.indexes = indexes;
	}
	
	getFlightStatus() {
		let ran1 = Math.random();
		
		if(ran1 > PROBABILITY_OF_DELAY) {
			let ran2 = Math.random() * 1000 % 6;			
			return ran2; // Randonmly any other status included Delayed 
		} else {
			return 20; // Certainly DELAYED for Airline about 80%
		}
	}
	
	findIndex(index) {
		for(let i of this.indexes) {
			if(index == i) {
				return true;
			}
		}
		return false;
	}
}




