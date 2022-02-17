import * as SerialPort from 'serialport'
import * as Delimiter from '@serialport/parser-delimiter'
import * as cobs from 'cobs'
import * as mlx from './MLX90640'
import * as fs from 'fs'

const vendorId = '0483'
const productId = '5740'

var newDataCallback //function for new frame data
var port //serial port
var promiseStack = [] //stack for promises

function sendPing(value) {
    var data = Buffer.alloc(1)
    data[0] = value
    sendCommand(CMD.PING, data)
    return putOnPromiseStack(CMD.PING)
}
function getEE() {
    sendCommand(CMD.DUMP_EE, undefined)
    return putOnPromiseStack(CMD.DUMP_EE)
}
function getFrameData() {
    sendCommand(CMD.GET_FRAME_DATA, undefined)
    return putOnPromiseStack(CMD.GET_FRAME_DATA)
}
function setResolution(resolution) {
    var data = Buffer.alloc(1)
    data[0] = resolution
    sendCommand(CMD.SET_RESOLUTION, data)
    return putOnPromiseStack(CMD.SET_RESOLUTION)
}
function getResolution() {
    sendCommand(CMD.GET_CUR_RESOLUTION, undefined)
    return putOnPromiseStack(CMD.GET_CUR_RESOLUTION)
}
function setRefreshRate(refreshRate) {
    var data = Buffer.alloc(1)
    data[0] = refreshRate
    sendCommand(CMD.SET_REFRESH_RATE, data)
    return putOnPromiseStack(CMD.SET_REFRESH_RATE)
}
function getRefreshRate() {
    sendCommand(CMD.GET_REFRESH_RATE, undefined)
    return putOnPromiseStack(CMD.GET_REFRESH_RATE)
}
function setMode(mode) {
    var data = Buffer.alloc(1)
    data[0] = mode
    sendCommand(CMD.SET_MODE, data)
    return putOnPromiseStack(CMD.SET_MODE)
}
function getMode() {
    sendCommand(CMD.GET_CUR_MODE, undefined)
    return putOnPromiseStack(CMD.GET_CUR_MODE)
}
function setAutoFrameSending(sending) {
    var data = Buffer.alloc(1)
    data[0] = sending
    sendCommand(CMD.SET_AUTO_FRAME_DATA_SENDING, data)
    return putOnPromiseStack(CMD.SET_AUTO_FRAME_DATA_SENDING)
}
function getFirmwareVersion() {
    sendCommand(CMD.GET_FIRMWARE_VERSION, undefined)
    return putOnPromiseStack(CMD.GET_FIRMWARE_VERSION)
}
function jumpToBootloader() {
    sendCommand(CMD.JUMP_TO_BOOTLOADER, undefined)
    return putOnPromiseStack(CMD.JUMP_TO_BOOTLOADER)
}
function putOnPromiseStack(cmd) {
    var promise = new Promise(function (resolve, reject) {
        promiseStack.push({ command: cmd, done: resolve, error: reject })
    })
    return promise
}
function connect(vid: string = vendorId, pid: string = productId) {
    return new Promise(function (resolve, reject) {
        getPortsList().then(function (data) {
            //If vid/pid was not passed, connect with standard vid/pid for otc
            console.log('ports:', data)
            var prt = data.find(x => x.vendorId === vid && x.productId === pid)
            port = new SerialPort.SerialPort({
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                path: prt.path
            })

            port.on('open', function () {
                getEE() //whenever you connect to sensor, get EE data
                resolve(true)
            })

            const parser = port.pipe(new SerialPort.DelimiterParser({ delimiter: [0x00] })) //0x00 is message delimeter
            //New data handler
            parser.on('data', function (encodedData) {
                var decodedBuffer = cobs.decode(encodedData)

                var responseCommand = decodedBuffer[0] & 0xff
                var dataCode = decodedBuffer[1] & 0xff
                var dataLength = (decodedBuffer[2] & (0xff << 8)) + (decodedBuffer[3] & 0xff)

                var data = decodedBuffer.slice(4) //response data

                //Get promise from promiseStack
                var promise
                for (var i = 0; i < promiseStack.length; i++) {
                    if (promiseStack[i].command == decodedBuffer[0]) {
                        promise = promiseStack[i]
                        promiseStack.splice(i, 1)
                        break
                    }
                }
                // console.log("promiseStack ",promiseStack)
                if (promise == null) {
                    if (responseCommand == RSP.GET_FRAME_DATA) {
                        //callback function, new (automatic) frame data recieved
                        newDataCallback(mlx.getTemp(data))
                        return
                    } else if (responseCommand == RSP.DUMP_EE) {
                        //after getting EE on port open
                        if (dataCode == 1) mlx.extractParameters(data)
                        return
                    } else return console.log('promise not found!')
                }

                switch (dataCode) {
                    case -1:
                        return promise.error('CODE_NACK')
                    case -2:
                        return promise.error('CODE_WRITTEN_VALUE_NOT_SAME')
                    case -8:
                        return promise.error('CODE_I2C_FREQ_TOO_LOW')
                }

                switch (responseCommand) {
                    case RSP.PING:
                        return promise.done('Pong ' + data[0])
                    case RSP.DUMP_EE:
                        return promise.done(mlx.extractParameters(data))
                    case RSP.GET_FRAME_DATA:
                        return promise.done(mlx.getTemp(data))
                    case RSP.SET_RESOLUTION:
                        return promise.done('OK')
                    case RSP.GET_CUR_RESOLUTION:
                        return promise.done(data)
                    case RSP.SET_REFRESH_RATE:
                        return promise.done('OK')
                    case RSP.GET_REFRESH_RATE:
                        return promise.done(data)
                    case RSP.SET_MODE:
                        return promise.done('OK')
                    case RSP.GET_CUR_MODE:
                        return promise.done(data)
                    case RSP.SET_AUTO_FRAME_DATA_SENDING:
                        return promise.done(data)
                    case RSP.GET_FIRMWARE_VERSION:
                        return promise.done(decodeFw(data))
                    default:
                        return promise.error('Unknown response command!')
                }
            })
        })
    })
}
function setCallbackForNewData(func) {
    newDataCallback = func
}
function getPortsList() {
    return SerialPort.SerialPort.list()
}

