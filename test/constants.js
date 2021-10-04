

var Constants = function() {
	
	return {
		airlinePayment: "10",
		buyInsurance: "1",
		currency: "ether",
		consensusGrantedProportion: 2,
		askForConsensusAfterCount: 3,
		insuranceMaxPrice: "1",
		sumInsuranceNum: 1,
		sumInsuranceDen: 2,
		
		errors: {
			airlineRegistered: 'Airline has NOT been registered yet in the app',
			requireContractOwner : 'Caller is not contract owner',
			requireApplicationContract: 'Caller is not an authorized Application Contract',
			airlineNotGranted: 'Guest airline has already consent registration to new airline',
			airlineFunded: 'Airline has not yet funded to App, then it cannot consent registration to new airlines',
			flightTimeValid: 'Flight has been departed',	
			flightRegisteredById: 'Flight is not registered in the app',
			flightStatusToInsurance: 'Flight is not available for insurance',
			oracleRandomIndexNoMatch: 'Flight or timestamp do not match oracle request'
		},
		
		flights: ['AEROMEXICO 40','AVIANCA 18','ARGENTINA 03'],
		flightIds: [],
		
		getTimeStap: (addDays) => {
			return Math.ceil(new Date().valueOf() / 1000) + (addDays * 24 * 60 * 60); 
		},
		isEqual: (n1, n2) => {
			let tolerance = Number(1000000000000000);
			return n1.minus(n2).abs().lte(tolerance);
		}
	};
	
}

module.exports = {
	Constants : Constants
}