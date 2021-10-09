// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    
    mapping(address => uint8) private authorizedContracts;			// Contract addresses from which this Data Contract is ONLY authorized to get request from.
    
    // Airlines Datavariables
    struct Airline {
    	uint256 id;
    	bool hasFunded;
    }
    uint256 private airlineCount = 0;
    mapping(address => Airline) airlines;

    // Flights Data variables
    struct Flight {
    	uint256 id;
    	bytes32 key;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
        string flight;
    }
    uint256 private flightCount = 0;
    mapping(uint256 => Flight) private flights;
    mapping(bytes32 => uint256) private flightKeyId; //Track flights if no id is available but airline, flight and timestamp

	// Insurance Data variables
	enum InsuranceStatus {Valid, Invalid, Applied}
	struct Insurance {
		uint256 id;
		InsuranceStatus status;
		uint256 flightId;
		uint256 payment;
		address passenger;
	}
	uint256 insuranceCount = 0;
	mapping(uint256 => Insurance) private insurances;
	mapping(uint256 => uint256[]) private flightInsurees;
	mapping(address => uint256) private passengerBalance;
	
    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() payable {
        contractOwner = msg.sender;
        
        // Add the creator of the contract (contractOwner) to the Airlines already registered and has funded
        airlineCount = airlineCount.add(1);
        Airline storage airline = airlines[contractOwner];
        airline.id = airlineCount;
        airline.hasFunded = true;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev Modifier that requires the Application Contract Address is authorized to request operation in Data Contract
    */
    modifier requireApplicationContract() {
        require(authorizedContracts[msg.sender] == 1, "Caller is not an authorized Application Contract");
        _;
    }
	
	modifier airlineNotRegistered(address _airline) {
		require(airlines[_airline].id == 0, "Airline has been registered in the app");
		_;
	}
	
	modifier airlineRegistered(address _airline) { 
		require(airlines[_airline].id > 0, "Airline has NOT been registered yet in the app");
		_;
	}
	
		
	modifier flightRegistered(address _airline, string memory _flight, uint256 _timestamp) {
		bytes32 key = getFlightKey(_airline, _flight, _timestamp);
		uint256 flightId = flightKeyId[key];
		require(flights[flightId].isRegistered, "Flight is not registered in the app");
		_;
	}

	modifier flightRegisteredById(uint256 flightId) {
		require(flights[flightId].isRegistered, "Flight is not registered in the app");
		_;
	}
	
	modifier flightNotRegistered(address _airline, string memory _flight, uint256 _timestamp) {
		bytes32 key = getFlightKey(_airline, _flight, _timestamp);
		uint256 flightId = flightKeyId[key];
		require(!flights[flightId].isRegistered, "Flight is already registered in the app");
		_;		
	}

	modifier insuranceValid(uint256 insuranceId) {
		require(insurances[insuranceId].status == InsuranceStatus.Valid, "Insurance is Invalid or credit applied");
		_;
	}
	
	modifier insuranceExist(uint256 insuranceId) {
		require(insurances[insuranceId].id > 0 , "Insurance is Invalid or Credited");
		_;
	}
	
	modifier passengerHasFunds(address passenger, uint256 amount) {
		require(passengerBalance[passenger] >= amount, "Passenger does not have the amount required");
		_;
	}    
	
	modifier contractHasFunds(uint256 amount) {
		require(address(this).balance > amount, "Passenger does not have the amount required");
		_;
	}    

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            external
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }
    
    /**
    * @dev Sets Application Contract Address from this Data Contract receives requests from 
    *
    */    
    function authorizeContract(address caller) 
    		external 	
    		requireContractOwner // Only contract owner can set the App Contract Address.
    {
    	authorizedContracts[caller] = 1;
    }

    /**
    * @dev Deletes the Application Contract and stops getting requests from it. 
    *
    */    
    function deauthorizeContract(address caller) 
    		external 	
    		requireContractOwner // Only contract owner can set the App Contract Address.
    {
    	delete authorizedContracts[caller];
    }



    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Create an airline
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function createAirline(address newAirline) external requireApplicationContract requireIsOperational
    	airlineNotRegistered(newAirline) 
    {
    	airlineCount = airlineCount.add(1);
    
    	Airline storage airline = airlines[newAirline];
    	airline.id = airlineCount;
    	airline.hasFunded = false;    	
    }
	
	function getAirline(address _airline) external view requireApplicationContract requireIsOperational
		airlineRegistered(_airline)
		returns(uint256 id, bool hasFunded) 
	{
		Airline memory airline = airlines[_airline];
		return (airline.id, airline.hasFunded); 	
	}	
	
	function getAirlineCount() external view requireApplicationContract requireIsOperational returns(uint256 airlineCount_) {
		airlineCount_ = airlineCount;
		return(airlineCount_); 
	}	
	
	function setAirlineHasFunded(address airline, bool hasFunded) external requireApplicationContract requireIsOperational 
		airlineRegistered(airline)
	{
		airlines[airline].hasFunded = hasFunded;		
	}
	
   /**
    * @dev Create a fligth
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function createFlight(address _airline, string memory _flight, uint256 _timestamp, uint8 _statusCode)	
    	external
        requireApplicationContract
        requireIsOperational
        flightNotRegistered(_airline, _flight, _timestamp)
        returns(uint256 flightId_)
    {
    	flightCount = flightCount.add(1);
		
		bytes32 key = getFlightKey(_airline, _flight, _timestamp);
    	
    	Flight storage flight = flights[flightCount]   ;
        flight.id = flightCount;
        flight.key = key;
        flight.isRegistered = true;
        flight.statusCode = _statusCode;
        flight.updatedTimestamp = _timestamp;        
        flight.airline = _airline;
        flight.flight = _flight;

		flightKeyId[key] = flightCount;
		
		flightId_ = flightCount;
		return(flightId_);
    }    

    function getFlightById(uint256 _flightId) external view	
        requireApplicationContract
        requireIsOperational
        flightRegisteredById(_flightId)
        returns(bool isRegistered_, uint8 statusCode_, uint256 updatedTimestamp_, address airline_, string memory flight_)
     {
     	isRegistered_ = flights[_flightId].isRegistered;
        statusCode_ = flights[_flightId].statusCode;
        updatedTimestamp_ = flights[_flightId].updatedTimestamp;        
        airline_ = flights[_flightId].airline;
        flight_ = flights[_flightId].flight;
        
        return (isRegistered_, statusCode_, updatedTimestamp_, airline_, flight_);
     }
    
    function setFlightStatus(uint256 flightId, uint8 statusCode) external	
        requireApplicationContract
        requireIsOperational
        flightRegisteredById(flightId)
	{
		flights[flightId].statusCode = statusCode;
	}

    function getFlightCount() external view returns(uint256 flightCount_) {
    	flightCount_ = flightCount;
    	return(flightCount_);
    }    
    
    function getFlightId(address _airline, string memory _flight, uint256 _timestamp) external view returns(uint256 flightId_) {
    	bytes32 key = getFlightKey(_airline, _flight, _timestamp);    	
    	flightId_ = flightKeyId[key];
    	
    	return(flightId_);
    }
    
    /**
    * @dev Buy insurance for a flight
    *
    */
	function createInsurance(address _passenger, uint256 _flightId, uint256 _payment) external
        requireApplicationContract
        requireIsOperational
	{
		insuranceCount = insuranceCount.add(1);
		Insurance storage insurance = insurances[insuranceCount];
		insurance.id = insuranceCount;
		insurance.status = InsuranceStatus.Valid;
		insurance.flightId = _flightId;
		insurance.payment = _payment;
		insurance.passenger = _passenger;
		
		flightInsurees[_flightId].push(insuranceCount);
	}
	
	function getInsuranceById(uint256 insuranceId) external view
        requireApplicationContract
        requireIsOperational
        returns(address passenger_, uint256 payment_, InsuranceStatus status_)
    {
		Insurance memory insurance = insurances[insuranceId];
		
	    passenger_ = insurance.passenger;
	    payment_ = insurance.payment;
	    status_	= insurance.status;

		return(passenger_, payment_, status_);    
    }
	
	function getInsurancesByFlightId(uint256 _flightId) external view
        requireApplicationContract
        requireIsOperational
        flightRegisteredById(_flightId)
        returns(uint256[] memory insurances_)
	{
		insurances_ = flightInsurees[_flightId];
		return(insurances_);	
	}	
	
    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(uint256 _insuranceId, uint256 amount) external
        requireApplicationContract
        requireIsOperational
		insuranceExist(_insuranceId)
		insuranceValid(_insuranceId)
    {
    	Insurance storage insurance = insurances[_insuranceId];
    	uint256 summed = insurance.payment.add(amount);
    	passengerBalance[insurance.passenger] = passengerBalance[insurance.passenger].add(summed);
	    insurances[_insuranceId].status = InsuranceStatus.Applied;
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address passenger, uint256 amount) external
        requireApplicationContract
        requireIsOperational   
        passengerHasFunds(passenger, amount) 	
        contractHasFunds(amount)
    {	
    	passengerBalance[passenger] = passengerBalance[passenger].sub(amount); 
    	payable(passenger).transfer(amount);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund
                            (   
                            )
                            public
                            payable
    {
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp)
        pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    fallback() 
                            external 
                            payable 
    {
        fund();
    }


}

