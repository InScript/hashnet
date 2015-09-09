importScripts('./work.js');
importScripts('./scrypt.js');
importScripts('./json2.js');

var WORK_TIMEOUT = 60 * 1000; // ms

var Notification = {
  SYSTEM_ERROR : 0,
	PERMISSION_ERROR : 1,
	CONNECTION_ERROR : 2,
	AUTHENTICATION_ERROR : 3,
	COMMUNICATION_ERROR : 4,
	LONG_POLLING_FAILED : 5,
	LONG_POLLING_ENABLED : 6,
	NEW_BLOCK_DETECTED : 7,
	NEW_WORK : 8,
	POW_TRUE : 9,
	POW_FALSE : 10,
	TERMINATED : 11,
	STARTED: 12
};

var scanTime = 5000; // ms
var retryPause = 30000; // ms
var throttleFactor = 0;

var curWork = null;
var hashes = 0;
var lastHashes = 0;
var running = false;
var nonce = 0;

var hashRateUpdater = null;
self.onmessage = function(e) {
	 var cmd = e.data.cmd;
	 if(cmd=='start') {
		 run();
	 }
	 if(cmd=='stop') {
		 stop();
	 }
};

// Never called because CPU usage jumps to 100% and the
// worker doesn't seem to receive stop message
function stop() {
	running = false;
	self.postMessage({'notification': Notification.TERMINATED});
	self.postMessage({'logMessage': 'Hashes: '+hashes});
	clearInterval(hashRateUpdater);
	self.terminate();
}

function run() {
	running = true;
	self.postMessage({'notification': Notification.STARTED});
	doWork();
}

function doWork() {
	var lastTime = (new Date()).getTime();
	nonce=0;
	nonce_end= 0;
	while(running) {
		
		if(curWork == null ) {
			// Get New Work
			curWork = new Work();
			curWork.getWork();
			nonce = curWork.from;
			nonce_end = curWork.step+nonce;
			self.postMessage({'notification': Notification.NEW_WORK});
			
		} else {
			if(curWork.meetsTarget(nonce, hashes)) {
				//submit work
				var submitResult = curWork.submit(nonce);
				if(submitResult==true) {
					self.postMessage({'notification': Notification.POW_TRUE});
				} else {
					self.postMessage({'notification': Notification.POW_FALSE});
					curWork = null; //should get new work
				}
				self.postMessage({'workerHashes': hashes});
			}
			nonce++;
			hashes++;
			if(hashes%200==0) {
				var secTime = (((new Date()).getTime())-lastTime)/1000;
				var hashRate = ((hashes - lastHashes)/secTime).toFixed(0);
				self.postMessage({'hashRate': hashRate,
							      'workerHashes': hashes});
				lastHashes = hashes;
				lastTime = (new Date()).getTime();
			}
		}
		if ( nonce > nonce_end ){
			curWork = null;
		}
	}
}