//For reference
const RefreshRate = {
    HZ_MIN: 0x00,
    HZ_1: 0x01,
    HZ_2: 0x02,
    HZ_4: 0x03,
    HZ_8: 0x04,
    HZ_16: 0x05,
    HZ_32: 0x06,
    HZ_64: 0x07
}
const Resolution = {
    BIT_16: 0x00,
    BIT_17: 0x01,
    BIT_18: 0x02,
    BIT_19: 0x03
}
const ScanMode = {
    CHESS: 0x01,
    INTERLEAVED: 0x00
}
const AutoFrameSending = {
    ENABLED: 0x01,
    DISABLED: 0x00
}
//Command codes
const CMD = {
    PING: 0x00,
    DUMP_EE: 0x01,
    GET_FRAME_DATA: 0x02,
    SET_RESOLUTION: 0x03,
    GET_CUR_RESOLUTION: 0x04,
    SET_REFRESH_RATE: 0x05,
    GET_REFRESH_RATE: 0x06,
    SET_MODE: 0x07,
    GET_CUR_MODE: 0x08,
    SET_AUTO_FRAME_DATA_SENDING: 0x09,
    GET_FIRMWARE_VERSION: 0x0a,
    JUMP_TO_BOOTLOADER: 0x0b
}
//Response codes
const RSP = {
    PING: 0x00,
    DUMP_EE: 0x01,
    GET_FRAME_DATA: 0x02,
    SET_RESOLUTION: 0x03,
    GET_CUR_RESOLUTION: 0x04,
    SET_REFRESH_RATE: 0x05,
    GET_REFRESH_RATE: 0x06,
    SET_MODE: 0x07,
    GET_CUR_MODE: 0x08,
    SET_AUTO_FRAME_DATA_SENDING: 0x09,
    GET_FIRMWARE_VERSION: 0x0a
}

const commandHeaderSize = 3
function sendCommand(commandCode, data) {
    if (data == null) data = [] //Create empty array -> length = 0
    var sendBuffer = Buffer.alloc(commandHeaderSize + data.length)
    sendBuffer[0] = commandCode
    sendBuffer[1] = (data.length >> 8) & 0xff
    sendBuffer[2] = data.length & 0xff

    for (var i = 0; i < data.length; i++) {
        sendBuffer[i + commandHeaderSize] = data[i] & 0xff
    }
    // console.log("to send: ", sendBuffer);
    var encodedBuffer = cobs.encode(sendBuffer)
    // console.log("encoded: ", encodedBuffer);
    var bufferToWrite = Buffer.alloc(encodedBuffer.length + 1)
    for (var i = 0; i < encodedBuffer.length; i++) {
        bufferToWrite[i] = encodedBuffer[i] & 0xff
    }
    bufferToWrite[bufferToWrite.length - 1] = 0x00
    // console.log("to write: ", bufferToWrite);
    port.write(bufferToWrite)
}
function decodeFw(d) {
    let data = Buffer.from(d)
    var major = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]
    var minor = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]
    var revision = (data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]
    var ret = {
        major: major,
        minor: minor,
        revision: revision
    }
    return ret
}

export {
    connect,
    sendPing,
    getEE,
    getFrameData,
    setResolution,
    getResolution,
    setRefreshRate,
    getRefreshRate,
    setMode,
    getMode,
    setAutoFrameSending,
    getFirmwareVersion,
    jumpToBootloader,
    setCallbackForNewData,
    getPortsList,
    RefreshRate,
    Resolution,
    ScanMode,
    AutoFrameSending
}
