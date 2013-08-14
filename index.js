var tm = process.binding('tm');
var Tessel = require('tm');

var 
// commands
 LCD_CLEARDISPLAY = 0x01,
 LCD_RETURNHOME = 0x02,
 LCD_ENTRYMODESET = 0x04,
 LCD_DISPLAYCONTROL = 0x08,
 LCD_CURSORSHIFT = 0x10,
 LCD_FUNCTIONSET = 0x20,
 LCD_SETCGRAMADDR = 0x40,
 LCD_SETDDRAMADDR = 0x80,

// flags for display entry mode
 LCD_ENTRYRIGHT = 0x00,
 LCD_ENTRYLEFT = 0x02,
 LCD_ENTRYSHIFTINCREMENT = 0x01,
 LCD_ENTRYSHIFTDECREMENT = 0x00,

// flags for display on/off control
 LCD_DISPLAYON = 0x04,
 LCD_DISPLAYOFF = 0x00,
 LCD_CURSORON = 0x02,
 LCD_CURSOROFF = 0x00,
 LCD_BLINKON = 0x01,
 LCD_BLINKOFF = 0x00,

// flags for display/cursor shift
LCD_DISPLAYMOVE = 0x08,
LCD_CURSORMOVE = 0x00,
LCD_MOVERIGHT = 0x04,
LCD_MOVELEFT = 0x00,

// flags for function set
LCD_8BITMODE = 0x10,
LCD_4BITMODE = 0x00,
LCD_2LINE = 0x08,
LCD_1LINE = 0x00,
LCD_5x10DOTS = 0x04,
LCD_5x8DOTS = 0x00
;

var datapins = [],
    _rs = null,
    _rw = null,
    _enable = null,
    port = Tessel.port('GPIO'),
    OUTPUT = 0, // TODO: these globals should really be exported from tm
    INPUT = 1,
    _displayfunction = null,
    _numlines = 0,
    _currline = 0,
    _displaycontrol = null
    ;

function write(value) {
  send(value, HIGH);
  return 1; // assume sucess
}

function command(value) { send(value, LOW); }

function send(value, mode) {
  port.gpio(_rs).set(mode);
  // if there is a RW pin indicated, set it low to Write
  if (_rw != 255) { 
    port.gpio(_rw).low();
  }
  
  if (_displayfunction & LCD_8BITMODE) {
    write8bits(value); 
  } else {
    console.log("write 4 ", value);
    write4bits(value>>4);
    write4bits(value);
  }
}

function pulseEnable() {
  port.gpio(_enable).low();
  tm.sleep_ms(1);    
  port.gpio(_enable).high();
  tm.sleep_ms(1);    // enable pulse must be >450ns
  port.gpio(_enable).low();
  tm.sleep_ms(1);   // commands need > 37us to settle
}

function writebits(length, value) {
  for (var i = 0; i < length; i++) {
    port.gpio(datapins[i]).setMode(OUTPUT);
    
    port.gpio(datapins[i]).set((value >> i) & 0x01);
  }

  pulseEnable();
}

function write8bits(value) {
  writebits(8, value);
}

function write4bits(value) {
  writebits(4, value);
}

function begin(col, lines){
  // dotsize is by default LCD_5x8DOTS
  var dotsize = LCD_5x8DOTS;
  if (lines > 1) {
    _displayfunction |= LCD_2LINE;
  }
  _numlines = lines;
  _currline = 0;

  // for some 1 line displays you can select a 10 pixel high font
  if ((dotsize != 0) && (lines == 1)) {
    _displayfunction |= LCD_5x10DOTS;
  }

  // SEE PAGE 45/46 FOR INITIALIZATION SPECIFICATION!
  // according to datasheet, we need at least 40ms after power rises above 2.7V
  // before sending commands. Arduino can turn on way befer 4.5V so we'll wait 50
  tm.sleep_us(50000); 
  // Now we pull both RS and R/W low to begin commands
  port.gpio(_rs).low();
  port.gpio(_enable).low();

  if (_rw != 255) { 
    port.gpio(_rw).low();
  }
  
  //put the LCD into 4 bit or 8 bit mode
  if (! (_displayfunction & LCD_8BITMODE)) {
    // this is according to the hitachi HD44780 datasheet
    // figure 24, pg 46

    // we start in 8bit mode, try to set 4 bit mode
    write4bits(0x03);
    tm.sleep_us(4500); // wait min 4.1ms

    // second try
    write4bits(0x03);
    tm.sleep_us(4500); // wait min 4.1ms
    
    // third go!
    write4bits(0x03); 
    tm.sleep_us(150);

    // finally, set to 4-bit interface
    write4bits(0x02); 
  } else {
    // this is according to the hitachi HD44780 datasheet
    // page 45 figure 23

    // Send function set command sequence
    command(LCD_FUNCTIONSET | _displayfunction);
    tm.sleep_us(4500);  // wait more than 4.1ms

    // second try
    command(LCD_FUNCTIONSET | _displayfunction);
    tm.sleep_us(150);

    // third go
    command(LCD_FUNCTIONSET | _displayfunction);
  }

  // finally, set # lines, font size, etc.
  command(LCD_FUNCTIONSET | _displayfunction);  

  // turn the display on with no cursor or blinking default
  _displaycontrol = LCD_DISPLAYON | LCD_CURSOROFF | LCD_BLINKOFF;  
  display();

  // clear it off
  clear();

  // Initialize to default text direction (for romance languages)
  _displaymode = LCD_ENTRYLEFT | LCD_ENTRYSHIFTDECREMENT;
  // set the entry mode
  command(LCD_ENTRYMODESET | _displaymode);

}

