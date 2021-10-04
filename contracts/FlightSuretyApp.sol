// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)
    using EnumerableSet for EnumerableSet.AddressSet;
    
    
    /********************************************************************************************/
    /*                                       Interface to Data Contract                         */
    /********************************************************************************************/    
    IFlightSuretyData model;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_CREATED = 1; 
    uint8 private constant STATUS_CODE_UNKNOWN = 0; 
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;
    
    //TODO: make these configurable variables from App
    uint256 private minAirlineFund = 10 ether;			//Payment each registered airline must do to grant others registration
    uint8 private minAirlineCountNoConsensus = 3; 		//Free of consensus airlines registration 
    uint8 private consensusProportion  = 2; 			//Airlines granted registration MULTIPLY by RATE > Total airlines registered
    uint256 private insuranceMaxPrice = 1 ether;        //Max price for a passenger to buy flight insurance 
    uint8 private sumInsuranceNum = 1; 					//Payment plus the percentage per insurance amount. (1/2 = 50% - 1 + 0.5 = 1.5 ether)
    uint8 private sumInsuranceDen = 2;

    address private contractOwner;          			// Account used to deploy contract

	
	//Data variables for consensus on new airline registration
	mapping(address => EnumerableSet.AddressSet) consensus;

  	// Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;
 
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
        require(model.isOperational(), "Contract is currently not operational");  
        _; 
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

	// Define a modifier that checks if the paid amount is sufficient to cover the price
  	modifier fundEnough() { 
    	require(msg.value >= minAirlineFund, "No enough value to fund the airline"); 
    	_;
  	}

	// Define a modifier that checks the price and refunds the remaining balance
	modifier checkValue() {
	    _;
	    uint256 amountToReturn = msg.value.sub(minAirlineFund);
	    payable(msg.sender).transfer(amountToReturn);
    }


	// Check airline is registered in DataContract
	modifier airlineRegistered(address airline) {
		(uint256 id, bool hasFunded) = model.getAirline(airline);
		_;
	}
	
	// Check airline is registered in DataContract	
    modifier airlineFunded(address airline) {
		(uint256 id, bool hasFunded) = model.getAirline(airline);
		require(hasFunded == true, "Airline has not yet funded to App, then it cannot consent registration to new airlines");
		_;
    }
    	
	// Check airline is registered in DataContract    	
    modifier airlineNotGranted(address newAirline, address guestAirline) {
    	require(!consensus[newAirline].contains(guestAirline), "Guest airline has already consent registration to new airline");
    	_;
    }    	
    
    modifier flightTimeValid(uint256 timestamp) {
    	require(timestamp > block.timestamp, "Flight has been departed");
    	_;
    }
	
	modifier flightRegistered(uint256 flightId) {
		(bool isRegistered_, uint8 statusCode_, uint256 updatedTimestamp_, address airline_, string memory flight_) = model.getFlightById(flightId);
		_;
	}
	
	modifier flightStatusToInsurance(uint256 flightId) {
		(bool isRegistered_, uint8 statusCode_, uint256 updatedTimestamp_, address airline_, string memory flight_) = model.getFlightById(flightId);
		require(statusCode_ == STATUS_CODE_CREATED, "Flight is not available for insurance");
		_;
	
	}
	
	modifier verifyMaxInsurancePrice() {
	    _;
	    uint256 amountToReturn = msg.value.sub(insuranceMaxPrice);
	    payable(msg.sender).transfer(amountToReturn);		
	}
	
	
	
	
    /********************************************************************************************/
    /*                                       EVENTS                                             */
    /********************************************************************************************/
	
	event GrantConsensus(bool registered, uint256 consentCount, uint256 airlineCount); 
	event AirlineRegistered(address airline);				
	event AirlineFunded(address airline);
	event AirlineHasFunded(address airline, uint256 amount);
	event FlightRegistered(uint256 flightId);
	event InsuranceValid(address passenger, uint256 flightId);

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor (address dataContract) {
        contractOwner = msg.sender;
        model = IFlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /*                                       GETTERs and SETTERs                                */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return model.isOperational();
    }
	
	function getMinAirlineFund() public view returns (uint256 minAirlineFund_) {
		minAirlineFund_ = minAirlineFund; 
		return minAirlineFund_; 
	}
	
	function setMinAirlineFund(uint256 _minAirlineFund) public {
		minAirlineFund = _minAirlineFund;
	}
	
	function getMinAirlineCountNoConsensus() public view returns (uint8 minAirlineCountNoConsensus_) {
		minAirlineCountNoConsensus_ = minAirlineCountNoConsensus;
		return minAirlineCountNoConsensus_;
	}
	
	function setMinAirlineCountNoConsensus(uint8 _minAirlineCountNoConsensus) public {
		minAirlineCountNoConsensus = _minAirlineCountNoConsensus;
	}
	
	function getConsensusProportion() public view returns(uint8 consensusProportion_) {
		consensusProportion_ = consensusProportion;
		return consensusProportion_;
	}
	
	function setConsensusProportion(uint8 _consensusProportion) public {
		consensusProportion = _consensusProportion;
	} 
	
	function getInsuranceMaxPrice() public view returns(uint256 insuranceMaxPrice_) {
		insuranceMaxPrice_ = insuranceMaxPrice;
		return(insuranceMaxPrice_);
	}
	
	function setInsuranceMaxPrice(uint256 _insuranceMaxPrice) public {
		insuranceMaxPrice = _insuranceMaxPrice;
	}  
	
	function getSumInsuranceNum() public view returns(uint8 sumInsuranceNum_) {
		sumInsuranceNum_ = sumInsuranceNum;
		return(sumInsuranceNum_);
	}
	
	function setSumInsuranceNum(uint8 _sumInsuranceNum) public {
		sumInsuranceNum = _sumInsuranceNum;
	} 
	
	function getSumInsuranceDen() public view returns(uint8 sumInsuranceDen_) {
		sumInsuranceDen_ = sumInsuranceDen;
		return(sumInsuranceDen_);
	}
	function setSumInsuranceDen(uint8 _sumInsuranceDen) public {
		sumInsuranceDen = _sumInsuranceDen;
	}
	
	
    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline(address newAirline)
	    external requireIsOperational
    	airlineRegistered(msg.sender)
    	airlineFunded(msg.sender)
    	airlineNotGranted(newAirline, msg.sender)    	
    {
    	uint256 airlinesCount = model.getAirlineCount();
    	if(airlinesCount < minAirlineCountNoConsensus) {
    		model.createAirline(newAirline);
    		emit AirlineRegistered(newAirline);
    	} else {
    		consensus[newAirline].add(msg.sender);
    		uint256 consentCount = consensus[newAirline].length();
    		if(consentCount.mul(consensusProportion) < airlinesCount) {
    			emit GrantConsensus(false, consentCount, airlinesCount);
    		} else {
    			model.createAirline(newAirline);
    			delete consensus[newAirline];
    			emit GrantConsensus(true, consentCount, airlinesCount.add(1)); 
	    		emit AirlineRegistered(newAirline);				
    		}
    	}
    }
    
    function getAirline(address _airline) 
    	public view 
    	airlineRegistered(_airline)
    	returns(address airline_, uint256 id_, bool hasFunded_) 
    {
    	(uint256 id, bool hasFunded) = model.getAirline(_airline);
    	airline_ = 	_airline;
    	id_ = id;
    	hasFunded_ = hasFunded;
    	return(airline_, id_, hasFunded_);
    }
    
    function fundAirline() external 
    	payable 
    	requireIsOperational
    	airlineRegistered(msg.sender)
    	fundEnough checkValue
    {
    	payable(address(model)).transfer(minAirlineFund);
    	model.setAirlineHasFunded(msg.sender, true);
    	emit AirlineHasFunded(msg.sender, minAirlineFund);
    }
    

   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight(string memory _flight, uint256 _timestamp) 
    	external requireIsOperational
    	airlineRegistered(msg.sender)
    	airlineFunded(msg.sender)
    	flightTimeValid(_timestamp)
    {
		uint256 flightId = model.createFlight(msg.sender, _flight, _timestamp, STATUS_CODE_CREATED);
		emit FlightRegistered(flightId);	
    }
    
    function buyInsurance(uint256 _flightId) external payable requireIsOperational
    	flightRegistered(_flightId)
    	flightStatusToInsurance(_flightId)
    	verifyMaxInsurancePrice    	
    {
    	payable(address(model)).transfer(insuranceMaxPrice);
    	model.createInsurance(msg.sender, _flightId);
    	emit InsuranceValid(msg.sender, _flightId);    	
    }
    
    function withdrawal(uint256 amount) external requireIsOperational {
    	model.pay(msg.sender, amount);	
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus(address airline,
		string memory flight,
        uint256 timestamp,
        uint8 statusCode)
		public
    {
    	uint256 flightId = model.getFlightId(airline, flight, timestamp);
    	model.setFlightStatus(flightId, statusCode);
    	
    	if(statusCode == STATUS_CODE_LATE_AIRLINE) {
    		uint256[] memory insuranceIds = model.getInsurancesByFlightId(flightId);
    		for(uint256 i = 0; i < insuranceIds.length; i++) {
    			(, uint256 payment,) = model.getInsuranceById(insuranceIds[i]);
    			uint256 amount = payment.mul(sumInsuranceNum).div(sumInsuranceDen);
    			model.creditInsurees(insuranceIds[i], amount);
    		}
    	}
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string memory flight, uint256 timestamp)
	    external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        
        ResponseInfo storage response = oracleResponses[key];
		response.requester = msg.sender;
		response.isOpen = true;

        emit OracleRequest(index, airline, flight, timestamp);
    } 


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle()
        external
        payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");
        uint8[3] memory indexes = generateIndexes(msg.sender);
        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes()
	    view
	    external
	    returns(uint8[3] memory myIndexes)
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");
        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string memory flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");

        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);
            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey(address airline, string memory flight, uint256 timestamp)
	    pure
	    internal
	    returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account)
	    internal
	    returns(uint8[3] memory indexes)
    {
        //uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account)
        internal
        returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   

interface IFlightSuretyData{
	function isOperational() external view returns(bool);

	function createAirline(address newAirline) external;
	function getAirline(address airline) external view returns(uint256, bool) ;
	function getAirlineCount() external view returns(uint256); 
	function setAirlineHasFunded(address airline, bool hasFunded) external;
	 
	function createFlight(address _airline, string memory _flight, uint256 _timestamp, uint8 _statusCode) external returns(uint256 flightId);
	function getFlightById(uint256 _flightId) external view returns(bool isRegistered_, uint8 statusCode_, uint256 updatedTimestamp_, address airline_, string memory flight_);	
	function createInsurance(address passenger, uint256 flightId) external;
	function getFlightId(address _airline, string memory _flight, uint256 _timestamp) external view returns(uint256 flightId_);
	function setFlightStatus(uint256 flightId, uint8 statusCode) external;
	
	function getInsurancesByFlightId(uint256 _flightId) external view returns(uint256[] memory insurances_);
	function getInsuranceById(uint256 insuranceId) external view returns(address passenger_, uint256 payment_, uint8 status_);
	function creditInsurees(uint256 _insuranceId, uint256 amount) external;
	function pay(address passenger, uint256 amount) external;
}
