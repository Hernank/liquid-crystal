var lcd = require('../');
// var Tessel = require('tm');
var tm = process.binding('tm');

// Initialize the lcd.
console.log("initalizing");
var port = tm.port('E');
lcd.initialize(port.gpio(1), port.gpio(2), port.gpio(3),
	port.gpio(4), port.gpio(5), port.gpio(6));
console.log("done initalizing");

console.log("writing to lcd");

lcd.print("test");

while(true){
}