function clear()
{
  command(LCD_CLEARDISPLAY);  // clear display, set cursor position to zero
  tm.sleep_us(2000);  // this command takes a long time!
}

function home()
{
  command(LCD_RETURNHOME);  // set cursor position to zero
  tm.sleep_us(2000);  // this command takes a long time!
}

function setCursor(col, row)
{
  var row_offsets = [0x00, 0x40, 0x14, 0x54];
  if ( row >= _numlines ) {
    row = _numlines-1;    // we count rows starting w/0
  }
  
  command(LCD_SETDDRAMADDR | (col + row_offsets[row]));
}

// Turn the display on/off (quickly)
function noDisplay() {
  _displaycontrol &= ~LCD_DISPLAYON;
  command(LCD_DISPLAYCONTROL | _displaycontrol);
}
function display() {
  _displaycontrol |= LCD_DISPLAYON;
  command(LCD_DISPLAYCONTROL | _displaycontrol);
}

// Turns the underline cursor on/off
function noCursor() {
  _displaycontrol &= ~LCD_CURSORON;
  command(LCD_DISPLAYCONTROL | _displaycontrol);
}
function cursor() {
  _displaycontrol |= LCD_CURSORON;
  command(LCD_DISPLAYCONTROL | _displaycontrol);
}

// Turn on and off the blinking cursor
function noBlink() {
  _displaycontrol &= ~LCD_BLINKON;
  command(LCD_DISPLAYCONTROL | _displaycontrol);
}
function blink() {
  _displaycontrol |= LCD_BLINKON;
  command(LCD_DISPLAYCONTROL | _displaycontrol);
}

// These commands scroll the display without changing the RAM
function scrollDisplayLeft() {
  command(LCD_CURSORSHIFT | LCD_DISPLAYMOVE | LCD_MOVELEFT);
}
function scrollDisplayRight() {
  command(LCD_CURSORSHIFT | LCD_DISPLAYMOVE | LCD_MOVERIGHT);
}

// This is for text that flows Left to Right
function leftToRight() {
  _displaymode |= LCD_ENTRYLEFT;
  command(LCD_ENTRYMODESET | _displaymode);
}

// This is for text that flows Right to Left
function rightToLeft() {
  _displaymode &= ~LCD_ENTRYLEFT;
  command(LCD_ENTRYMODESET | _displaymode);
}

// This will 'right justify' text from the cursor
function autoscroll() {
  _displaymode |= LCD_ENTRYSHIFTINCREMENT;
  command(LCD_ENTRYMODESET | _displaymode);
}

// This will 'left justify' text from the cursor
function noAutoscroll() {
  _displaymode &= ~LCD_ENTRYSHIFTINCREMENT;
  command(LCD_ENTRYMODESET | _displaymode);
}

// Allows us to fill the first 8 CGRAM locations
// with custom characters
function createChar(location, charmap) {
  location &= 0x7; // we only have 8 locations 0-7
  command(LCD_SETCGRAMADDR | (location << 3));
  for (var i=0; i<8; i++) {
    write(charmap[i]);
  }
}

function print(s)
{
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    n += write(s.charCodeAt(i));
  }
  return n;
}

// TODO: fix this so that it supports all types of liquid crystal initialization schemes
function initialize (rs, enable, d0, d1, d2, d3, next)
{
  _rs = rs;
  _rw = 255;
  _enable = enable;
  datapins[0] = d0;
  datapins[1] = d1;
  datapins[2] = d2;
  datapins[3] = d3;
  console.log(port);
  console.log('hm', _rs);
  port.gpio(_rs).setMode(OUTPUT);
  console.log('er');
  port.gpio(_enable).setMode(OUTPUT);
  console.log('hm');

  if (_rw != 255){
    console.log('hi');
    port.gpio(_rw).setMode(OUTPUT);
  }

  // always 4 bit mode for now
  _displayfunction = LCD_4BITMODE | LCD_1LINE | LCD_5x8DOTS;

  console.log('ok');
  begin(16, 1);
  if (next != undefined && typeof(next) === 'function') {
    next();
  }
}

exports.initialize = initialize;
exports.clear = clear;
exports.home = home;
exports.setCursor = setCursor;
exports.noDisplay = noDisplay;
exports.display = display;
exports.noCursor = noCursor;
exports.cursor = cursor;
exports.noBlink = noBlink;
exports.blink = blink;
exports.scrollDisplayLeft = scrollDisplayLeft;
exports.scrollDisplayRight = scrollDisplayRight;
exports.leftToRight = leftToRight;
exports.rightToLeft = rightToLeft;
exports.autoscroll = autoscroll;
exports.noAutoscroll = noAutoscroll;
exports.createChar = createChar;
exports.print = print;

var lcd = exports;
// var Tessel = require('tm');
// var tm = process.binding('tm');

// Initialize the lcd.
console.log("initalizing");
// var port = Tessel.port('GPIO');
lcd.initialize(1, 2, 3, 4, 5, 6);
console.log("done initalizing");

console.log("writing to lcd");

lcd.print("test");

while(true){
}